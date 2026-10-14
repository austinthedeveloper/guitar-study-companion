import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { apiError, HandlerResponse } from '@gsc/api/handlers';

/** Max request body we will read (base64 of a 4 MB crop plus JSON overhead). */
export const MAX_BODY_BYTES = 6 * 1024 * 1024;

export function toHttp(res: HandlerResponse): HttpResponseInit {
  return {
    status: res.status,
    jsonBody: res.body,
    headers: { 'Cache-Control': 'no-store' },
  };
}

/** Reads a JSON body with a size cap; returns a HandlerResponse on failure. */
export async function readJson(
  req: HttpRequest,
): Promise<{ ok: true; body: unknown } | { ok: false; res: HandlerResponse }> {
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES)
    return {
      ok: false,
      res: apiError(413, 'payload_too_large', 'Request body is too large.'),
    };
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES)
    return {
      ok: false,
      res: apiError(413, 'payload_too_large', 'Request body is too large.'),
    };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      res: apiError(
        400,
        'validation_failed',
        'Request body must be valid JSON.',
      ),
    };
  }
}

/** Wraps a handler so unexpected errors become a generic 500 without leaking details. */
export function safe(
  fn: (req: HttpRequest, ctx: InvocationContext) => Promise<HandlerResponse>,
): (req: HttpRequest, ctx: InvocationContext) => Promise<HttpResponseInit> {
  return async (req, ctx) => {
    try {
      return toHttp(await fn(req, ctx));
    } catch (err) {
      ctx.error('unhandled', err instanceof Error ? err.message : String(err));
      return toHttp(
        apiError(500, 'internal', 'Something went wrong. Please try again.', {
          retryable: true,
        }),
      );
    }
  };
}
