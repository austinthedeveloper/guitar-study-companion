import { app } from '@azure/functions';
import { getHealth } from '@gsc/api/handlers';
import { appContext } from '../composition';

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => {
    const ctx = appContext();
    const { status, body } = await getHealth({
      version: ctx.version,
      aiProviderName: ctx.ai.name,
      pingDatabase: () => ctx.mongo.ping(),
    });
    return { status, jsonBody: body };
  },
});
