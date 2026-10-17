import { z } from 'zod';
import { PlanSettingsSchema } from './practice';

/** Why a phrase is in the review queue, most urgent first. */
export const REVIEW_KINDS = [
  'unfinished',
  'due',
  'stale-plan',
  'stale-explanation',
  'not-started',
] as const;

export const ReviewItemSchema = z.object({
  phraseId: z.string(),
  title: z.string(),
  kind: z.enum(REVIEW_KINDS),
  detail: z.string(),
  /** Last activity this item is about, when there is one. */
  at: z.iso.datetime().nullable(),
});
export type ReviewItem = z.infer<typeof ReviewItemSchema>;

/** One practice plan for a phrase, with how far the player got. */
export const PracticeHistoryEntrySchema = z.object({
  planId: z.string(),
  createdAt: z.iso.datetime(),
  settings: PlanSettingsSchema,
  exercises: z.number().int().min(0),
  completed: z.number().int().min(0),
  lastPracticed: z.iso.datetime().nullable(),
  /** Built for an older revision of the phrase. */
  stale: z.boolean(),
});
export type PracticeHistoryEntry = z.infer<typeof PracticeHistoryEntrySchema>;
