export type AiErrorCode = 'ai_unavailable' | 'ai_invalid_output' | 'ai_timeout';

/** Recoverable AI failure; the user's corrected work is never lost because of it. */
export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AiError';
  }
}
