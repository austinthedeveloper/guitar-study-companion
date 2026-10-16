import { analyzeNotes, ColumnFact, NoteAnalysis } from './analyze-notes';
import { ChordChange } from './chords';
import { neighbourOnString } from './editing';
import { Harmony, harmonize } from './harmony';
import { parseKey } from './keys';
import { MAX_FRET } from './pitch';
import { EventLike } from './validate-events';

/**
 * Rule-built practice plans (ADR-011). Everything about notes, order, and
 * tempo is decided here, deterministically, from the verified phrase; AI
 * may only reword instructions later. Shapes mirror @gsc/contracts
 * Exercise/PlanSettings structurally so music-domain stays dependency-free.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Focus = 'balanced' | 'technique' | 'accuracy' | 'harmony';
export type ExerciseKind =
  'isolate' | 'technique' | 'slow' | 'connect' | 'apply';
/** Techniques that get their own drill. */
export type DrillTechnique =
  | 'bend'
  | 'hammer-on'
  | 'pull-off'
  | 'slide'
  | 'vibrato'
  | 'dead-note'
  | 'palm-mute';

export interface PlanSettingsLike {
  difficulty: Difficulty;
  minutes: number;
  focus: Focus;
}

export interface ExerciseDraft {
  id: string;
  kind: ExerciseKind;
  title: string;
  objective: string;
  eventIds: string[];
  referenceNotes: { stringIndex: number; fret: number; label: string }[];
  technique?: DrillTechnique;
  chord?: string;
  tempo: {
    startBpm: number;
    targetBpm: number;
    stepBpm: number;
    rhythmic: boolean;
  };
  repetitions: number;
  successCriterion: string;
  instructions: string[];
  minutes: number;
}

const TARGET_BPM: Record<Difficulty, number> = {
  easy: 60,
  medium: 80,
  hard: 100,
};
const START_FACTOR: Record<Difficulty, number> = {
  easy: 0.5,
  medium: 0.6,
  hard: 0.75,
};
const STEP_BPM: Record<Difficulty, number> = { easy: 4, medium: 5, hard: 8 };
const REPETITIONS: Record<Difficulty, number> = { easy: 8, medium: 6, hard: 4 };
const MINUTES: Record<ExerciseKind, number> = {
  isolate: 2,
  technique: 3,
  slow: 4,
  connect: 2,
  apply: 3,
};
/** Which kinds survive first when the session is too short, per focus. */
const PRIORITY: Record<Focus, ExerciseKind[]> = {
  balanced: ['slow', 'isolate', 'technique', 'apply', 'connect'],
  technique: ['technique', 'slow', 'isolate', 'connect', 'apply'],
  accuracy: ['isolate', 'slow', 'technique', 'connect', 'apply'],
  harmony: ['apply', 'slow', 'isolate', 'technique', 'connect'],
};
const SEQUENCE: ExerciseKind[] = [
  'isolate',
  'technique',
  'slow',
  'connect',
  'apply',
];

const MAX_FIGURE = 4;
const LEAP = 5;

interface Figure {
  index: number;
  columns: ColumnFact[];
  first: number;
  last: number;
}

/**
 * Splits the phrase into short figures: at most four columns, breaking at
 * chord changes and leaps of a fourth or more. A lone trailing column joins
 * the figure before it.
 */
export function splitFigures(
  analysis: NoteAnalysis,
  columnChords: readonly (string | null)[] = [],
): Figure[] {
  const groups: { columns: ColumnFact[]; first: number }[] = [];
  analysis.columns.forEach((col, i) => {
    const current = groups[groups.length - 1];
    const leap =
      col.fromPrevious !== null && Math.abs(col.fromPrevious.semitones) >= LEAP;
    const chordChange = i > 0 && columnChords[i] !== columnChords[i - 1];
    if (
      !current ||
      current.columns.length >= MAX_FIGURE ||
      (current.columns.length >= 2 && (leap || chordChange))
    )
      groups.push({ columns: [col], first: i });
    else current.columns.push(col);
  });
  const last = groups[groups.length - 1];
  if (groups.length > 1 && last.columns.length === 1) {
    groups[groups.length - 2].columns.push(...last.columns);
    groups.pop();
  }
  return groups.map((g, index) => ({
    index,
    columns: g.columns,
    first: g.first + 1,
    last: g.first + g.columns.length,
  }));
}

const idsOf = (columns: readonly ColumnFact[]) =>
  columns.flatMap((c) => c.notes.map((n) => n.eventId));
const notesLabel = (first: number, last: number) =>
  first === last ? `note ${first}` : `notes ${first}–${last}`;

