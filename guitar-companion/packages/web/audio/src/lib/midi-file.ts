import { NoteEvent } from './notes';

const PPQ = 480;
/** General MIDI "Electric Guitar (clean)", zero-based. */
const GUITAR_PROGRAM = 27;
/** Default pitch-bend range of a General MIDI synth, in semitones. */
const BEND_RANGE = 2;

function varLen(value: number): number[] {
  const bytes = [value & 0x7f];
  for (let v = value >> 7; v > 0; v >>= 7) bytes.unshift((v & 0x7f) | 0x80);
  return bytes;
}

const u32 = (n: number) => [
  (n >>> 24) & 0xff,
  (n >>> 16) & 0xff,
  (n >>> 8) & 0xff,
  n & 0xff,
];
const u16 = (n: number) => [(n >>> 8) & 0xff, n & 0xff];

/** 14-bit pitch-bend message bytes for a rise in cents (clamped to the bend range). */
function bend(cents: number): [number, number] {
  const ratio = Math.max(-1, Math.min(1, cents / (BEND_RANGE * 100)));
  const value = Math.round(8192 + ratio * 8191);
  return [value & 0x7f, (value >> 7) & 0x7f];
}

/**
 * Standard MIDI File (format 0) for a schedule at a tempo. Muted notes are
 * left out; bends become pitch-bend messages (GM range ±2 semitones).
 */
export function encodeMidiFile(
  events: readonly NoteEvent[],
  bpm: number,
): Uint8Array<ArrayBuffer> {
  const ticksPerSecond = (bpm / 60) * PPQ;
  const tick = (s: number) => Math.round(s * ticksPerSecond);
  const timed: { at: number; order: number; bytes: number[] }[] = [];
  for (const e of events) {
    if (e.midi === null) continue;
    const on = tick(e.start);
    const off = tick(e.start + e.duration);
    timed.push({ at: on, order: 1, bytes: [0x90, e.midi, 96] });
    if (e.bendCents) {
      timed.push({
        at: on + Math.round((off - on) * 0.5),
        order: 2,
        bytes: [0xe0, ...bend(e.bendCents)],
      });
    }
    timed.push({ at: off, order: 0, bytes: [0x80, e.midi, 0] });
    if (e.bendCents)
      timed.push({ at: off, order: 0, bytes: [0xe0, ...bend(0)] });
  }
  timed.sort((a, b) => a.at - b.at || a.order - b.order);

  const mpqn = Math.round(60_000_000 / bpm);
  const track: number[] = [
    ...[
      0x00,
      0xff,
      0x51,
      0x03,
      (mpqn >> 16) & 0xff,
      (mpqn >> 8) & 0xff,
      mpqn & 0xff,
    ],
    ...[0x00, 0xc0, GUITAR_PROGRAM],
  ];
  let last = 0;
  for (const t of timed) {
    track.push(...varLen(t.at - last), ...t.bytes);
    last = t.at;
  }
  track.push(0x00, 0xff, 0x2f, 0x00);

  return new Uint8Array([
    ...[0x4d, 0x54, 0x68, 0x64], // MThd
    ...u32(6),
    ...u16(0),
    ...u16(1),
    ...u16(PPQ),
    ...[0x4d, 0x54, 0x72, 0x6b], // MTrk
    ...u32(track.length),
    ...track,
  ]);
}
