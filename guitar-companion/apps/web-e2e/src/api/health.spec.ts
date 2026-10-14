import { expect, test } from '@playwright/test';
import { HealthResponseSchema } from '@gsc/contracts';

test.describe('API through the SWA proxy', () => {
  test('GET /api/health returns a valid contract with the database up', async ({
    request,
  }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBe(true);
    const body = HealthResponseSchema.parse(await res.json());
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('up');
  });
});
