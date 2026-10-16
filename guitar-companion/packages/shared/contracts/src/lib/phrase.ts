import { z } from 'zod';
import { ExplanationSchema } from './explanation';
import { MusicalContextSchema, SourceReferenceSchema } from './source';
import { TabEventSchema, TICKS_PER_QUARTER } from './tab';

export const CreatePhraseRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  source: SourceReferenceSchema,
  context: MusicalContextSchema,
  rhythmKnown: z.boolean(),
  ticksPerQuarter: z.literal(TICKS_PER_QUARTER).default(TICKS_PER_QUARTER),
  events: z.array(TabEventSchema).min(1).max(256),
  notes: z.string().max(5000).optional(),
  /** Which provider produced the draft the user corrected, if any. */
  draftProvider: z.string().max(40).optional(),
});
export type CreatePhraseRequest = z.infer<typeof CreatePhraseRequestSchema>;

export const PhraseSchema = CreatePhraseRequestSchema.extend({
  id: z.string(),
  revision: z.number().int().min(1),
  /** Latest AI explanation; stale when its phraseRevision < revision. */
  explanation: ExplanationSchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Phrase = z.infer<typeof PhraseSchema>;

export const PhraseSummarySchema = PhraseSchema.pick({
  id: true,
  title: true,
  source: true,
  createdAt: true,
});
export type PhraseSummary = z.infer<typeof PhraseSummarySchema>;
