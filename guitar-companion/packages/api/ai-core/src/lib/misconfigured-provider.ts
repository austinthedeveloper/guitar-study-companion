import {
  AiEnv,
  AiProvider,
  RawInterpretResult,
  RawJsonResult,
} from './ai-provider';
import { AiError } from './errors';
import { createAiProvider } from './registry';

/**
 * Stand-in used when the configured provider can't be created (e.g. a
 * missing API key). Keeps the rest of the API working and turns every AI
 * request into a clear, retryable "unavailable" error.
 */
export class MisconfiguredAiProvider implements AiProvider {
  readonly name: string;

  constructor(
    requested: string,
    readonly reason: string,
  ) {
    this.name = `${requested} (misconfigured)`;
  }

  async interpretTab(): Promise<RawInterpretResult> {
    throw this.error();
  }

  async generateJson(): Promise<RawJsonResult> {
    throw this.error();
  }

  private error(): AiError {
    return new AiError(
      'ai_unavailable',
      `AI provider is misconfigured: ${this.reason}`,
    );
  }
}

/** Like createAiProvider, but never throws; misconfiguration is reported instead. */
export function createAiProviderSafely(
  env: AiEnv,
  onError?: (message: string) => void,
): AiProvider {
  try {
    return createAiProvider(env);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    onError?.(reason);
    return new MisconfiguredAiProvider(
      env['AI_PROVIDER']?.trim() || 'unknown',
      reason,
    );
  }
}
