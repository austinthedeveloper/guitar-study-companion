import { PracticeAudio, TimerApi } from './engine';
import { pluckSamples } from './karplus';
import { clicksBetween } from './metronome';
import { encodeMidiFile } from './midi-file';
import { midiToFrequency, toNoteEvents } from './notes';
import { MidiOut } from './web-midi';

describe('toNoteEvents', () => {
  const columns = [
    {
      notes: [{ midi: 76, bendSemitones: 2, dead: false }],
      durationTicks: 240,
    },
    { notes: [{ midi: null, dead: true }], durationTicks: 240 },
    {
      notes: [
        { midi: 45, dead: false },
        { midi: 52, dead: false },
      ],
      durationTicks: 960,
    },
  ];

  it('gives one beat per column without rhythm (a practice pulse)', () => {
    const events = toNoteEvents(columns, { bpm: 120, rhythmic: false });
    expect(events.map((e) => [e.midi, e.start])).toEqual([
      [76, 0],
      [null, 0.5],
      [45, 1],
      [52, 1],
    ]);
    expect(events[0]).toMatchObject({ duration: 0.45, bendCents: 200 });
    expect(events[1].duration).toBe(0.08);
  });

  it('uses written durations when rhythm is known', () => {
    const events = toNoteEvents(columns, { bpm: 120, rhythmic: true });
    // Eighths at 120 bpm are 0.25 s; the chord is a half note.
    expect(events.map((e) => e.start)).toEqual([0, 0.25, 0.5, 0.5]);
    expect(events[2].duration).toBeCloseTo(0.9);
  });

  it('converts MIDI to frequency', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(81)).toBe(880);
  });
});

describe('pluckSamples', () => {
  it('is repeatable and decays like a plucked string', () => {
    const a = pluckSamples(220, 8000, 1);
    expect(a).toEqual(pluckSamples(220, 8000, 1));
    expect(a.length).toBe(8000);
    const energy = (from: number, to: number) =>
      a.slice(from, to).reduce((s, x) => s + x * x, 0);
    expect(energy(7000, 8000)).toBeLessThan(energy(0, 1000) / 10);
  });
});

describe('clicksBetween', () => {
  it('returns the clicks due in a window, accenting each bar', () => {
    // 120 bpm from t=10: clicks at 10, 10.5, 11, ...
    expect(clicksBetween(120, 10, 10, 11.6)).toEqual([
      { time: 10, accent: true, beat: 0 },
      { time: 10.5, accent: false, beat: 1 },
      { time: 11, accent: false, beat: 2 },
      { time: 11.5, accent: false, beat: 3 },
    ]);
    expect(clicksBetween(120, 10, 11.6, 12.1)).toEqual([
      { time: 12, accent: true, beat: 4 },
    ]);
    expect(clicksBetween(60, 0, 0, 3.5, 3).map((c) => c.accent)).toEqual([
      true,
      false,
      false,
      true,
    ]);
  });
});

describe('encodeMidiFile', () => {
  it('writes a format-0 file with tempo, guitar program, notes, and bends', () => {
    const bytes = encodeMidiFile(
      [
        { midi: 64, start: 0, duration: 0.5, bendCents: 200 },
        { midi: null, start: 0.5, duration: 0.08, bendCents: 0 },
      ],
      120,
    );
    const text = (from: number, to: number) =>
      String.fromCharCode(...bytes.slice(from, to));
    expect(text(0, 4)).toBe('MThd');
    expect([...bytes.slice(8, 14)]).toEqual([0, 0, 0, 1, 0x01, 0xe0]);
    expect(text(14, 18)).toBe('MTrk');
    const track = [...bytes.slice(22)];
    // 500000 µs per quarter = 120 bpm.
    expect(track.slice(0, 7)).toEqual([0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20]);
    expect(track.slice(7, 10)).toEqual([0, 0xc0, 27]);
    expect(track.filter((b) => b === 0x90)).toHaveLength(1);
    // Full bend up (14-bit max), then reset to centre.
    expect(track).toEqual(expect.arrayContaining([0xe0, 0x7f, 0x7f]));
    expect(track).toEqual(expect.arrayContaining([0xe0, 0x00, 0x40]));
    expect(track.slice(-4)).toEqual([0, 0xff, 0x2f, 0]);
  });
});

