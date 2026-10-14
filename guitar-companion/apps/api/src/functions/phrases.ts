import { app } from '@azure/functions';
import { createPhrase, getPhrase, listPhrases } from '@gsc/api/handlers';
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
