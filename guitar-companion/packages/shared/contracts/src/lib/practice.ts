import { z } from 'zod';
import { MAX_FRET, MAX_STRINGS, TechniqueSchema } from './tab';

/**
 * Practice plans (M3, ADR-011). Rules build the exercises from verified
 * notes; AI may only add coaching text. Every exercise refers to phrase
 * notes by event id so it can be checked against the phrase.
 */

export const EXERCISE_KINDS = [
  'isolate',
  'technique',
  'slow',
  'connect',
  'apply',
] as const;
export const ExerciseKindSchema = z.enum(EXERCISE_KINDS);
export type ExerciseKind = z.infer<typeof ExerciseKindSchema>;

/** A note that isn't in the phrase, e.g. the fret a bend should reach. */
export const ReferenceNoteSchema = z.object({
  stringIndex: z
    .number()
    .int()
    .min(0)
    .max(MAX_STRINGS - 1),
  fret: z.number().int().min(0).max(MAX_FRET),
  label: z.string().trim().min(1).max(80),
});
export type ReferenceNote = z.infer<typeof ReferenceNoteSchema>;

/** Metronome plan: start slow, step up after clean repetitions, stop at target. */
export const TempoRampSchema = z
  .object({
    startBpm: z.number().int().min(30).max(300),
    targetBpm: z.number().int().min(30).max(300),
    stepBpm: z.number().int().min(1).max(40),
    /** False when the phrase has no rhythm: one note per click, not the real rhythm. */
    rhythmic: z.boolean(),
  })
  .refine((t) => t.startBpm <= t.targetBpm, 'Start tempo exceeds target');
export type TempoRamp = z.infer<typeof TempoRampSchema>;

export const ExerciseSchema = z.object({
  id: z.string().min(1).max(40),
  kind: ExerciseKindSchema,
  title: z.string().trim().min(1).max(120),
  objective: z.string().trim().min(1).max(300),
  /** Phrase notes practised, in playing order. */
  eventIds: z.array(z.string().min(1).max(64)).min(1).max(256),
  referenceNotes: z.array(ReferenceNoteSchema).max(8).default([]),
  technique: TechniqueSchema.optional(),
  /** Chord to play over, for "apply" exercises. */
  chord: z.string().trim().max(40).optional(),
  tempo: TempoRampSchema,
  repetitions: z.number().int().min(1).max(50),
  successCriterion: z.string().trim().min(1).max(200),
  /** Rule-written steps; always shown. */
  instructions: z.array(z.string().trim().min(1).max(300)).max(6),
  /** AI coaching tips, shown apart from the rule steps; empty without AI. */
  coaching: z.array(z.string().trim().min(1).max(300)).max(4).default([]),
  minutes: z.number().int().min(1).max(30),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const PlanSettingsSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  /** Session length the plan should fit. */
  minutes: z.number().int().min(5).max(60).default(15),
  focus: z
    .enum(['balanced', 'technique', 'accuracy', 'harmony'])
    .default('balanced'),
});
export type PlanSettings = z.infer<typeof PlanSettingsSchema>;

export const RejectedExerciseSchema = z.object({
  title: z.string(),
  reasons: z.array(z.string()).min(1),
});
export type RejectedExercise = z.infer<typeof RejectedExerciseSchema>;

export const PracticePlanSchema = z.object({
  id: z.string(),
  phraseId: z.string(),
  /** Phrase revision the plan was built from; older means stale. */
  phraseRevision: z.number().int().min(1),
  settings: PlanSettingsSchema,
  exercises: z.array(ExerciseSchema).min(1).max(30),
  /** Exercises the review step removed, and why. */
  rejected: z.array(RejectedExerciseSchema).default([]),
  /** Who wrote the coaching text; null when only rule text is used. */
  coachedBy: z.object({ provider: z.string(), model: z.string() }).nullable(),
  createdAt: z.iso.datetime(),
});
export type PracticePlan = z.infer<typeof PracticePlanSchema>;

export const CreatePlanRequestSchema = z.object({
  revision: z.number().int().min(1),
  settings: PlanSettingsSchema,
});
export type CreatePlanRequest = z.infer<typeof CreatePlanRequestSchema>;

/** Self-reported progress; no audio grading (M3 scope). */
export const ExerciseProgressSchema = z.object({
  completedAt: z.iso.datetime().nullable(),
  /** Highest tempo the player reports playing cleanly. */
  bestBpm: z.number().int().min(30).max(300).nullable(),
});
export type ExerciseProgress = z.infer<typeof ExerciseProgressSchema>;

export const PracticeSessionSchema = z.object({
  planId: z.string(),
  progress: z.record(z.string(), ExerciseProgressSchema),
  notes: z.string().max(5000),
  updatedAt: z.iso.datetime(),
});
export type PracticeSession = z.infer<typeof PracticeSessionSchema>;

export const UpdateSessionRequestSchema = PracticeSessionSchema.pick({
  progress: true,
  notes: true,
});
export type UpdateSessionRequest = z.infer<typeof UpdateSessionRequestSchema>;
