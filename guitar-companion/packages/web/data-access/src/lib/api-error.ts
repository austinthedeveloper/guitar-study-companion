import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, ApiErrorSchema } from '@gsc/contracts';

/** Normalized client-side error with a user-facing message. */
export interface ClientError {
  code: ApiError['error']['code'] | 'network';
  message: string;
  retryable: boolean;
  issues: { path: string; message: string }[];
  status: number;
}

export function toClientError(err: unknown): ClientError {
  if (err instanceof HttpErrorResponse) {
    const parsed = ApiErrorSchema.safeParse(err.error);
    if (parsed.success) {
      const e = parsed.data.error;
      return {
        code: e.code,
        message: e.errorId
          ? `${e.message} (Reference: ${e.errorId})`
          : e.message,
        retryable: e.retryable,
        issues: e.issues ?? [],
        status: err.status,
      };
    }
    if (err.status === 0) {
      return {
        code: 'network',
        message:
          'Could not reach the server. Check your connection and try again.',
        retryable: true,
        issues: [],
        status: 0,
      };
    }
    return {
      code: 'internal',
      message: 'Something went wrong. Please try again.',
      retryable: true,
      issues: [],
      status: err.status,
    };
  }
  return {
    code: 'internal',
    message: 'Something went wrong. Please try again.',
    retryable: true,
    issues: [],
    status: 0,
  };
}
