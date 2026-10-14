import { z } from 'zod';
import { MAX_FRET, MAX_STRINGS } from './tab';

export const SourceReferenceSchema = z.object({
  bookTitle: z.string().trim().min(1).max(200),
  page: z.string().trim().max(20).optional(),
  songTitle: z.string().trim().max(200).optional(),
  author: z.string().trim().max(200).optional(),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const MusicalContextSchema = z.object({
  /** One MIDI pitch per string, index 0 = highest string. */
  tuningMidi: z.array(z.number().int().min(0).max(127)).min(4).max(MAX_STRINGS),
  capo: z.number().int().min(0).max(MAX_FRET).default(0),
  key: z.string().trim().max(20).optional(),
  /** Free-text chord context, e.g. "G D/F# Em C" (structured in M2). */
  chords: z.string().trim().max(500).optional(),
  tempoBpm: z.number().int().min(20).max(400).optional(),
});
export type MusicalContext = z.infer<typeof MusicalContextSchema>;
