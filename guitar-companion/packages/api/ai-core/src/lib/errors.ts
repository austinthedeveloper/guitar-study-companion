import { AiUsage } from '@gsc/contracts';

export type AiErrorCode =
  'ai_unavailable' | 'ai_invalid_output' | 'ai_timeout' | 'ai_image_unreadable';

/** Recoverable AI failure; the user's corrected work is never lost because of it. */
export class AiError extends Error {
  /** Tokens spent before the failure (e.g. a reading judged unreadable). */
  readonly usage?: AiUsage;

  constructor(
    readonly code: AiErrorCode,
    message: string,
    options?: { cause?: unknown; usage?: AiUsage },
  ) {
    super(message, options);
    this.name = 'AiError';
    this.usage = options?.usage;
  }
}
