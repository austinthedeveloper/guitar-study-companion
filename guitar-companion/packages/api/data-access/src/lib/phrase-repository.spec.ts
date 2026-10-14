import { CreatePhraseRequest } from '@gsc/contracts';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoConnection } from './mongo';
import { PhraseRepository } from './phrase-repository';

const input: CreatePhraseRequest = {
  title: 'Bend lick',
  source: { bookTitle: 'Test Book', page: '63' },
  context: { tuningMidi: [64, 59, 55, 50, 45, 40], capo: 0 },
  rhythmKnown: false,
  ticksPerQuarter: 480,
  events: [
    {
      id: 'e1',
      order: 0,
      stringIndex: 1,
      fret: 17,
      durationTicks: null,
      techniques: ['bend'],
      bendSemitones: 2,
    },
  ],
};

describe('PhraseRepository', () => {
  let server: MongoMemoryServer;
  let conn: MongoConnection;
  let repo: PhraseRepository;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    conn = new MongoConnection(server.getUri(), 'test');
    const db = await conn.db();
    if (!db) throw new Error('no db');
    repo = new PhraseRepository(db);
  }, 60_000);

  afterAll(async () => {
    await conn.close();
    await server.stop();
  });

  it('creates and reads back a phrase for its owner', async () => {
    const created = await repo.create(
      'alice',
      input,
      new Date('2026-10-13T12:00:00Z'),
    );
    expect(created).toMatchObject({
      ...input,
      revision: 1,
      createdAt: '2026-10-13T12:00:00.000Z',
    });
    expect(created).not.toHaveProperty('userId');
    expect(await repo.get('alice', created.id)).toEqual(created);
  });

  it('isolates phrases by user', async () => {
    const created = await repo.create('alice', input);
    expect(await repo.get('bob', created.id)).toBeNull();
    expect((await repo.list('bob')).map((p) => p.id)).not.toContain(created.id);
  });

  it('returns null for malformed ids', async () => {
    expect(await repo.get('alice', 'not-an-id')).toBeNull();
  });

  it('lists newest first', async () => {
    await repo.create(
      'carol',
      { ...input, title: 'old' },
      new Date('2026-01-01'),
    );
    await repo.create(
      'carol',
      { ...input, title: 'new' },
      new Date('2026-06-01'),
    );
    expect((await repo.list('carol')).map((p) => p.title)).toEqual([
      'new',
      'old',
    ]);
  });
});
