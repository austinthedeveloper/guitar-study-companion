import { z } from 'zod';

export const API_ERROR_CODES = [
  'validation_failed',
  'payload_too_large',
  'unsupported_media_type',
  'consent_required',
  'not_found',
  'conflict',
  'ai_unavailable',
  'ai_invalid_output',
  'ai_timeout',
  'ai_image_unreadable',
  'rate_limited',
  'internal',
] as const;
export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    /** Field-level issues for validation errors. */
    issues: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional(),
    retryable: z.boolean(),
    /** Reference for unexpected errors, matching the server logs. */
    errorId: z.string().max(40).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
