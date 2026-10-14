import { getHealth, HealthDeps } from './health';

const deps = (database: 'up' | 'down' | 'not-configured'): HealthDeps => ({
  version: '1.2.3',
  aiProviderName: 'fake',
  pingDatabase: async () => database,
  now: () => new Date('2026-10-13T12:00:00.000Z'),
});

describe('getHealth', () => {
  it('is ok when the database is up', async () => {
    expect(await getHealth(deps('up'))).toEqual({
      status: 200,
      body: {
        status: 'ok',
        version: '1.2.3',
        time: '2026-10-13T12:00:00.000Z',
        checks: { database: 'up', aiProvider: 'fake' },
      },
    });
  });

  it('is ok when no database is configured', async () => {
    expect((await getHealth(deps('not-configured'))).body.status).toBe('ok');
  });

  it('is degraded when the database is down', async () => {
    expect((await getHealth(deps('down'))).body.status).toBe('degraded');
  });
});
