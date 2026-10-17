import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { retry, timer } from 'rxjs';

/** Statuses worth another try: gateway trouble and no connection at all. */
const TRANSIENT = new Set([0, 502, 503, 504]);
export const RETRY_DELAYS_MS = [300, 900];

/**
 * Retries reads (GET) that failed for transient reasons, with backoff.
 * Writes are never retried automatically: a timed-out save may have
 * succeeded, and AI requests cost money.
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) =>
  req.method !== 'GET'
    ? next(req)
    : next(req).pipe(
        retry({
          count: RETRY_DELAYS_MS.length,
          delay: (err: unknown, attempt) => {
            if (
              !(err instanceof HttpErrorResponse) ||
              !TRANSIENT.has(err.status)
            )
              throw err;
            return timer(RETRY_DELAYS_MS[attempt - 1]);
          },
        }),
      );
