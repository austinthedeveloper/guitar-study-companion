import { NoteAnalysis } from './analyze-notes';
import { Chord } from './chords';
import { Key, Mode, spellFromRoot, spellPitchClass } from './keys';

/**
 * Candidate scales for a phrase. Several scales usually fit a short lick
 * (A minor pentatonic and C major pentatonic share every note), so this
 * ranks candidates by stated evidence and reports when the choice is
 * ambiguous instead of picking one silently.
 */

interface ScaleType {
  name: string;
  steps: readonly number[];
  /** Letter offset of each step from the root, so b5 spells as Eb over A. */
  letters: readonly number[];
  /** Which key quality the scale belongs with, for spelling and key fit. */
  mode: Mode;
}

const DIATONIC = [0, 1, 2, 3, 4, 5, 6];
/** Letter offset for a pitch outside the scale, by semitones above the root. */
const OUTSIDE_LETTERS = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];

export const SCALE_TYPES: readonly ScaleType[] = [
  {
    name: 'minor pentatonic',
    steps: [0, 3, 5, 7, 10],
    letters: [0, 2, 3, 4, 6],
    mode: 'minor',
  },
  {
    name: 'major pentatonic',
    steps: [0, 2, 4, 7, 9],
    letters: [0, 1, 2, 4, 5],
    mode: 'major',
  },
  {
    name: 'blues',
    steps: [0, 3, 5, 6, 7, 10],
    letters: [0, 2, 3, 4, 4, 6],
    mode: 'minor',
  },
  {
    name: 'major blues',
    steps: [0, 2, 3, 4, 7, 9],
    letters: [0, 1, 2, 2, 4, 5],
    mode: 'major',
  },
  {
    name: 'major',
    steps: [0, 2, 4, 5, 7, 9, 11],
    letters: DIATONIC,
    mode: 'major',
  },
  {
    name: 'natural minor',
    steps: [0, 2, 3, 5, 7, 8, 10],
    letters: DIATONIC,
    mode: 'minor',
  },
  {
    name: 'dorian',
    steps: [0, 2, 3, 5, 7, 9, 10],
    letters: DIATONIC,
    mode: 'minor',
  },
  {
    name: 'mixolydian',
    steps: [0, 2, 4, 5, 7, 9, 10],
    letters: DIATONIC,
    mode: 'major',
  },
  {
    name: 'phrygian',
    steps: [0, 1, 3, 5, 7, 8, 10],
    letters: DIATONIC,
    mode: 'minor',
  },
  {
    name: 'lydian',
    steps: [0, 2, 4, 6, 7, 9, 11],
    letters: DIATONIC,
    mode: 'major',
  },
  {
    name: 'harmonic minor',
    steps: [0, 2, 3, 5, 7, 8, 11],
    letters: DIATONIC,
    mode: 'minor',
  },
  {
    name: 'melodic minor',
    steps: [0, 2, 3, 5, 7, 9, 11],
    letters: DIATONIC,
    mode: 'minor',
  },
];

export interface ScaleCandidate {
  /** e.g. "A minor pentatonic". */
  name: string;
  root: string;
  rootPc: number;
  type: string;
  /** Scale notes spelled from its root. */
  notes: string[];
  /** Phrase pitches outside the scale (at most one is allowed). */
  outside: string[];
  /** Plain-language evidence for the ranking. */
  reasons: string[];
  score: number;
}

export interface ScaleAnalysis {
  /**
   * clear: one candidate leads on evidence. ambiguous: the top candidates
   * are equally supported. insufficient: too few distinct pitches to say.
   */
  certainty: 'clear' | 'ambiguous' | 'insufficient';
  candidates: ScaleCandidate[];
}

/** Fewer distinct pitches than this can't distinguish scales meaningfully. */
const MIN_PITCH_CLASSES = 4;
const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function candidateScales(input: {
  analysis: NoteAnalysis;
  key?: Key | null;
  /** Chords placed under the phrase, in order (N.C. allowed). */
  chords?: readonly Chord[];
  limit?: number;
}): ScaleAnalysis {
  const key = input.key ?? null;
  const pcs = new Set<number>();
  let landing: number | null = null;
  for (const col of input.analysis.columns)
    for (const n of col.notes) {
      if (n.midi === null) continue;
      pcs.add(mod12(n.midi));
      if (n.bendToMidi !== undefined) pcs.add(mod12(n.bendToMidi));
      landing = mod12(n.bendToMidi ?? n.midi);
    }
  const chordRoots = (input.chords ?? [])
    .map((c) => c.rootPc)
    .filter((pc): pc is number => pc !== null);

  const candidates: ScaleCandidate[] = [];
  for (const type of SCALE_TYPES)
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      const members = new Set(type.steps.map((s) => mod12(rootPc + s)));
      const outsidePcs = [...pcs].filter((pc) => !members.has(pc));
      if (pcs.size === 0 || outsidePcs.length > 1) continue;

      const spelling: Key = {
        tonic: spellPitchClass(rootPc, key),
        tonicPc: rootPc,
        mode: type.mode,
      };
      const root = spelling.tonic;
      const reasons: string[] = [];
      let score = 0;
      if (outsidePcs.length) {
        score -= 2;
      } else {
        reasons.push('contains every note in the phrase');
      }
      if (key && key.tonicPc === rootPc) {
        score += key.mode === type.mode ? 3 : 1;
        reasons.push(
          key.mode === type.mode
            ? `matches the key you gave (${key.tonic} ${key.mode})`
            : `same tonic as the key you gave`,
        );
      }
      if (chordRoots[0] === rootPc) {
        score += 2;
        reasons.push(`root of the first chord`);
      } else if (chordRoots.includes(rootPc)) {
        score += 1;
        reasons.push(`root of a chord in the phrase`);
      }
      if (landing === rootPc) {
        score += 1;
        reasons.push('the phrase ends on this note');
      }
      // Prefer the smallest scale that explains the notes.
      score -= (type.steps.length - 5) * 0.5;

      candidates.push({
        name: `${root} ${type.name}`,
        root,
        rootPc,
        type: type.name,
        notes: type.steps.map((s, i) =>
          spellFromRoot(root, s, type.letters[i]),
        ),
        outside: outsidePcs.map((pc) =>
          spellFromRoot(
            root,
            mod12(pc - rootPc),
            OUTSIDE_LETTERS[mod12(pc - rootPc)],
          ),
        ),
        reasons,
        score,
      });
    }

  candidates.sort((a, b) => b.score - a.score);
  // A near miss is worth showing beside an exact fit on the same root
  // (A minor pentatonic + Eb explains A blues), or when nothing fits exactly.
  const exactRoots = new Set(
    candidates.filter((c) => !c.outside.length).map((c) => c.rootPc),
  );
  const top = candidates
    .filter(
      (c) => !c.outside.length || !exactRoots.size || exactRoots.has(c.rootPc),
    )
    .slice(0, input.limit ?? 5);
  let certainty: ScaleAnalysis['certainty'] = 'clear';
  if (pcs.size < MIN_PITCH_CLASSES) certainty = 'insufficient';
  else if (
    top.length === 0 ||
    // The question that matters is the tonal centre: A minor pentatonic vs
    // A blues is a detail, A minor pentatonic vs C major pentatonic is not.
    top.some((c) => c.rootPc !== top[0].rootPc && top[0].score - c.score < 1)
  )
    certainty = 'ambiguous';
  return { certainty, candidates: top };
}
