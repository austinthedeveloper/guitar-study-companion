import {
  CreatePhraseRequest,
  Explanation,
  Phrase,
  PhraseSummary,
  UpdateHarmonyRequest,
} from '@gsc/contracts';
import { Collection, Db, ObjectId, WithId } from 'mongodb';

interface PhraseDoc extends CreatePhraseRequest {
  explanation?: Explanation;
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

  /**
   * Replaces key, chords, and chord placement if the stored revision still
   * matches; bumps the revision. Empty values are removed.
   */
  async updateHarmony(
    userId: string,
    id: string,
    update: UpdateHarmonyRequest,
    now = new Date(),
  ): Promise<Phrase | 'not_found' | 'conflict'> {
    if (!ObjectId.isValid(id)) return 'not_found';
    const _id = new ObjectId(id);
    const set: Record<string, unknown> = { updatedAt: now };
    const unset: Record<string, ''> = {};
    for (const field of ['key', 'chords'] as const) {
      if (update[field]) set[`context.${field}`] = update[field];
      else unset[`context.${field}`] = '';
    }
    if (update.chordChanges.length)
      set['context.chordChanges'] = [...update.chordChanges].sort(
        (a, b) => a.fromOrder - b.fromOrder,
      );
    else unset['context.chordChanges'] = '';
    const doc = await this.collection.findOneAndUpdate(
      { _id, userId, revision: update.revision },
      {
        $set: set,
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
        $inc: { revision: 1 },
      },
      { returnDocument: 'after' },
    );
    return doc ? toPhrase(doc) : this.missOrConflict(userId, _id);
  }

  /**
   * Stores an explanation only if the phrase is still at the revision it
   * explains. Derived data, so the revision is not bumped.
   */
  async saveExplanation(
    userId: string,
    id: string,
    explanation: Explanation,
    now = new Date(),
  ): Promise<Phrase | 'not_found' | 'conflict'> {
    if (!ObjectId.isValid(id)) return 'not_found';
    const _id = new ObjectId(id);
    const doc = await this.collection.findOneAndUpdate(
      { _id, userId, revision: explanation.phraseRevision },
      { $set: { explanation, updatedAt: now } },
      { returnDocument: 'after' },
    );
    return doc ? toPhrase(doc) : this.missOrConflict(userId, _id);
  }

  /** After a revision-guarded update matched nothing: was it gone, or changed? */
  private async missOrConflict(
    userId: string,
    _id: ObjectId,
  ): Promise<'not_found' | 'conflict'> {
    const exists = await this.collection.countDocuments(
      { _id, userId },
      { limit: 1 },
    );
    return exists ? 'conflict' : 'not_found';
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
