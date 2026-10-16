export interface Click {
  time: number;
  /** First beat of the bar. */
  accent: boolean;
  beat: number;
}

/**
 * Clicks due in [from, to) for a metronome started at `startTime`. Pure, so
 * the lookahead scheduler stays a thin loop around it.
 */
export function clicksBetween(
  bpm: number,
  startTime: number,
  from: number,
  to: number,
  beatsPerBar = 4,
): Click[] {
  const beat = 60 / bpm;
  const first = Math.max(0, Math.ceil((from - startTime) / beat - 1e-9));
  const out: Click[] = [];
  for (let n = first; startTime + n * beat < to; n++)
    out.push({
      time: startTime + n * beat,
      accent: n % beatsPerBar === 0,
      beat: n,
    });
  return out;
}
