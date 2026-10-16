import {
  ExplanationPoint,
  ExplanationPointSchema,
  Phrase,
} from '@gsc/contracts';
import {
  analyzeNotes,
  candidateScales,
  describeMoves,
  describeStep,
  formatKey,
  harmonize,
  midiToNoteName,
  NoteRole,
  parseKey,
} from '@gsc/music-domain';
import { z } from 'zod';
import { AiProvider } from './ai-provider';
import { AiError } from './errors';
import { withAiTimeout } from './with-timeout';

/** Versioned so stored explanations can record which prompt produced them. */
export const EXPLAIN_PROMPT_VERSION = 'explain-v1';

/** The verified facts and stated assumptions the explanation may use. */
export interface ExplainFacts {
  title: string;
  rhythmKnown: boolean;
  tuning: string;
  capo: number;
  key: { given: string | null; understood: string | null };
  chords: {
    given: string | null;
    notUnderstood: string[];
    /** placed: by the user. assumed: one chord, whole phrase. unknown: no placement. */
    placement: 'placed' | 'assumed' | 'unknown';
  };
  steps: {
    step: number;
    chord: string | null;
    notes: {
      id: string;
      /** 1 = highest string. */
      string: number;
      fret: number | null;
      name: string | null;
      techniques: string[];
      /** Slurs and slides spelled out, e.g. "slide from fret 6 to fret 5". */
      moves?: string[];
      bendTo?: string;
      role?: string;
      bendToRole?: string;
    }[];
    interval: string | null;
  }[];
  range: string | null;
  pitchesUsed: string[];
  scales: {
    certainty: string;
    candidates: { name: string; outside: string[]; reasons: string[] }[];
  };
}

const roleText = (r: NoteRole | null | undefined) =>
  r ? `${r.label}${r.chordTone ? ' (chord tone)' : ''}` : undefined;

/** Computes everything the model is allowed to talk about, in code. */
export function buildExplainFacts(phrase: Phrase): ExplainFacts {
  const ctx = phrase.context;
  const key = parseKey(ctx.key);
  const analysis = analyzeNotes({
    events: phrase.events,
    tuningMidi: ctx.tuningMidi,
    capo: ctx.capo,
    key,
  });
  const harmony = harmonize({
    analysis,
    chords: ctx.chords,
    chordChanges: ctx.chordChanges,
  });
  const scales = candidateScales({ analysis, key, chords: harmony.chords });
  const byId = new Map(phrase.events.map((e) => [e.id, e]));
  return {
    title: phrase.title,
    rhythmKnown: phrase.rhythmKnown,
    tuning: ctx.tuningMidi
      .map((m) => midiToNoteName(m).replace(/-?\d+$/, ''))
      .reverse()
      .join(' '),
    capo: ctx.capo,
    key: { given: ctx.key ?? null, understood: key ? formatKey(key) : null },
    chords: {
      given: ctx.chords ?? null,
      notUnderstood: harmony.progression
        .filter((p) => !p.chord)
        .map((p) => p.text),
      placement: !harmony.changes.length
        ? 'unknown'
        : harmony.assumed
          ? 'assumed'
          : 'placed',
    },
    steps: analysis.columns.map((col, i) => ({
      step: i + 1,
      chord: harmony.columnChords[i],
      notes: col.notes.map((n) => {
        const e = byId.get(n.eventId);
        const roles = harmony.roles[n.eventId];
        return {
          id: n.eventId,
          string: (e?.stringIndex ?? 0) + 1,
          fret: e?.fret ?? null,
          name: n.name,
          techniques: [...(e?.techniques ?? [])],
          ...(e && describeMoves(phrase.events, e).length
            ? { moves: describeMoves(phrase.events, e) }
            : {}),
          ...(n.bendToName ? { bendTo: n.bendToName } : {}),
          ...(roles?.note ? { role: roleText(roles.note) } : {}),
          ...(roles?.bendTo ? { bendToRole: roleText(roles.bendTo) } : {}),
        };
      }),
      interval: describeStep(col.fromPrevious, col.chordIntervals),
    })),
    range: analysis.range
      ? `${analysis.range.lowest}-${analysis.range.highest}`
      : null,
    pitchesUsed: analysis.pitchClasses,
    scales: {
      certainty: scales.certainty,
      candidates: scales.candidates.slice(0, 3).map((c) => ({
        name: c.name,
        outside: c.outside,
        reasons: c.reasons,
      })),
    },
  };
}

