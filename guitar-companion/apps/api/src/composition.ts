import {
  AiProvider,
  createAiProvider,
  DEFAULT_AI_TIMEOUT_MS,
} from '@gsc/api/ai-core';
import { MongoConnection, PhraseRepository } from '@gsc/api/data-access';

/** Per-worker singletons built from app settings. */
export interface AppContext {
  version: string;
  ai: AiProvider;
  aiTimeoutMs: number;
  mongo: MongoConnection;
  e2eMode: boolean;
  phrases(): Promise<PhraseRepository>;
}

let context: AppContext | null = null;

export function appContext(): AppContext {
  if (context) return context;
  const mongo = new MongoConnection(
    process.env['MONGODB_URI'],
    process.env['MONGODB_DB'] || 'gsc',
  );
  let repo: PhraseRepository | null = null;
  context = {
    version: process.env['APP_VERSION'] || 'dev',
    ai: createAiProvider(process.env),
    aiTimeoutMs: Number(process.env['AI_TIMEOUT_MS']) || DEFAULT_AI_TIMEOUT_MS,
    mongo,
    e2eMode: process.env['E2E_MODE'] === 'true',
    async phrases() {
      if (repo) return repo;
      const db = await mongo.db();
      if (!db) throw new Error('MONGODB_URI is not configured');
      repo = new PhraseRepository(db);
      return repo;
    },
  };
  return context;
}

/**
 * Until authentication lands (M5), all data belongs to a single local user.
 * Handlers already take userId so ownership checks are in place.
 */
export function currentUserId(): string {
  return 'local';
}
