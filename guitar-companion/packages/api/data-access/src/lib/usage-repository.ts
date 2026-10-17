import { Collection, Db } from 'mongodb';

interface UsageDoc {
  userId: string;
  /** UTC day, YYYY-MM-DD. */
  day: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

/** Per-user daily AI usage counters (one document per user and day). */
export class UsageRepository {
  private readonly collection: Collection<UsageDoc>;
  private indexes: Promise<unknown> | null = null;

  constructor(db: Db) {
    this.collection = db.collection<UsageDoc>('aiUsage');
  }

  private ensureIndexes(): Promise<unknown> {
    this.indexes ??= this.collection.createIndex(
      { userId: 1, day: 1 },
      { unique: true },
    );
    return this.indexes;
  }

  async get(userId: string, day: string) {
    const doc = await this.collection.findOne({ userId, day });
    return {
      requests: doc?.requests ?? 0,
      inputTokens: doc?.inputTokens ?? 0,
      outputTokens: doc?.outputTokens ?? 0,
    };
  }

  /** Atomic increment, so concurrent requests can't lose counts. */
  async add(
    userId: string,
    day: string,
    delta: { requests: number; inputTokens: number; outputTokens: number },
  ): Promise<void> {
    await this.ensureIndexes();
    await this.collection.updateOne(
      { userId, day },
      { $inc: delta },
      { upsert: true },
    );
  }
}
