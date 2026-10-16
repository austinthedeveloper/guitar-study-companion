import { NoteAnalysis } from './analyze-notes';
import { Chord, parseChord, parseProgression } from './chords';
import { harmonize, NoteRoles } from './harmony';
import { Key, spellMidi } from './keys';
import { MAX_FRET } from './pitch';
import { splitFigures } from './practice';
import { EventLike } from './validate-events';

/**
 * Controlled variations (M4): small, rule-made changes whose musical intent
 * is stated, never free-form rewrites. Each returns new events plus a
 * plain description of what changed, or a reason it doesn't apply.
 */

export interface Variation {
  kind: 'ending' | 'rhythm';
  title: string;
  description: string;
  events: EventLike[];
  rhythmKnown: boolean;
  /** Notes that differ from the phrase. */
  changedEventIds: string[];
}

export type VariationResult =
  | { variation: Variation; reason?: undefined }
  | { variation: null; reason: string };

interface PhraseInput {
  events: readonly EventLike[];
  analysis: NoteAnalysis;
  tuningMidi: readonly number[];
  capo: number;
  key?: Key | null;
  maxFret?: number;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;
/** Matches TICKS_PER_QUARTER in @gsc/contracts. */
const BEAT_TICKS = 480;

/**
 * Re-ends the phrase on the root of `chord` (the chord under the last note
 * when not given), or on its 3rd if it already ends on the root. Picks the
 * nearest such pitch, preferring to resolve down, fingered close to the
 * original last note.
 */
export function alternateEnding(
  input: PhraseInput & { chord: Chord | null },
): VariationResult {
  const { events, analysis, tuningMidi, capo, chord } = input;
  const maxFret = Math.min(input.maxFret ?? MAX_FRET, MAX_FRET) - capo;
  if (!chord || chord.rootPc === null)
    return {
      variation: null,
      reason: 'Needs a chord under the last note to choose an ending.',
    };
  const last = [...analysis.columns]
    .reverse()
    .find((c) => c.notes.some((n) => n.midi !== null));
  if (!last)
    return { variation: null, reason: 'The phrase has no pitched notes.' };
  const pitched = last.notes.filter((n) => n.midi !== null);
  if (pitched.length !== 1)
    return {
      variation: null,
      reason: 'The phrase ends on a chord, not a single note.',
    };
  const note = pitched[0];
  const original = events.find((e) => e.id === note.eventId);
  if (!original || original.fret === null)
    return { variation: null, reason: 'The last note has no fret.' };
  const heard = note.bendToMidi ?? (note.midi as number);
  const rootPc = chord.rootPc;
  const third = chord.tones.find((t) => t.label === '3' || t.label === 'b3');
  const goalPc =
    mod12(heard - rootPc) === 0 && third
      ? mod12(rootPc + third.offset)
      : rootPc;
  const goalLabel = goalPc === rootPc ? 'R' : (third?.label ?? 'R');

  // Nearest pitch of that class, resolving down on a tie.
  const below = heard - mod12(heard - goalPc);
  const above = below + 12;
  const candidates = (
    heard - below <= above - heard ? [below, above] : [above, below]
  ).filter((m) => m !== heard);
  for (const target of candidates) {
    const places = tuningMidi
      .map((open, s) => ({ s, fret: target - open - capo }))
      .filter((p) => p.fret >= 0 && p.fret <= maxFret)
      .sort(
        (a, b) =>
          Math.abs(a.s - original.stringIndex) * 3 +
          Math.abs(a.fret - original.fret!) -
          (Math.abs(b.s - original.stringIndex) * 3 +
            Math.abs(b.fret - original.fret!)),
      );
    const place = places[0];
    if (!place || Math.abs(place.fret - original.fret) > 5) continue;
    const changed: EventLike = {
      ...original,
      stringIndex: place.s,
      fret: place.fret,
      techniques: original.techniques.filter(
        (t) => !['bend', 'pre-bend', 'release', 'slide'].includes(t),
      ),
      bendSemitones: undefined,
    };
    delete changed.bendSemitones;
    const from = spellMidi(heard, input.key);
    const to = spellMidi(target, input.key);
    return {
      variation: {
        kind: 'ending',
        title: `Resolve to the ${goalLabel === 'R' ? 'root' : '3rd'} of ${chord.symbol}`,
        description: `Ends on ${to} (${goalLabel} of ${chord.symbol}) instead of ${from}.`,
        events: events.map((e) => (e.id === original.id ? changed : { ...e })),
        rhythmKnown: false,
        changedEventIds: [original.id],
      },
    };
  }
  return {
    variation: null,
    reason: `No ${goalLabel === 'R' ? 'root' : '3rd'} of ${chord.symbol} is within reach of the last note.`,
  };
}

/**
 * "Hold the targets": chord tones (where bends land counts) get two beats,
 * other notes one. Without chords, the last note of each figure is held.
 */
export function holdTargets(
  input: PhraseInput & {
    roles: Readonly<Record<string, NoteRoles>>;
    columnChords?: readonly (string | null)[];
  },
): VariationResult {
  const { events, analysis, roles } = input;
  const beat = BEAT_TICKS;
  const isTarget = (id: string) =>
    !!(roles[id]?.bendTo?.chordTone ?? roles[id]?.note?.chordTone);
  let held = new Set(
    analysis.columns
      .filter((c) => c.notes.some((n) => isTarget(n.eventId)))
      .map((c) => c.order),
  );
  let basis = 'chord tones';
  if (!held.size) {
    held = new Set(
      splitFigures(analysis, input.columnChords ?? []).map(
        (f) => f.columns[f.columns.length - 1].order,
      ),
    );
    basis = 'the last note of each figure';
  }
  if (!analysis.columns.length)
    return { variation: null, reason: 'The phrase has no notes.' };
  const steps = analysis.columns
    .map((c, i) => (held.has(c.order) ? i + 1 : null))
    .filter((s): s is number => s !== null);
  return {
    variation: {
      kind: 'rhythm',
      title: 'Hold the targets',
      description: `Holds ${basis} for two beats (note${steps.length > 1 ? 's' : ''} ${steps.join(', ')}); the rest get one beat each.`,
      events: events.map((e) => ({
        ...e,
        durationTicks: held.has(e.order) ? beat * 2 : beat,
      })),
      rhythmKnown: true,
      changedEventIds: events.map((e) => e.id),
    },
  };
}

export interface ChordApplication {
  chord: string;
  understood: boolean;
  /** Roles of the phrase's notes over this chord. */
  roles: Record<string, NoteRoles>;
  chordTones: number;
  pitchedNotes: number;
  /** The phrase re-ended on this chord, when possible. */
  ending: VariationResult;
}

/**
 * Application exercise: the phrase (or a variation) played over each chord
 * of a progression in turn, with its roles over that chord and an ending
 * that resolves to it.
 */
export function applyOverProgression(
  input: PhraseInput & { progression: string },
): ChordApplication[] {
  return parseProgression(input.progression).map((item) => {
    if (!item.chord)
      return {
        chord: item.text,
        understood: false,
        roles: {},
        chordTones: 0,
        pitchedNotes: 0,
        ending: {
          variation: null,
          reason: `"${item.text}" isn't a chord symbol this app understands.`,
        },
      };
    const harmony = harmonize({
      analysis: input.analysis,
      chords: item.text,
    });
    const pitched = input.analysis.columns.flatMap((c) =>
      c.notes.filter((n) => n.midi !== null),
    );
    return {
      chord: item.text,
      understood: true,
      roles: harmony.roles,
      chordTones: pitched.filter(
        (n) =>
          harmony.roles[n.eventId]?.bendTo?.chordTone ??
          harmony.roles[n.eventId]?.note?.chordTone,
      ).length,
      pitchedNotes: pitched.length,
      ending: alternateEnding({ ...input, chord: parseChord(item.text) }),
    };
  });
}
