import { CreatePhraseRequest, Phrase, PhraseSummary } from '@gsc/contracts';
import { Collection, Db, ObjectId, WithId } from 'mongodb';

interface PhraseDoc extends CreatePhraseRequest {
  userId: string;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: 1;
}

/** Every query is scoped by userId so ownership is enforced at the data layer. */
export class PhraseRepository {
  private readonly collection: Collection<PhraseDoc>;
  private indexes: Promise<unknown> | null = null;

  constructor(db: Db) {
    this.collection = db.collection<PhraseDoc>('phrases');
  }

  private ensureIndexes(): Promise<unknown> {
    this.indexes ??= this.collection.createIndex({ userId: 1, createdAt: -1 });
    return this.indexes;
  }

  async create(
    userId: string,
    input: CreatePhraseRequest,
    now = new Date(),
  ): Promise<Phrase> {
    await this.ensureIndexes();
    const doc: PhraseDoc = {
      ...input,
      userId,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };
    const { insertedId } = await this.collection.insertOne(doc);
    return toPhrase({ ...doc, _id: insertedId });
  }

  async get(userId: string, id: string): Promise<Phrase | null> {
    if (!ObjectId.isValid(id)) return null;
    const doc = await this.collection.findOne({
      _id: new ObjectId(id),
      userId,
    });
    return doc ? toPhrase(doc) : null;
  }

  async list(userId: string, limit = 50): Promise<PhraseSummary[]> {
    const docs = await this.collection
      .find({ userId }, { projection: { title: 1, source: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return docs.map((d) => ({
      id: d._id.toHexString(),
      title: d.title,
      source: d.source,
      createdAt: d.createdAt.toISOString(),
    }));
  }
}

function toPhrase(doc: WithId<PhraseDoc>): Phrase {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, userId, schemaVersion, createdAt, updatedAt, ...rest } = doc;
  return {
    ...rest,
    id: _id.toHexString(),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}
