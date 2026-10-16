import { NoteEvent } from './notes';

export interface MidiOutputInfo {
  id: string;
  name: string;
}

interface MidiOutputLike {
  id: string;
  name?: string | null;
  send(data: number[], timestamp?: number): void;
}
interface MidiAccessLike {
  outputs: { values(): Iterable<MidiOutputLike> };
}
type RequestMidi = () => Promise<MidiAccessLike>;

const defaultRequest: RequestMidi | null =
  typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
    ? () =>
        (
          navigator as unknown as {
            requestMIDIAccess(): Promise<MidiAccessLike>;
          }
        ).requestMIDIAccess()
    : null;

/**
 * Optional MIDI out to the player's own synth or DAW. Null when the
 * browser has no Web MIDI (Safari, Firefox without a flag).
 */
export class MidiOut {
  private access: MidiAccessLike | null = null;

  constructor(
    private readonly request: RequestMidi | null = defaultRequest,
    private readonly now: () => number = () => performance.now(),
  ) {}

  get supported(): boolean {
    return this.request !== null;
  }

  async outputs(): Promise<MidiOutputInfo[]> {
    if (!this.request) return [];
    this.access ??= await this.request();
    return [...this.access.outputs.values()].map((o) => ({
      id: o.id,
      name: o.name || o.id,
    }));
  }

  /** Sends a schedule to an output, timed from now. Muted notes are skipped. */
  async play(outputId: string, events: readonly NoteEvent[]): Promise<void> {
    if (!this.request) return;
    this.access ??= await this.request();
    const out = [...this.access.outputs.values()].find(
      (o) => o.id === outputId,
    );
    if (!out) throw new Error('That MIDI output is no longer available.');
    const t0 = this.now() + 50;
    for (const e of events) {
      if (e.midi === null) continue;
      out.send([0x90, e.midi, 96], t0 + e.start * 1000);
      out.send([0x80, e.midi, 0], t0 + (e.start + e.duration) * 1000);
    }
  }
}
