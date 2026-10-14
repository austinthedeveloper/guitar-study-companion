# AI Contracts and Validation

## Principle

AI is used for **interpretation and pedagogy**, not as the final authority for musical facts. The server validates AI output, and the user can correct it.

## Interfaces (conceptual)

```ts
interface TabInterpreter {
  interpret(input: { image: Uint8Array; mimeType: string; tuningMidi?: number[] }): Promise<TranscriptionDraft>;
}
interface PhraseExplainer {
  explain(input: { phrase: VerifiedPhrase; context: MusicalContext }): Promise<AnalysisDraft>;
}
interface PracticeDesigner {
  design(input: { phrase: VerifiedPhrase; analysis: VerifiedAnalysis; goals: PracticeGoals }): Promise<PracticePlanDraft>;
}
```

## Recognition output

Return a typed list of tab events, detected notation symbols, uncertain regions, and whether rhythm is known. Preserve source coordinates where possible so uncertain events can be highlighted on the image. Never silently fill in absent durations.

## Analysis output

Separate **verified** pitches and intervals from **inferred** key, chord functions, and stylistic explanations. Each claim should indicate its musical evidence or assumption.

## Exercise output

Each exercise needs: purpose, source event IDs, instructions, starting tempo if known, repetitions, completion criterion, and optional musical context. No unsupported claim that an exercise is medically safe or universally playable.

## Validation and safety

- Validate JSON schema, event references, note ranges, and time ordering.
- Reject fabricated frets, invalid strings, impossible bends, or unknown chord labels masquerading as facts.
- Check transposition interval preservation in deterministic code.
- Cap prompt/image size, processing time, retries, and output tokens.
- Keep source images and provider responses private; avoid logging raw copyrighted page contents.
- Make AI failures recoverable without losing the corrected phrase.

## Evaluation rubric

Score fixture runs for transcription correctness, correction effort, harmonic accuracy, instructional specificity, fretboard playability, and creative transfer value. Prefer explanations like “this note targets the third of D7” to vague descriptions like “bluesy sound.”
