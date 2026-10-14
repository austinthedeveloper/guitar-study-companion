import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoConnection } from './mongo';

describe('MongoConnection', () => {
  it('reports not-configured without a URI', async () => {
    const conn = new MongoConnection(undefined);
    expect(conn.configured).toBe(false);
    expect(await conn.db()).toBeNull();
    expect(await conn.ping()).toBe('not-configured');
  });

  it('reports down when the server is unreachable', async () => {
    const conn = new MongoConnection(
      'mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=200',
    );
    expect(await conn.ping()).toBe('down');
    await conn.close();
  });

  it('reports up against a running server', async () => {
    const server = await MongoMemoryServer.create();
    const conn = new MongoConnection(server.getUri());
    try {
      expect(await conn.ping()).toBe('up');
    } finally {
      await conn.close();
      await server.stop();
    }
  }, 60_000);
});
