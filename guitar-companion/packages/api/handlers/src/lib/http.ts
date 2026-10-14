import { ApiError, ApiErrorCode } from '@gsc/contracts';
import { z } from 'zod';

/** Framework-neutral response shape; the Functions shell maps it to HttpResponseInit. */
export interface HandlerResponse<T = unknown> {
  status: number;
  body: T;
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  options: {
    retryable?: boolean;
    issues?: { path: string; message: string }[];
  } = {},
): HandlerResponse<ApiError> {
  return {
    status,
    body: {
      error: {
        code,
        message,
        retryable: options.retryable ?? false,
        ...(options.issues ? { issues: options.issues } : {}),
      },
    },
  };
}

export function zodIssues(
  error: z.ZodError,
): { path: string; message: string }[] {
  return error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
  }));
}
