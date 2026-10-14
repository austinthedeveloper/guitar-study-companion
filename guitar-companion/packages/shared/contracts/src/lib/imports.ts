import { z } from 'zod';
import { MAX_STRINGS, TranscriptionDraftSchema } from './tab';

export const ACCEPTED_CROP_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
/** Decoded byte limit for a submitted crop. */
export const MAX_CROP_BYTES = 4 * 1024 * 1024;
/** Client downsizes crops so the longest side is at most this. */
export const MAX_CROP_DIMENSION = 2048;

export const InterpretRequestSchema = z.object({
  image: z.object({
    mimeType: z.enum(ACCEPTED_CROP_TYPES),
    dataBase64: z
      .string()
      .min(1)
      .max(Math.ceil(MAX_CROP_BYTES / 3) * 4),
  }),
  tuningMidi: z.array(z.number().int().min(0).max(127)).min(4).max(MAX_STRINGS),
  /** User explicitly agreed to send this crop to the external AI provider. */
  consent: z.literal(true),
});
export type InterpretRequest = z.infer<typeof InterpretRequestSchema>;

export const AiUsageSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
});
export type AiUsage = z.infer<typeof AiUsageSchema>;

export const InterpretResponseSchema = z.object({
  draft: TranscriptionDraftSchema,
  provider: z.string(),
  model: z.string(),
  usage: AiUsageSchema.optional(),
  /** Events dropped by server validation, explained in draft.uncertainties. */
  rejectedEventCount: z.number().int().min(0),
});
export type InterpretResponse = z.infer<typeof InterpretResponseSchema>;
