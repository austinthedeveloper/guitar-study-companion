import { HealthResponseSchema } from './health';

describe('HealthResponseSchema', () => {
  const valid = {
    status: 'ok',
    version: '0.0.0',
    time: '2026-10-13T12:00:00.000Z',
    checks: { database: 'up', aiProvider: 'fake' },
  };

  it('accepts a well-formed response', () => {
    expect(HealthResponseSchema.parse(valid)).toEqual(valid);
  });

  it('rejects an unknown database status', () => {
    const result = HealthResponseSchema.safeParse({
      ...valid,
      checks: { ...valid.checks, database: 'maybe' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO time', () => {
    expect(
      HealthResponseSchema.safeParse({ ...valid, time: 'now' }).success,
    ).toBe(false);
  });
});
