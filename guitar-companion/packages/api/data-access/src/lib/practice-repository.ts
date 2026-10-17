import {
  PracticePlan,
  PracticeSession,
  UpdateSessionRequest,
} from '@gsc/contracts';
import { Collection, Db, ObjectId, WithId } from 'mongodb';

type NewPlan = Omit<PracticePlan, 'id' | 'createdAt'>;

interface PlanDoc extends NewPlan {
  userId: string;
  createdAt: Date;
  schemaVersion: 1;
}

interface SessionDoc extends UpdateSessionRequest {
  userId: string;
  planId: string;
  updatedAt: Date;
}

/**
 * Practice plans and their sessions (ADR-011), kept apart from phrases so
 * history survives phrase edits. Every query is scoped by userId.
 */
export class PracticeRepository {
  private readonly plans: Collection<PlanDoc>;
  private readonly sessions: Collection<SessionDoc>;
  private indexes: Promise<unknown> | null = null;

  constructor(db: Db) {
    this.plans = db.collection<PlanDoc>('practicePlans');
    this.sessions = db.collection<SessionDoc>('practiceSessions');
  }

  private ensureIndexes(): Promise<unknown> {
    this.indexes ??= Promise.all([
      this.plans.createIndex({ userId: 1, phraseId: 1, createdAt: -1 }),
      this.sessions.createIndex({ userId: 1, planId: 1 }, { unique: true }),
    ]);
    return this.indexes;
  }

  async createPlan(
    userId: string,
    plan: NewPlan,
    now = new Date(),
  ): Promise<PracticePlan> {
    await this.ensureIndexes();
    const doc: PlanDoc = { ...plan, userId, createdAt: now, schemaVersion: 1 };
    const { insertedId } = await this.plans.insertOne(doc);
    return toPlan({ ...doc, _id: insertedId });
  }

  async getPlan(userId: string, planId: string): Promise<PracticePlan | null> {
    if (!ObjectId.isValid(planId)) return null;
    const doc = await this.plans.findOne({
      _id: new ObjectId(planId),
      userId,
    });
    return doc ? toPlan(doc) : null;
  }

  async latestPlan(
    userId: string,
    phraseId: string,
  ): Promise<PracticePlan | null> {
    const doc = await this.plans.findOne(
      { userId, phraseId },
      { sort: { createdAt: -1, _id: -1 } },
    );
    return doc ? toPlan(doc) : null;
  }

  async plansForUser(userId: string, limit = 1000): Promise<PracticePlan[]> {
    const docs = await this.plans
      .find({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .toArray();
    return docs.map(toPlan);
  }

  async sessionsForUser(
    userId: string,
    limit = 1000,
  ): Promise<PracticeSession[]> {
    const docs = await this.sessions.find({ userId }).limit(limit).toArray();
    return docs.map(toSession);
  }

  async getSession(
    userId: string,
    planId: string,
  ): Promise<PracticeSession | null> {
    const doc = await this.sessions.findOne({ userId, planId });
    return doc ? toSession(doc) : null;
  }

  async saveSession(
    userId: string,
    planId: string,
    update: UpdateSessionRequest,
    now = new Date(),
  ): Promise<PracticeSession> {
    await this.ensureIndexes();
    const doc = await this.sessions.findOneAndUpdate(
      { userId, planId },
      { $set: { ...update, updatedAt: now } },
      { upsert: true, returnDocument: 'after' },
    );
    if (!doc) throw new Error('Session upsert returned nothing');
    return toSession(doc);
  }
}

function toPlan(doc: WithId<PlanDoc>): PracticePlan {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, userId, schemaVersion, createdAt, ...rest } = doc;
  return { ...rest, id: _id.toHexString(), createdAt: createdAt.toISOString() };
}

function toSession(doc: WithId<SessionDoc>): PracticeSession {
  return {
    planId: doc.planId,
    progress: doc.progress,
    notes: doc.notes,
    updatedAt: doc.updatedAt.toISOString(),
  };
}