/** Records what the engine schedules, without a real audio device. */
function fakeContext() {
  const log: string[] = [];
  const param = (name: string) => ({
    value: 0,
    setValueAtTime: (v: number, t: number) =>
      log.push(`${name}=${v}@${t.toFixed(2)}`),
    setTargetAtTime: () => undefined,
    linearRampToValueAtTime: (v: number, t: number) =>
      log.push(`${name}->${v}@${t.toFixed(2)}`),
    exponentialRampToValueAtTime: () => undefined,
  });
  const node = () => ({ connect: (n: unknown) => n });
  const ctx = {
    currentTime: 1,
    sampleRate: 8000,
    state: 'running',
    destination: {},
    createBuffer: (_c: number, length: number) => ({
      length,
      copyToChannel: () => undefined,
    }),
    createBufferSource: () => ({
      ...node(),
      buffer: null,
      detune: param('detune'),
      start: (t: number) => log.push(`note@${t.toFixed(2)}`),
      stop: () => undefined,
    }),
    createGain: () => ({ ...node(), gain: param('gain') }),
    createOscillator: () => ({
      ...node(),
      frequency: { value: 0 },
      start: (t: number) => log.push(`click@${t.toFixed(2)}`),
      stop: () => undefined,
    }),
    resume: async () => undefined,
    close: async () => undefined,
  };
  return { ctx: ctx as unknown as AudioContext, log };
}

function fakeTimers() {
  const intervals: (() => void)[] = [];
  const timeouts: [() => void, number][] = [];
  const api: TimerApi = {
    setInterval: (fn) => intervals.push(fn),
    clearInterval: () => intervals.splice(0),
    setTimeout: (fn, ms) => timeouts.push([fn, ms]),
    clearTimeout: () => timeouts.splice(0),
  };
  return { api, intervals, timeouts };
}

describe('PracticeAudio', () => {
  it('schedules notes after a short lead-in, bends gliding up, and reports the end', () => {
    const { ctx, log } = fakeContext();
    const timers = fakeTimers();
    const audio = new PracticeAudio(() => ctx, timers.api);
    const ended = vi.fn();
    const length = audio.play(
      [
        { midi: 64, start: 0, duration: 0.5, bendCents: 200 },
        { midi: null, start: 0.5, duration: 0.08, bendCents: 0 },
      ],
      ended,
    );
    expect(length).toBeCloseTo(0.58);
    expect(log).toEqual(
      expect.arrayContaining([
        'note@1.05',
        'detune=0@1.15',
        'detune->200@1.33',
        'note@1.55',
      ]),
    );
    expect(timers.timeouts[0][1]).toBeCloseTo(930);
    timers.timeouts[0][0]();
    expect(ended).toHaveBeenCalled();
  });

  it('runs a lookahead metronome with accents until stopped', () => {
    const { ctx, log } = fakeContext();
    const timers = fakeTimers();
    const audio = new PracticeAudio(() => ctx, timers.api);
    audio.startMetronome(120);
    expect(audio.metronomeRunning).toBe(true);
    expect(log.filter((l) => l.startsWith('click'))).toEqual(['click@1.05']);
    (ctx as unknown as { currentTime: number }).currentTime = 1.6;
    timers.intervals[0]();
    expect(log.filter((l) => l.startsWith('click'))).toEqual([
      'click@1.05',
      'click@1.55',
    ]);
    audio.stopMetronome();
    expect(audio.metronomeRunning).toBe(false);
    expect(timers.intervals).toHaveLength(0);
  });
});

describe('MidiOut', () => {
  it('lists outputs and sends timed note on/off, skipping muted notes', async () => {
    const sent: [number[], number][] = [];
    const output = {
      id: 'o1',
      name: 'Synth',
      send: (d: number[], t = 0) => sent.push([d, t]),
    };
    const midi = new MidiOut(
      async () => ({ outputs: { values: () => [output] } }),
      () => 1000,
    );
    expect(midi.supported).toBe(true);
    expect(await midi.outputs()).toEqual([{ id: 'o1', name: 'Synth' }]);
    await midi.play('o1', [
      { midi: 60, start: 0, duration: 0.5, bendCents: 0 },
      { midi: null, start: 0.5, duration: 0.08, bendCents: 0 },
    ]);
    expect(sent).toEqual([
      [[0x90, 60, 96], 1050],
      [[0x80, 60, 0], 1550],
    ]);
    await expect(midi.play('gone', [])).rejects.toThrow(/no longer available/);
  });

  it('reports no support without Web MIDI', async () => {
    const midi = new MidiOut(null);
    expect(midi.supported).toBe(false);
    expect(await midi.outputs()).toEqual([]);
  });
});
