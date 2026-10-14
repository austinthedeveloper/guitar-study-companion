import {
  DatabaseStatus,
  HealthResponse,
  HealthResponseSchema,
} from '@gsc/contracts';
import { HandlerResponse } from './http';

export interface HealthDeps {
  version: string;
  aiProviderName: string;
  pingDatabase: () => Promise<DatabaseStatus>;
  now?: () => Date;
}

export async function getHealth(
  deps: HealthDeps,
): Promise<HandlerResponse<HealthResponse>> {
  const database = await deps.pingDatabase();
  const body = HealthResponseSchema.parse({
    status: database === 'down' ? 'degraded' : 'ok',
    version: deps.version,
    time: (deps.now ?? (() => new Date()))().toISOString(),
    checks: { database, aiProvider: deps.aiProviderName },
  });
  return { status: 200, body };
}
