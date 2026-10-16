import { app } from '@azure/functions';
import {
  createPlan,
  getLatestPlan,
  getSession,
  saveSession,
} from '@gsc/api/handlers';
import { appContext, currentUserId } from '../composition';
import { readJson, safe } from '../http';

app.http('plans-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'phrases/{id}/plans',
  handler: safe(async (req, ctx) => {
    const app = appContext();
    const body = await readJson(req);
    if (!body.ok) return body.res;
    return createPlan(req.params['id'] ?? '', body.body, {
      phrases: await app.phrases(),
      practice: await app.practice(),
      userId: currentUserId(),
      ai: app.ai,
      timeoutMs: app.aiTimeoutMs,
      scenario: app.e2eMode
        ? (req.headers.get('x-gsc-fake-scenario') ?? undefined)
        : undefined,
      log: (message, data) => ctx.log(message, JSON.stringify(data ?? {})),
    });
  }),
});

app.http('plans-latest', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'phrases/{id}/plans/latest',
  handler: safe(async (req) =>
    getLatestPlan(req.params['id'] ?? '', {
      practice: await appContext().practice(),
      userId: currentUserId(),
    }),
  ),
});

app.http('plan-session-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'plans/{planId}/session',
  handler: safe(async (req) =>
    getSession(req.params['planId'] ?? '', {
      practice: await appContext().practice(),
      userId: currentUserId(),
    }),
  ),
});

app.http('plan-session-save', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'plans/{planId}/session',
  handler: safe(async (req) => {
    const body = await readJson(req);
    if (!body.ok) return body.res;
    return saveSession(req.params['planId'] ?? '', body.body, {
      practice: await appContext().practice(),
      userId: currentUserId(),
    });
  }),
});
