import { app } from '@azure/functions';
import { getPracticeHistory, getReview } from '@gsc/api/handlers';
import { appContext, currentUserId } from '../composition';
import { safe } from '../http';

app.http('review', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'review',
  handler: safe(async () =>
    getReview({
      phrases: await appContext().phrases(),
      practice: await appContext().practice(),
      userId: currentUserId(),
    }),
  ),
});

app.http('plans-history', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'phrases/{id}/plans',
  handler: safe(async (req) =>
    getPracticeHistory(req.params['id'] ?? '', {
      phrases: await appContext().phrases(),
      practice: await appContext().practice(),
      userId: currentUserId(),
    }),
  ),
});
