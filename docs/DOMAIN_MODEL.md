# Domain Model

## Core entities

- **SourceReference:** book title, page, author/publisher (optional), user-owned provenance, image retention preference.
- **ImportDraft:** cropped image reference, raw recognition, confidence/uncertainty, processing status.
- **Phrase:** user ID, source reference, verified tablature, musical context, tags, annotations, revision.
- **MusicalContext:** tuning, capo, key (known/assumed/unknown), meter, tempo, chord progression, phrase-to-chord alignment.
- **Analysis:** deterministic note/interval data, possible harmony interpretations, explanatory text, version/model metadata.
- **PracticePlan:** ordered exercises, objectives, tempos, criteria, source phrase revision.
- **PracticeSession:** user ID, plan ID, completed exercises, tempo reached, personal notes.
- **Transformation:** source phrase revision, target key, candidate fingerings, preserved interval structure, variations.

## Canonical phrase model (illustrative TypeScript)

```ts
type Technique = 'bend' | 'slide' | 'hammer-on' | 'pull-off' | 'vibrato' | 'mute';
interface TabEvent {
  id: string;
  stringIndex: number; // documented ordering, e.g. 0 = highest string
  fret: number;
  onsetTicks: number;
  durationTicks: number | null; // null if rhythm unknown
  techniques: Technique[];
  bendSemitones?: number;
}
interface Phrase {
  id: string;
  tuningMidi: number[]; // one MIDI pitch per open string
  ticksPerQuarter: number;
  events: TabEvent[];
  key?: string;
  chords?: Array<{ symbol: string; startTicks: number; endTicks: number }>;
  rhythmKnown: boolean;
  revision: number;
}
```

## Invariants

- A scanned tab without rhythmic notation may **not** contain trustworthy note durations. Do not invent precise rhythm.
- Guitar string/fret coordinates and sounding pitch are separate concepts; tuning and capo affect pitch.
- Chord/key interpretation is contextual and may be uncertain.
- A transposed pitch does not uniquely determine fingering; offer playable candidates.
- Changes to a verified phrase invalidate stale analyses/plans or require explicit versioning.
- AI output is a proposal until validated; corrected transcription is canonical.

## Database strategy

Begin with separate collections for phrases, practice plans, and sessions. Embed small event arrays inside phrases; avoid premature normalization. Index by `userId` and common library filters. Add schema versioning and migrations as the representation evolves.