export function buildPracticePlan(input: {
  events: readonly EventLike[];
  analysis: NoteAnalysis;
  harmony: Harmony;
  rhythmKnown: boolean;
  tempoBpm?: number;
  settings: PlanSettingsLike;
}): ExerciseDraft[] {
  const { analysis, harmony, settings } = input;
  const d = settings.difficulty;
  const target = input.tempoBpm ?? TARGET_BPM[d];
  const start = Math.max(30, Math.round(target * START_FACTOR[d]));
  const mid = Math.max(start, Math.round((start + target) / 2));
  const reps = REPETITIONS[d] + (settings.focus === 'accuracy' ? 2 : 0);
  const pulse = input.rhythmKnown
    ? []
    : [
        'Rhythm is unknown, so play one note per click; it is not the real rhythm.',
      ];
  const tempo = (from: number, to: number) => ({
    startBpm: from,
    targetBpm: to,
    stepBpm: STEP_BPM[d],
    rhythmic: input.rhythmKnown,
  });
  const columnOf = new Map(
    analysis.columns.flatMap((c, i) => c.notes.map((n) => [n.eventId, i])),
  );
  const out: ExerciseDraft[] = [];
  const add = (x: Omit<ExerciseDraft, 'id' | 'minutes'>) =>
    out.push({ ...x, id: '', minutes: MINUTES[x.kind] });

  const figures = splitFigures(analysis, harmony.columnChords);
  const allIds = idsOf(analysis.columns);
  if (allIds.length === 0) return [];

  // 1. Isolate each figure (only worth it when there is more than one).
  if (figures.length > 1)
    for (const f of figures)
      add({
        kind: 'isolate',
        title: `Figure ${f.index + 1} (${notesLabel(f.first, f.last)})`,
        objective: `Play ${notesLabel(f.first, f.last)} on their own until the fingering is automatic.`,
        eventIds: idsOf(f.columns),
        referenceNotes: [],
        tempo: tempo(start, mid),
        repetitions: reps,
        successCriterion: `${reps} clean repetitions in a row at ${mid} bpm.`,
        instructions: [
          'Start at the slow tempo and only speed up after a clean repetition.',
          ...pulse,
        ],
      });

  // 2. Technique drills, only for techniques the phrase actually uses.
  const withTechnique = (names: string[]) =>
    input.events.filter((e) => e.techniques.some((t) => names.includes(t)));
  const ordered = (ids: Iterable<string>) =>
    [...new Set(ids)].sort(
      (a, b) => (columnOf.get(a) ?? 0) - (columnOf.get(b) ?? 0),
    );
  const stepOf = (id: string) => (columnOf.get(id) ?? 0) + 1;
  const drillFocus = settings.focus === 'accuracy' ? ['bend'] : null;

  const bends = withTechnique(['bend', 'pre-bend']).slice(0, 3);
  if (bends.length && (!drillFocus || drillFocus.includes('bend'))) {
    const refs = bends.flatMap((e) => {
      const fret =
        e.fret !== null && Number.isInteger(e.bendSemitones)
          ? e.fret + (e.bendSemitones ?? 0)
          : null;
      const name = analysis.columns
        .flatMap((c) => c.notes)
        .find((n) => n.eventId === e.id)?.bendToName;
      return fret !== null && fret <= MAX_FRET
        ? [
            {
              stringIndex: e.stringIndex,
              fret,
              label: `Bend target for note ${stepOf(e.id)}${name ? ` (${name})` : ''}`,
            },
          ]
        : [];
    });
    add({
      kind: 'technique',
      technique: 'bend',
      title: 'Bend in tune',
      objective:
        'Make each bend reach its target pitch, not just "about right".',
      eventIds: ordered(bends.map((e) => e.id)),
      referenceNotes: refs,
      tempo: tempo(start, mid),
      repetitions: reps,
      successCriterion:
        'The bent note matches the reference note 3 times in a row.',
      instructions: [
        'Play the reference fret first, then bend up from the written fret until it matches.',
        'Push with two or three fingers behind the fretting finger.',
      ],
    });
  }
  const legato = withTechnique(['hammer-on', 'pull-off']);
  if (legato.length && !drillFocus)
    add({
      kind: 'technique',
      technique: legato[0].techniques.includes('hammer-on')
        ? 'hammer-on'
        : 'pull-off',
      title: 'Even hammer-ons and pull-offs',
      objective: 'Make the slurred notes as loud and even as the picked ones.',
      eventIds: ordered(
        legato.flatMap((e) => {
          const prev = neighbourOnString(input.events, e, -1);
          return prev ? [prev.id, e.id] : [e.id];
        }),
      ),
      referenceNotes: [],
      tempo: tempo(start, mid),
      repetitions: reps,
      successCriterion:
        'Every slurred note is clearly audible, 5 times in a row.',
      instructions: [
        'Pick only the first note of each pair; the other finger does the work.',
      ],
    });
  const slides = withTechnique(['slide']);
  if (slides.length && !drillFocus)
    add({
      kind: 'technique',
      technique: 'slide',
      title: 'Clean slides',
      objective: 'Arrive exactly on the target fret without overshooting.',
      eventIds: ordered(
        slides.flatMap((e) => {
          const next = neighbourOnString(input.events, e, 1);
          return next ? [e.id, next.id] : [e.id];
        }),
      ),
      referenceNotes: [],
      tempo: tempo(start, mid),
      repetitions: reps,
      successCriterion: 'The slide lands on the target fret 5 times in a row.',
      instructions: ['Keep finger pressure steady while you slide.'],
    });
  const vibrato = withTechnique(['vibrato']);
  if (vibrato.length && !drillFocus)
    add({
      kind: 'technique',
      technique: 'vibrato',
      title: 'Controlled vibrato',
      objective: 'Keep the vibrato even in speed and width.',
      eventIds: ordered(vibrato.map((e) => e.id)),
      referenceNotes: [],
      tempo: tempo(start, start),
      repetitions: reps,
      successCriterion: 'Vibrato stays even for four clicks, 3 times in a row.',
      instructions: [
        'Pulse the vibrato in time with the click: one push per click, then two.',
      ],
    });
  const muted = withTechnique(['dead-note', 'palm-mute']);
  if (muted.length && !drillFocus)
    add({
      kind: 'technique',
      technique: muted[0].techniques.includes('dead-note')
        ? 'dead-note'
        : 'palm-mute',
      title: 'Muted notes',
      objective:
        'Make the muted notes percussive, with no pitch ringing through.',
      eventIds: ordered(
        muted.flatMap((e) => {
          const col = columnOf.get(e.id) ?? 0;
          return [col - 1, col, col + 1].flatMap(
            (i) => analysis.columns[i]?.notes.map((n) => n.eventId) ?? [],
          );
        }),
      ),
      referenceNotes: [],
      tempo: tempo(start, mid),
      repetitions: reps,
      successCriterion: 'No pitch rings in the muted notes, 5 times in a row.',
      instructions: [
        'Rest the fretting hand lightly on the strings without pressing them down.',
      ],
    });

  // 3. Slow practice of the whole phrase.
  add({
    kind: 'slow',
    title: 'Whole phrase, slowly',
    objective:
      'Play the whole phrase at a tempo where it is clean, then build up.',
    eventIds: allIds,
    referenceNotes: [],
    tempo: tempo(start, target),
    repetitions: reps,
    successCriterion: `The whole phrase cleanly at ${target} bpm.`,
    instructions: [
      `Raise the tempo by ${STEP_BPM[d]} bpm after each clean run; drop back after a mistake.`,
      ...pulse,
    ],
  });

  // 4. Connect neighbouring figures across their join.
  for (let i = 0; i + 1 < figures.length && figures.length > 2; i++) {
    const a = figures[i];
    const b = figures[i + 1];
    add({
      kind: 'connect',
      title: `Join figures ${a.index + 1} and ${b.index + 1}`,
      objective: `Move from note ${a.last} to note ${b.first} without a gap.`,
      eventIds: [...idsOf(a.columns), ...idsOf(b.columns)],
      referenceNotes: [],
      tempo: tempo(start, mid),
      repetitions: reps,
      successCriterion: 'No pause at the join, 3 times in a row.',
      instructions: ['Look ahead to the first note of the next figure early.'],
    });
  }

  // 5. Apply over the chords, aiming at chord tones.
  if (harmony.chords.length && harmony.changes.length) {
    // A bend is heard for where it lands, so its target's role counts first.
    const targets = analysis.columns.flatMap((c, i) =>
      c.notes.flatMap((n) => {
        const roles = harmony.roles[n.eventId];
        const pick = roles?.bendTo?.chordTone
          ? { name: n.bendToName, role: roles.bendTo }
          : roles?.note?.chordTone
            ? { name: n.name, role: roles.note }
            : null;
        return pick
          ? [{ step: i + 1, ...pick, chord: harmony.columnChords[i] }]
          : [];
      }),
    );
    const chordList = harmony.changes.map((c) => c.chord).join(' → ');
    if (targets.length)
      add({
        kind: 'apply',
        title: `Over ${chordList}`,
        objective:
          'Hear how the phrase sits on the chords and lean on the chord tones.',
        eventIds: allIds,
        chord: chordList,
        referenceNotes: [],
        tempo: tempo(start, target),
        repetitions: Math.max(3, reps - 2),
        successCriterion:
          'Every chord tone below is in tune and sustained, 3 times in a row.',
        instructions: [
          `Strum or loop ${chordList}${harmony.assumed ? ' (assumed for the whole phrase)' : ''}, then play the phrase over it.`,
          `Aim for: ${targets
            .slice(0, 4)
            .map(
              (t) =>
                `note ${t.step} (${t.name}, ${t.role.label} of ${t.chord})`,
            )
            .join('; ')}.`,
        ],
      });
  }

  // Fit the session: keep the highest-priority kinds for this focus.
  const rank = (x: ExerciseDraft) => PRIORITY[settings.focus].indexOf(x.kind);
  const keep = new Set<ExerciseDraft>();
  let used = 0;
  for (const x of [...out].sort((a, b) => rank(a) - rank(b))) {
    if (used + x.minutes <= settings.minutes || x.kind === 'slow') {
      keep.add(x);
      used += x.minutes;
    }
  }
  return out
    .filter((x) => keep.has(x))
    .sort((a, b) => SEQUENCE.indexOf(a.kind) - SEQUENCE.indexOf(b.kind))
    .map((x, i) => ({ ...x, id: `x${i + 1}` }));
}

