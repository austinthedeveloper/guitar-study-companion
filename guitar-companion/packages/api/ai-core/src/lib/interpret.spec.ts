import { AiProvider, RawInterpretResult } from './ai-provider';
import { FakeAiProvider } from './fake/fake-provider';
import { AiError } from './errors';
import { interpretTab } from './interpret';

const tuning = [64, 59, 55, 50, 45, 40];
const run = (scenario?: string, timeoutMs?: number) =>
  interpretTab(
    new FakeAiProvider(),
    {
      image: new Uint8Array([1]),
      mimeType: 'image/png',
      tuningMidi: tuning,
      scenario,
    },
    timeoutMs,
  );

describe('interpretTab', () => {
  it('returns a validated draft with unknown rhythm', async () => {
    const result = await run();
    expect(result.provider).toBe('fake');
    expect(result.rejectedEventCount).toBe(0);
    expect(result.draft.rhythmKnown).toBe(false);
    expect(result.draft.events.every((e) => e.durationTicks === null)).toBe(
      true,
    );
    expect(result.draft.events).toHaveLength(7);
  });

  it('keeps durations when rhythm is fully known', async () => {
    const result = await run('rhythm-known');
    expect(result.draft.rhythmKnown).toBe(true);
    expect(result.draft.events.every((e) => e.durationTicks === 240)).toBe(
      true,
    );
  });

  it('never keeps partial rhythm: clears all durations and explains why', async () => {
    const result = await run('partial-rhythm');
    expect(result.draft.rhythmKnown).toBe(false);
    expect(result.draft.events.every((e) => e.durationTicks === null)).toBe(
      true,
    );
    expect(
      result.draft.uncertainties.some((u) =>
        /Rhythm was only partly readable/.test(u.reason),
      ),
    ).toBe(true);
  });

  it('drops impossible events and explains each', async () => {
    const result = await run('invalid-events');
    expect(result.rejectedEventCount).toBe(2);
    expect(result.draft.events.map((e) => e.id)).not.toContain('e8');
    expect(result.draft.events.map((e) => e.id)).not.toContain('e9');
    expect(
      result.draft.uncertainties.filter((u) =>
        u.reason.startsWith('Removed a recognized note'),
      ),
    ).toHaveLength(2);
  });

  it('rejects schema-invalid output', async () => {
    await expect(run('invalid-output')).rejects.toMatchObject({
      code: 'ai_invalid_output',
    });
  });

  it('maps provider exceptions to ai_unavailable', async () => {
    await expect(run('unavailable')).rejects.toBeInstanceOf(AiError);
    await expect(run('unavailable')).rejects.toMatchObject({
      code: 'ai_unavailable',
    });
  });

  it('times out and aborts slow providers', async () => {
    await expect(run('timeout', 50)).rejects.toMatchObject({
      code: 'ai_timeout',
    });
  });

  it('allows an empty draft', async () => {
    const result = await run('empty');
    expect(result.draft.events).toEqual([]);
    expect(result.draft.uncertainties[0].reason).toMatch(/No tablature/);
  });
  describe('with several passes', () => {
    const draft = (...frets: number[]) => ({
      stringCount: 6,
      rhythmKnown: false,
      events: frets.map((fret, i) => ({
        id: `e${i + 1}`,
        order: i,
        stringIndex: 3,
        fret,
        durationTicks: null,
        techniques: [],
        confidence: 0.9,
      })),
      uncertainties: [],
      detectedSymbols: [],
      notes: '',
    });
    /** Answers each call with the next queued reading (or throws it). */
    const scripted = (
      ...readings: (ReturnType<typeof draft> | Error)[]
    ): AiProvider => ({
      name: 'scripted',
      interpretTab: async (): Promise<RawInterpretResult> => {
        const next = readings.shift();
        if (next instanceof Error) throw next;
        return {
          draft: next,
          model: 'm',
          usage: { inputTokens: 100, outputTokens: 10 },
        };
      },
    });
    const input = {
      image: new Uint8Array([1]),
      mimeType: 'image/png',
      tuningMidi: tuning,
    };

    it('flags notes the readings disagree on and sums usage', async () => {
      const result = await interpretTab(
        scripted(draft(5, 7, 5), draft(6, 7, 5)),
        input,
        1000,
        2,
      );
      expect(result.draft.events.map((e) => e.fret)).toEqual([5, 7, 5]);
      expect(result.draft.uncertainties).toEqual([
        expect.objectContaining({ eventIds: ['e1'] }),
      ]);
      expect(result.usage).toEqual({ inputTokens: 200, outputTokens: 20 });
    });

    it('adds nothing when the readings agree', async () => {
      const result = await interpretTab(
        scripted(draft(5, 7), draft(5, 7)),
        input,
        1000,
        2,
      );
      expect(result.draft.uncertainties).toEqual([]);
    });

    it('uses the surviving reading when one pass fails', async () => {
      const result = await interpretTab(
        scripted(new Error('boom'), draft(5, 7)),
        input,
        1000,
        2,
      );
      expect(result.draft.events.map((e) => e.fret)).toEqual([5, 7]);
      expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 10 });
    });

    it('fails only when every pass fails', async () => {
      await expect(
        interpretTab(scripted(new Error('a'), new Error('b')), input, 1000, 2),
      ).rejects.toMatchObject({ code: 'ai_unavailable' });
    });
  });
});
