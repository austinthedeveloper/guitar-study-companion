import { AiProvider, createAiProvider } from '@gsc/api/ai-core';
import { MongoConnection } from '@gsc/api/data-access';

/** Per-worker singletons built from app settings. */
export interface AppContext {
  version: string;
  ai: AiProvider;
  mongo: MongoConnection;
}

let context: AppContext | null = null;

export function appContext(): AppContext {
  context ??= {
    version: process.env['APP_VERSION'] || 'dev',
    ai: createAiProvider(process.env),
    mongo: new MongoConnection(
      process.env['MONGODB_URI'],
      process.env['MONGODB_DB'] || 'gsc',
    ),
  };
  return context;
}
