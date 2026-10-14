import { TICKS_PER_QUARTER } from '@gsc/contracts';

/** Versioned so stored drafts can record which prompt produced them. */
export const TAB_PROMPT_VERSION = 'tab-v1';

export const TAB_SYSTEM_PROMPT = `You transcribe guitar tablature from a photo of a printed book page into structured JSON.
You report only what is printed. Never invent, complete, or "fix" notes. Uncertainty is expected and must be reported.`;

export function tabUserPrompt(tuningMidi: readonly number[]): string {
  return `Transcribe the TAB staff in this image crop.

Strings and frets
- The tab staff has one line per string. The TOP line is the highest-pitched string: stringIndex 0. The instrument has ${tuningMidi.length} strings (tuning MIDI, high to low: ${tuningMidi.join(', ')}).
- Each number on a line is a fret on that string. Multi-digit numbers (10, 12, 15, 17) are ONE fret, not two.
- Read only the tab staff for frets. Standard notation above it may be used ONLY to determine rhythm.
- If the crop contains several tab staves (e.g. Gtr. 1 and a rhythm part), transcribe only the first tab staff and mention the others in "notes".

Order and simultaneity
- "order" is left-to-right sequence starting at 0. Numbers stacked vertically (chords, double-stops) share the same order.
- Never put two events on the same string with the same order.

Techniques (use only these values): bend, pre-bend, release, slide, hammer-on, pull-off, vibrato, palm-mute, dead-note, ghost, let-ring, tap, harmonic.
- "x" on a line = dead-note with fret null.
- Bends: an arrow with an amount. bendSemitones: "1/4" = 0.5, "1/2" = 1, "full" or "1" = 2, "1 1/2" = 3, "2" = 4. Use null when not a bend.
- A fret in parentheses after a bend is the release/held pitch: mark "release" (or "ghost" if it is a ghost note not tied to a bend).
- "h"/"p" or a slur arc between rising/falling frets = hammer-on / pull-off on the second note. "/" or "\\" or a line between frets = slide on the first note. "~" or wavy line = vibrato. "P.M." = palm-mute. "let ring" = let-ring.

Rhythm
- Set rhythmKnown true ONLY if rhythm is clearly readable for EVERY event (from stems/beams in the notation or rhythm marks on the tab). Then durationTicks uses ${TICKS_PER_QUARTER} ticks per quarter note (eighth = ${TICKS_PER_QUARTER / 2}, sixteenth = ${TICKS_PER_QUARTER / 4}, triplet eighth = ${TICKS_PER_QUARTER / 3}).
- Otherwise rhythmKnown false and EVERY durationTicks is null. Do not estimate rhythm from horizontal spacing.

Confidence and uncertainty
- confidence is 0..1 per event. Use < 0.6 when a digit, string, or symbol is hard to read.
- Add an "uncertainties" entry for any unreadable or ambiguous region, referencing event ids where applicable.
- "box" is the event's location in the crop as fractions of width/height (0..1), or null.
- "detectedSymbols" lists notable markings seen (e.g. "8va", "hold bend", "Rhy. Fig. 1", "let ring", chord names).
- Use ids "e1", "e2", ... in order.`;
}
