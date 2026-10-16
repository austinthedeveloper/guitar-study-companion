import { Exercise, Phrase } from '@gsc/contracts';
import { z } from 'zod';
import { AiProvider } from './ai-provider';
import { AiError } from './errors';
import { buildExplainFacts } from './explain';
import { withAiTimeout } from './with-timeout';

/**
 * AI coaching tips for rule-built exercises (ADR-011). The model may only
 * add tips; notes, order, and tempos stay as the rules made them. Tips
 * that name a fret the exercise doesn't use are dropped.
 */

export interface CoachFacts {
  key: string | null;
  chords: string | null;
  rhythmKnown: boolean;
  exercises: {
    id: string;
    kind: string;
    title: string;
    objective: string;
    technique: string | null;
    chord: string | null;
    notes: {
      step: number;
      string: number;
      fret: number | null;
      name: string | null;
      techniques: string[];
      role?: string;
      bendTo?: string;
    }[];
    referenceFrets: number[];
    tempo: string;
    steps: string[];
  }[];
}

export function buildCoachFacts(
  phrase: Phrase,
  exercises: readonly Exercise[],
): CoachFacts {
  const facts = buildExplainFacts(phrase);
  const notes = new Map(
    facts.steps.flatMap((s) =>
      s.notes.map((n) => [n.id, { ...n, step: s.step }] as const),
    ),
  );
  return {
    key: facts.key.understood,
    chords: facts.chords.given,
    rhythmKnown: phrase.rhythmKnown,
    exercises: exercises.map((x) => ({
      id: x.id,
      kind: x.kind,
      title: x.title,
      objective: x.objective,
      technique: x.technique ?? null,
      chord: x.chord ?? null,
      notes: x.eventIds.flatMap((id) => {
        const n = notes.get(id);
        if (!n) return [];
        return [
          {
            step: n.step,
            string: n.string,
            fret: n.fret,
            name: n.name,
            techniques: n.techniques,
            ...(n.role ? { role: n.role } : {}),
            ...(n.bendTo ? { bendTo: n.bendTo } : {}),
          },
        ];
      }),
      referenceFrets: x.referenceNotes.map((r) => r.fret),
      tempo: `${x.tempo.startBpm}→${x.tempo.targetBpm} bpm`,
      steps: x.instructions,
    })),
  };
}

export const COACH_SYSTEM_PROMPT = `You are a guitar teacher adding short coaching tips to practice exercises.
The exercises, their notes, and tempos are fixed and already correct. You only add tips.`;

export function coachUserPrompt(facts: CoachFacts): string {
  return `Add 1 to 3 coaching tips to each exercise.

Rules
- Tips are practical and specific to the exercise's notes and technique: fingering, picking, muting, listening for pitch, relaxation, what usually goes wrong.
- Never change or add notes, frets, tempos, or repetitions, and never contradict the exercise's steps. Mention a fret only if it is in that exercise's notes or referenceFrets.
- If rhythmKnown is false, don't describe rhythm or note lengths.
- No medical or injury claims. One sentence per tip, at most 200 characters.
- Return every exercise id exactly as given.

Exercises (JSON)
${JSON.stringify(facts)}`;
}

export const COACHING_WIRE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['exercises'],
  properties: {
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'tips'],
        properties: {
          id: { type: 'string' },
          tips: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

const WireSchema = z.object({
  exercises: z.array(z.object({ id: z.string(), tips: z.array(z.string()) })),
});

const MAX_TIPS = 3;
const MAX_TIP_LENGTH = 300;

export interface CoachResult {
  /** Tips by exercise id; exercises the model skipped are absent. */
  tips: Record<string, string[]>;
  droppedTips: number;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export async function coachExercises(
  provider: AiProvider,
  phrase: Phrase,
  exercises: readonly Exercise[],
  options: { timeoutMs?: number; scenario?: string } = {},
): Promise<CoachResult> {
  const facts = buildCoachFacts(phrase, exercises);
  const raw = await withAiTimeout(options.timeoutMs ?? 60_000, (signal) =>
    provider.generateJson({
      task: 'coach-exercises',
      system: COACH_SYSTEM_PROMPT,
      prompt: coachUserPrompt(facts),
      schemaName: 'exercise_coaching',
      schema: COACHING_WIRE_JSON_SCHEMA as unknown as Record<string, unknown>,
      data: facts,
      signal,
      scenario: options.scenario,
    }),
  );
  const wire = WireSchema.safeParse(raw.json);
  if (!wire.success)
    throw new AiError(
      'ai_invalid_output',
      'AI provider returned coaching that does not match the schema',
      { cause: wire.error },
    );

  const allowedFrets = new Map(
    facts.exercises.map((x) => [
      x.id,
      new Set([
        ...x.notes.flatMap((n) => (n.fret === null ? [] : [n.fret])),
        ...x.referenceFrets,
      ]),
    ]),
  );
  const tips: Record<string, string[]> = {};
  let droppedTips = 0;
  for (const item of wire.data.exercises) {
    const allowed = allowedFrets.get(item.id);
    if (!allowed || tips[item.id]) {
      droppedTips += item.tips.length;
      continue;
    }
    const kept: string[] = [];
    for (const tip of item.tips.map((t) => t.trim())) {
      const frets = [...tip.matchAll(/\bfrets?\s+(\d+)/gi)].map((m) =>
        Number(m[1]),
      );
      const ok =
        tip.length > 0 &&
        tip.length <= MAX_TIP_LENGTH &&
        frets.every((f) => allowed.has(f)) &&
        kept.length < MAX_TIPS;
      if (ok) kept.push(tip);
      else droppedTips++;
    }
    if (kept.length) tips[item.id] = kept;
  }
  return { tips, droppedTips, model: raw.model, usage: raw.usage };
}
