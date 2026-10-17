import { z } from 'zod';
import { ExplanationSchema } from './explanation';
import { MusicalContextSchema, SourceReferenceSchema } from './source';
import { TabEventSchema, TICKS_PER_QUARTER } from './tab';

/** A library tag: short, lower-case, trimmed. */
export const TagSchema = z.string().trim().toLowerCase().min(1).max(30);
export const TagsSchema = z
  .array(TagSchema)
  .max(20)
  .transform((tags) => [...new Set(tags)]);

export const CreatePhraseRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  source: SourceReferenceSchema,
  context: MusicalContextSchema,
  rhythmKnown: z.boolean(),
  ticksPerQuarter: z.literal(TICKS_PER_QUARTER).default(TICKS_PER_QUARTER),
  events: z.array(TabEventSchema).min(1).max(256),
  /** The player's own annotations. */
  notes: z.string().max(5000).optional(),
  tags: TagsSchema.default([]),
  /** Which provider produced the draft the user corrected, if any. */
  draftProvider: z.string().max(40).optional(),
  /** Set when this phrase was made from another (transposed or varied). */
  derivedFrom: z
    .object({
      phraseId: z.string().min(1).max(64),
      revision: z.number().int().min(1),
      /** Semitones it was moved by (0 for a variation in the same key). */
      semitones: z.number().int().min(-24).max(24),
      /** What was done, e.g. "Transposed to C major" or "Hold the targets". */
      change: z.string().trim().min(1).max(200),
    })
    .optional(),
});
/** What a client sends (defaults may be omitted). */
export type CreatePhraseRequest = z.input<typeof CreatePhraseRequestSchema>;
/** A validated create request, as stored (defaults applied). */
export type NewPhrase = z.output<typeof CreatePhraseRequestSchema>;

export const PhraseSchema = CreatePhraseRequestSchema.extend({
  id: z.string(),
  revision: z.number().int().min(1),
  favorite: z.boolean().default(false),
  /** Latest AI explanation; stale when its phraseRevision < revision. */
  explanation: ExplanationSchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Phrase = z.infer<typeof PhraseSchema>;

/** Searchable facts computed from the verified notes (music-domain phraseFacets). */
export const PhraseFacetsSchema = z.object({
  key: z.string().nullable(),
  techniques: z.array(z.string()),
  steps: z.array(z.string()),
});

export const PhraseSummarySchema = PhraseSchema.pick({
  id: true,
  title: true,
  source: true,
  createdAt: true,
  tags: true,
  favorite: true,
}).extend({ facets: PhraseFacetsSchema });
export type PhraseSummary = z.infer<typeof PhraseSummarySchema>;

/** Library fields that don't change the music (no revision bump). */
export const UpdatePhraseMetaRequestSchema = z
  .object({
    tags: TagsSchema.optional(),
    favorite: z.boolean().optional(),
    notes: z.string().max(5000).optional(),
  })
  .refine((m) => Object.keys(m).length > 0, 'Nothing to update.');
export type UpdatePhraseMetaRequest = z.infer<
  typeof UpdatePhraseMetaRequestSchema
>;

/** Library search; every field optional, all given fields must match. */
export const PhraseQuerySchema = z.object({
  /** Words in the title, book, song, author, or notes. */
  q: z.string().trim().max(100).optional(),
  /** A key as typed ("Am", "A minor"); matched by meaning. */
  key: z.string().trim().max(20).optional(),
  technique: z.string().trim().max(30).optional(),
  tag: TagSchema.optional(),
  /** Consecutive melodic steps, e.g. "m3 down, M2 up". */
  interval: z.string().trim().max(100).optional(),
  favorite: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type PhraseQuery = z.input<typeof PhraseQuerySchema>;
