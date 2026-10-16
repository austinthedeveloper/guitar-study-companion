import {
  AiProvider,
  createAiProviderSafely,
  DEFAULT_AI_PASSES,
  DEFAULT_AI_TIMEOUT_MS,
} from '@gsc/api/ai-core';
import {
  MongoConnection,
  PhraseRepository,
  PracticeRepository,
} from '@gsc/api/data-access';

/** Per-worker singletons built from app settings. */
export interface AppContext {
  version: string;
  ai: AiProvider;
  aiTimeoutMs: number;
  aiPasses: number;
  mongo: MongoConnection;
  e2eMode: boolean;
  phrases(): Promise<PhraseRepository>;
  practice(): Promise<PracticeRepository>;
}

let context: AppContext | null = null;

export function appContext(): AppContext {
  if (context) return context;
  const mongo = new MongoConnection(
    process.env['MONGODB_URI'],
    process.env['MONGODB_DB'] || 'gsc',
  );
  let repo: PhraseRepository | null = null;
  let practiceRepo: PracticeRepository | null = null;
  context = {
    version: process.env['APP_VERSION'] || 'dev',
    ai: createAiProviderSafely(process.env, (reason) =>
      console.error(`[ai] provider misconfigured: ${reason}`),
    ),
    aiTimeoutMs: Number(process.env['AI_TIMEOUT_MS']) || DEFAULT_AI_TIMEOUT_MS,
    aiPasses: Number(process.env['AI_PASSES']) || DEFAULT_AI_PASSES,
    mongo,
    e2eMode: process.env['E2E_MODE'] === 'true',
    async phrases() {
      if (repo) return repo;
      const db = await mongo.db();
      if (!db) throw new Error('MONGODB_URI is not configured');
      repo = new PhraseRepository(db);
      return repo;
    },
    async practice() {
      if (practiceRepo) return practiceRepo;
      const db = await mongo.db();
      if (!db) throw new Error('MONGODB_URI is not configured');
      practiceRepo = new PracticeRepository(db);
      return practiceRepo;
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
