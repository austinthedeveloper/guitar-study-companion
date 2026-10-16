import { z } from 'zod';

/**
 * An AI explanation of a verified phrase (AI_CONTRACTS "Analysis output").
 * Observations cite the notes they describe; interpretations state the
 * assumption they rest on, so the two are never presented the same way.
 */
export const ExplanationPointSchema = z.object({
  kind: z.enum(['observation', 'interpretation']),
  text: z.string().trim().min(1).max(400),
  /** Event ids the point is about. Observations always cite at least one. */
  eventIds: z.array(z.string().min(1).max(64)).max(64),
  /** What an interpretation takes for granted, e.g. "the band plays A7 here". */
  assumption: z.string().trim().max(300).optional(),
});
export type ExplanationPoint = z.infer<typeof ExplanationPointSchema>;

export const ExplanationSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  points: z.array(ExplanationPointSchema).max(10),
  /** Phrase revision the explanation was built from; older means stale. */
  phraseRevision: z.number().int().min(1),
  provider: z.string(),
  model: z.string(),
  createdAt: z.iso.datetime(),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

export const ExplainRequestSchema = z.object({
  /** Must match the stored phrase, so the explanation describes what the user sees. */
  revision: z.number().int().min(1),
});
export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;
