import { z } from 'zod';

export const DatabaseStatusSchema = z.enum(['up', 'down', 'not-configured']);
export type DatabaseStatus = z.infer<typeof DatabaseStatusSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string().min(1),
  time: z.iso.datetime(),
  checks: z.object({
    database: DatabaseStatusSchema,
    aiProvider: z.string().min(1),
  }),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
