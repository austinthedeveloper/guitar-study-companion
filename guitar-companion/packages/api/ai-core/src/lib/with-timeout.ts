import { AiError } from './errors';

/**
 * Runs one provider call with an abort signal that fires after `timeoutMs`.
 * Rejects with ai_timeout at the deadline; any other non-AiError failure
 * becomes ai_unavailable, so callers only ever see AiError.
 */
export async function withAiTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new AiError(
          'ai_timeout',
          `AI provider did not respond within ${Math.round(timeoutMs / 1000)}s`,
        ),
      );
    }, timeoutMs);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } catch (err) {
    if (err instanceof AiError) throw err;
    throw new AiError('ai_unavailable', 'AI provider request failed', {
      cause: err,
    });
  } finally {
    clearTimeout(timer);
  }
}