export const EXPLAIN_SYSTEM_PROMPT = `You explain why a short guitar phrase works, for a guitarist studying it.
You are given facts computed in code from the player's verified tab, plus the player's own assumptions about key and chords. Those facts are the only musical facts you may use.`;

export function explainUserPrompt(facts: ExplainFacts): string {
  return `Explain this phrase.

Rules
- Use ONLY the facts below. Never name a note, interval, role, or scale that isn't listed, and never reread or "correct" the tab.
- Each point is either:
  - "observation": something checkable in the facts (a note's role over its chord, an interval, a bend target, the contour, the range, a technique). Cite the note ids it is about in eventIds. assumption: null.
  - "interpretation": what the phrase does musically (tension and release, targeting, phrasing intent, how it implies the harmony). Put what it takes for granted in "assumption", e.g. "the band plays E7 under the whole phrase". Cite note ids when it is about specific notes.
- If chord placement is "assumed", say so in the assumption of any claim that depends on it. If it is "unknown", don't claim chord tones; you may say which chord information would sharpen the explanation.
- If rhythmKnown is false, say nothing about rhythm, timing, or note lengths.
- Slides, hammer-ons, and pull-offs go exactly as written in a note's "moves" (e.g. "slide from fret 6 to fret 5"); never reverse or re-target them. A bend goes from its fret up to bendTo.
- If the scale certainty is "ambiguous" or "insufficient", don't present any one scale as the answer.
- Be specific ("the bend lands on the b7 of A7") instead of vague ("sounds bluesy").
- 3 to 6 points, most important first. Summary: one or two plain sentences.
- No practice advice and no facts about the song, artist, or recording.

Facts (JSON)
${JSON.stringify(facts)}`;
}

/** Strict-mode JSON Schema for the provider (optional values are nullable). */
export const EXPLANATION_WIRE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'points'],
  properties: {
    summary: { type: 'string' },
    points: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'text', 'eventIds', 'assumption'],
        properties: {
          kind: { type: 'string', enum: ['observation', 'interpretation'] },
          text: { type: 'string' },
          eventIds: { type: 'array', items: { type: 'string' } },
          assumption: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

const WireSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  points: z.array(z.unknown()).max(20),
});

export interface ExplainResult {
  summary: string;
  points: ExplanationPoint[];
  /** Points removed because they were malformed or cited no real notes. */
  droppedPoints: number;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export const DEFAULT_EXPLAIN_TIMEOUT_MS = 60_000;
const MAX_POINTS = 6;

/**
 * Asks the provider to explain a phrase from computed facts, then keeps
 * only well-formed points whose note citations refer to real notes.
 * An observation that cites no real note is dropped: it can't be checked.
 */
export async function explainPhrase(
  provider: AiProvider,
  phrase: Phrase,
  options: { timeoutMs?: number; scenario?: string } = {},
): Promise<ExplainResult> {
  const facts = buildExplainFacts(phrase);
  const raw = await withAiTimeout(
    options.timeoutMs ?? DEFAULT_EXPLAIN_TIMEOUT_MS,
    (signal) =>
      provider.generateJson({
        task: 'explain-phrase',
        system: EXPLAIN_SYSTEM_PROMPT,
        prompt: explainUserPrompt(facts),
        schemaName: 'phrase_explanation',
        schema: EXPLANATION_WIRE_JSON_SCHEMA as unknown as Record<
          string,
          unknown
        >,
        data: facts,
        signal,
        scenario: options.scenario,
      }),
  );

  const wire = WireSchema.safeParse(raw.json);
  if (!wire.success)
    throw new AiError(
      'ai_invalid_output',
      'AI provider returned an explanation that does not match the schema',
      { cause: wire.error },
    );

  const known = new Set(phrase.events.map((e) => e.id));
  const points: ExplanationPoint[] = [];
  let droppedPoints = 0;
  for (const item of wire.data.points) {
    const p = item as Record<string, unknown>;
    const parsed = ExplanationPointSchema.safeParse({
      ...p,
      assumption: p['assumption'] ?? undefined,
    });
    if (!parsed.success) {
      droppedPoints++;
      continue;
    }
    const point = {
      ...parsed.data,
      eventIds: [...new Set(parsed.data.eventIds)].filter((id) =>
        known.has(id),
      ),
    };
    if (point.kind === 'observation' && point.eventIds.length === 0) {
      droppedPoints++;
      continue;
    }
    if (point.kind === 'observation') delete point.assumption;
    if (points.length < MAX_POINTS) points.push(point);
    else droppedPoints++;
  }
  return {
    summary: wire.data.summary,
    points,
    droppedPoints,
    model: raw.model,
    usage: raw.usage,
  };
}
