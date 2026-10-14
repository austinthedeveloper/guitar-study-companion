import { Db, MongoClient } from 'mongodb';

/**
 * Lazily connects once per Functions worker and reuses the client across
 * invocations. Returns null when MONGODB_URI is not configured.
 */
export class MongoConnection {
  private clientPromise: Promise<MongoClient> | null = null;

  constructor(
    private readonly uri: string | undefined,
    private readonly dbName = 'gsc',
  ) {}

  get configured(): boolean {
    return !!this.uri;
  }

  async db(): Promise<Db | null> {
    if (!this.uri) return null;
    if (!this.clientPromise) {
      const client = new MongoClient(this.uri, {
        serverSelectionTimeoutMS: 3000,
      });
      this.clientPromise = client.connect().catch((err) => {
        this.clientPromise = null;
        throw err;
      });
    }
    return (await this.clientPromise).db(this.dbName);
  }

  async ping(): Promise<'up' | 'down' | 'not-configured'> {
    if (!this.uri) return 'not-configured';
    try {
      await (await this.db())?.command({ ping: 1 });
      return 'up';
    } catch {
      return 'down';
    }
  }

  async close(): Promise<void> {
    const pending = this.clientPromise;
    this.clientPromise = null;
    if (pending) await (await pending).close();
  }
}
