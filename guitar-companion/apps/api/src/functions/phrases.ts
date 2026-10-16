import { app } from '@azure/functions';
import {
  createPhrase,
  explainPhraseHandler,
  getPhrase,
  listPhrases,
  updateHarmony,
} from '@gsc/api/handlers';
import { appContext, currentUserId } from '../composition';
import { readJson, safe } from '../http';

app.http('phrases-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'phrases',
  handler: safe(async (req) => {
    const body = await readJson(req);
    if (!body.ok) return body.res;
    return createPhrase(body.body, {
      store: await appContext().phrases(),
      userId: currentUserId(),
    });
  }),
});

app.http('phrases-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'phrases',
  handler: safe(async () =>
    listPhrases({
      store: await appContext().phrases(),
      userId: currentUserId(),
    }),
  ),
});

app.http('phrases-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'phrases/{id}',
  handler: safe(async (req) =>
    getPhrase(req.params['id'] ?? '', {
      store: await appContext().phrases(),
      userId: currentUserId(),
    }),
  ),
});

app.http('phrases-update-harmony', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'phrases/{id}/harmony',
  handler: safe(async (req) => {
    const body = await readJson(req);
    if (!body.ok) return body.res;
    return updateHarmony(req.params['id'] ?? '', body.body, {
      store: await appContext().phrases(),
      userId: currentUserId(),
    });
  }),
});

app.http('phrases-explain', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'phrases/{id}/explanation',
  handler: safe(async (req, ctx) => {
    const app = appContext();
    const body = await readJson(req);
    if (!body.ok) return body.res;
    return explainPhraseHandler(req.params['id'] ?? '', body.body, {
      store: await app.phrases(),
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