export interface ExerciseReview {
  accepted: ExerciseDraft[];
  rejected: { title: string; reasons: string[] }[];
}

/** Largest fret span one hand can hold in a single chord. */
const MAX_STRETCH = 5;

/**
 * Rejects exercises that reference notes the phrase doesn't have, frets
 * off the neck, or chord shapes no hand can reach. Runs on every plan,
 * whoever produced its text.
 */
export function reviewExercises(
  exercises: readonly ExerciseDraft[],
  phrase: {
    events: readonly EventLike[];
    stringCount: number;
    capo: number;
  },
): ExerciseReview {
  const byId = new Map(phrase.events.map((e) => [e.id, e]));
  const accepted: ExerciseDraft[] = [];
  const rejected: ExerciseReview['rejected'] = [];
  for (const x of exercises) {
    const reasons: string[] = [];
    const unknown = x.eventIds.filter((id) => !byId.has(id));
    if (unknown.length)
      reasons.push(
        `Uses notes that are not in the phrase (${unknown.join(', ')}).`,
      );
    if (new Set(x.eventIds).size !== x.eventIds.length)
      reasons.push('Lists the same note twice.');
    for (const r of x.referenceNotes) {
      if (r.stringIndex < 0 || r.stringIndex >= phrase.stringCount)
        reasons.push(
          `Reference note on string ${r.stringIndex + 1}, which doesn't exist.`,
        );
      if (r.fret + phrase.capo > MAX_FRET)
        reasons.push(`Reference note at fret ${r.fret} is off the neck.`);
    }
    const columns = new Map<number, number[]>();
    for (const id of x.eventIds) {
      const e = byId.get(id);
      if (!e || e.fret === null || e.fret === 0) continue;
      columns.set(e.order, [...(columns.get(e.order) ?? []), e.fret]);
    }
    for (const frets of columns.values()) {
      const span = Math.max(...frets) - Math.min(...frets);
      if (span > MAX_STRETCH)
        reasons.push(
          `A chord spans ${span} frets, which one hand can't reach.`,
        );
    }
    if (x.tempo.startBpm > x.tempo.targetBpm)
      reasons.push('Starts faster than its target tempo.');
    if (reasons.length) rejected.push({ title: x.title, reasons });
    else accepted.push(x);
  }
  return { accepted, rejected };
}

/** Builds and reviews a plan straight from a stored phrase's fields. */
export function planForPhrase(input: {
  events: readonly EventLike[];
  rhythmKnown: boolean;
  context: {
    tuningMidi: readonly number[];
    capo: number;
    key?: string;
    chords?: string;
    chordChanges?: readonly ChordChange[];
    tempoBpm?: number;
  };
  settings: PlanSettingsLike;
}): ExerciseReview {
  const ctx = input.context;
  const analysis = analyzeNotes({
    events: input.events,
    tuningMidi: ctx.tuningMidi,
    capo: ctx.capo,
    key: parseKey(ctx.key),
  });
  const harmony = harmonize({
    analysis,
    chords: ctx.chords,
    chordChanges: ctx.chordChanges,
  });
  const drafts = buildPracticePlan({
    events: input.events,
    analysis,
    harmony,
    rhythmKnown: input.rhythmKnown,
    tempoBpm: ctx.tempoBpm,
    settings: input.settings,
  });
  return reviewExercises(drafts, {
    events: input.events,
    stringCount: ctx.tuningMidi.length,
    capo: ctx.capo,
  });
}
