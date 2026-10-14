import { FakeAiProvider } from '@gsc/api/ai-core';
import { MAX_CROP_BYTES } from '@gsc/contracts';
import { interpretImport } from './interpret';

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]).toString('base64');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]).toString('base64');
const tuningMidi = [64, 59, 55, 50, 45, 40];
const body = (patch: Record<string, unknown> = {}) => ({
  image: { mimeType: 'image/png', dataBase64: PNG },
  tuningMidi,
  consent: true,
  ...patch,
});
const deps = (scenario?: string) => ({
  ai: new FakeAiProvider(),
  scenario,
  timeoutMs: 100,
});
const code = (r: { body: unknown }) =>
  (r.body as { error?: { code: string } }).error?.code;

describe('interpretImport', () => {
  it('returns a draft for a valid PNG', async () => {
    const res = await interpretImport(body(), deps());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ provider: 'fake', rejectedEventCount: 0 });
  });

  it('requires consent before anything else', async () => {
    for (const consent of [undefined, false, 'yes']) {
      const res = await interpretImport(body({ consent }), deps());
      expect(res.status).toBe(400);
      expect(code(res)).toBe('consent_required');
    }
    expect(code(await interpretImport(null, deps()))).toBe('consent_required');
  });

  it('rejects unsupported declared types', async () => {
    const res = await interpretImport(
      body({ image: { mimeType: 'image/heic', dataBase64: PNG } }),
      deps(),
    );
    expect(res.status).toBe(400);
    expect(code(res)).toBe('validation_failed');
  });

  it('rejects content that does not match the declared type', async () => {
    const res = await interpretImport(
      body({ image: { mimeType: 'image/png', dataBase64: JPEG } }),
      deps(),
    );
    expect(res.status).toBe(415);
    const text = await interpretImport(
      body({
        image: {
          mimeType: 'image/png',
          dataBase64: Buffer.from('hello world!').toString('base64'),
        },
      }),
      deps(),
    );
    expect(text.status).toBe(415);
  });

  it('rejects oversize images', async () => {
    const big = Buffer.alloc(MAX_CROP_BYTES + 10, 0);
    const res = await interpretImport(
      body({
        image: { mimeType: 'image/png', dataBase64: big.toString('base64') },
      }),
      deps(),
    );
    expect(res.status).toBe(413);
    expect(code(res)).toBe('payload_too_large');
  });

  it.each([
    ['unavailable', 502, 'ai_unavailable'],
    ['invalid-output', 502, 'ai_invalid_output'],
    ['timeout', 504, 'ai_timeout'],
  ])('maps %s to a retryable %i', async (scenario, status, expected) => {
    const res = await interpretImport(body(), deps(scenario));
    expect(res.status).toBe(status);
    expect(res.body).toMatchObject({
      error: { code: expected, retryable: true },
    });
  });

  it('logs counts but never image data', async () => {
    const log = vi.fn();
    await interpretImport(body(), { ...deps(), log });
    expect(JSON.stringify(log.mock.calls)).not.toContain(PNG);
    expect(log).toHaveBeenCalledWith(
      'interpret.ok',
      expect.objectContaining({ provider: 'fake', events: 7 }),
    );
  });
});
