# Testing Strategy

## Approach

Use **user-provided photographs of existing guitar tab books** as the primary real-world fixtures. Native camera capture is deliberately out of scope for early milestones. Uploaded images may vary in lighting, angle, print quality, notation style, and presence of standard staff notation.

## Fixture policy

- Put real book images in `fixtures/private/` (gitignored; never commit or upload to public CI).
- Store non-copyrighted, hand-created or synthetic examples in `fixtures/synthetic/`.
- For each private fixture, record an internal identifier, crop, transcription ground truth, tuning, known/unknown rhythm, and musical context.
- Do not require the original page image to be retained permanently; support deletion.

## Initial test matrix

- [ ] Clean single-line tab with fret numbers only.
- [ ] Tab plus standard notation and rhythmic stems.
- [ ] Hammer-ons, pull-offs, slides, bends, and vibrato.
- [ ] Multiple-digit frets (10, 12, 15) and adjacent notes.
- [ ] Chord shapes and simultaneous notes.
- [ ] Crooked/low-contrast page photo.
- [ ] Alternate tuning and capo.
- [ ] Missing tempo, unknown key, or ambiguous harmony.
- [ ] Partial page/cropped phrase with incomplete context.

## Test layers

1. **Unit:** note-to-pitch conversion, intervals, transposition, fret range, schema validation.
2. **Fixture:** compare recognition to corrected expected event sequences; track errors by type.
3. **Integration:** Functions endpoints, persistence, auth, AI failure handling.
4. **E2E:** import → correction → analysis → practice → transpose → save.
5. **Human musical review:** check whether explanations are useful, exercises playable, and variations musical.

## Acceptance notes

Recognition accuracy alone is not the main metric. Track **time to corrected phrase** and **quality of the learning outcome**. When rhythm is absent, tests should verify that the app flags it as unknown rather than hallucinating durations.

## Fixture review template

```md
### Fixture: [private ID]
- Source/page: [private notes]
- Input conditions:
- Known tuning/capo:
- Expected notes and techniques:
- Rhythm present? yes/no
- Context (key/chords), if known:
- Recognition errors:
- Time to correction:
- Analysis quality:
- Practice-plan quality:
- Follow-up action:
```
