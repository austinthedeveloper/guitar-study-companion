import { app } from '@azure/functions';
import { interpretImport } from '@gsc/api/handlers';
import { appContext } from '../composition';
import { readJson, safe } from '../http';

app.http('imports-interpret', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'imports/interpret',
  handler: safe(async (req, ctx) => {
    const app = appContext();
    const body = await readJson(req);
    if (!body.ok) return body.res;
    return interpretImport(body.body, {
      ai: app.ai,
      timeoutMs: app.aiTimeoutMs,
      passes: app.aiPasses,
      scenario: app.e2eMode
        ? (req.headers.get('x-gsc-fake-scenario') ?? undefined)
        : undefined,
      log: (message, data) => ctx.log(message, JSON.stringify(data ?? {})),
    });
  }),
});
