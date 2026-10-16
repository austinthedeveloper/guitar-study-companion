import { PracticePlanSchema } from '@gsc/contracts';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoConnection } from './mongo';
import { PracticeRepository } from './practice-repository';

const plan = {
  phraseId: 'phrase1',
  phraseRevision: 1,
  settings: {
    difficulty: 'medium' as const,
    minutes: 15,
    focus: 'balanced' as const,
  },
  exercises: [
    {
      id: 'x1',
      kind: 'slow' as const,
      title: 'Whole phrase, slowly',
      objective: 'Play it slowly.',
      eventIds: ['e1'],
      referenceNotes: [],
      tempo: { startBpm: 48, targetBpm: 80, stepBpm: 5, rhythmic: false },
      repetitions: 6,
      successCriterion: 'Clean at 80 bpm.',
      instructions: [],
      coaching: [],
      minutes: 4,
    },
  ],
  rejected: [],
  coachedBy: null,
};

describe('PracticeRepository', () => {
  let server: MongoMemoryServer;
  let conn: MongoConnection;
  let repo: PracticeRepository;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    conn = new MongoConnection(server.getUri(), 'test');
    const db = await conn.db();
    if (!db) throw new Error('no db');
    repo = new PracticeRepository(db);
  }, 60_000);

  afterAll(async () => {
    await conn.close();
    await server.stop();
  });

  it('stores plans per user and returns the newest for a phrase', async () => {
    const older = await repo.createPlan('ann', plan, new Date('2026-10-01'));
    const newer = await repo.createPlan('ann', plan, new Date('2026-10-02'));
    expect(await repo.getPlan('ann', older.id)).toEqual(older);
    expect((await repo.latestPlan('ann', 'phrase1'))?.id).toBe(newer.id);
    expect(await repo.getPlan('bob', older.id)).toBeNull();
    expect(await repo.latestPlan('bob', 'phrase1')).toBeNull();
    expect(await repo.getPlan('ann', 'bad-id')).toBeNull();
  });

  it('reads back plans that satisfy the contract (undefined is not stored as null)', async () => {
    const created = await repo.createPlan('eve', {
      ...plan,
      exercises: [
        { ...plan.exercises[0], technique: undefined, chord: undefined },
      ],
    });
    const read = await repo.latestPlan('eve', 'phrase1');
    expect(PracticePlanSchema.safeParse(read).success).toBe(true);
    expect(read).toEqual(created);
  });

  it('keeps one session per plan and user, replacing it on save', async () => {
    const p = await repo.createPlan('cat', plan);
    expect(await repo.getSession('cat', p.id)).toBeNull();
    await repo.saveSession('cat', p.id, {
      progress: { x1: { completedAt: null, bestBpm: 60 } },
      notes: 'first',
    });
    const saved = await repo.saveSession(
      'cat',
      p.id,
      {
        progress: {
          x1: { completedAt: '2026-10-16T10:00:00.000Z', bestBpm: 80 },
        },
        notes: 'second',
      },
      new Date('2026-10-16T10:00:00.000Z'),
    );
    expect(saved).toEqual({
      planId: p.id,
      progress: {
        x1: { completedAt: '2026-10-16T10:00:00.000Z', bestBpm: 80 },
      },
      notes: 'second',
      updatedAt: '2026-10-16T10:00:00.000Z',
    });
    expect(await repo.getSession('dan', p.id)).toBeNull();
  });
});
