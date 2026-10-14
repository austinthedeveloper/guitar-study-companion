import { OpenAiProvider } from './openai-provider';
import { interpretTab } from '../interpret';

function mockClient(response: Record<string, unknown>) {
  const create = vi.fn().mockResolvedValue(response);
  return { create, client: { responses: { create } } as never };
}

const wireDraft = {
  stringCount: 6,
  rhythmKnown: false,
  events: [
    {
      id: 'e1',
      order: 0,
      stringIndex: 1,
      fret: 17,
      durationTicks: null,
      techniques: ['bend'],
      bendSemitones: 2,
      confidence: 0.9,
      box: null,
    },
    {
      id: 'e2',
      order: 1,
      stringIndex: 1,
      fret: 17,
      durationTicks: null,
      techniques: ['release'],
      bendSemitones: null,
      confidence: 0.8,
      box: { x: 0.1, y: 0.2, width: 0.05, height: 0.05 },
    },
  ],
  uncertainties: [
    { eventIds: ['e2'], reason: 'Parenthesized fret', box: null },
  ],
  detectedSymbols: ['hold bend'],
  notes: '',
};

describe('OpenAiProvider', () => {
  it('sends the image with a strict JSON schema and maps the response', async () => {
    const { create, client } = mockClient({
      status: 'completed',
      model: 'test-model-2026',
      output_text: JSON.stringify(wireDraft),
      usage: { input_tokens: 1200, output_tokens: 300 },
    });
    const provider = new OpenAiProvider({
      apiKey: 'k',
      model: 'test-model',
      client,
    });
    const result = await interpretTab(provider, {
      image: new Uint8Array([0xff, 0xd8]),
      mimeType: 'image/jpeg',
      tuningMidi: [64, 59, 55, 50, 45, 40],
    });

    const [body] = create.mock.calls[0];
    expect(body.model).toBe('test-model');
    expect(body.text.format).toMatchObject({
      type: 'json_schema',
      strict: true,
    });
    expect(body.input[1].content[1]).toEqual({
      type: 'input_image',
      image_url: 'data:image/jpeg;base64,/9g=',
      detail: 'high',
    });
    expect(body.input[1].content[0].text).toContain(
      'TOP line is the highest-pitched string',
    );

    expect(result.provider).toBe('openai');
    expect(result.model).toBe('test-model-2026');
    expect(result.usage).toEqual({ inputTokens: 1200, outputTokens: 300 });
    expect(result.draft.events[0].bendSemitones).toBe(2);
    expect(result.draft.events[1]).not.toHaveProperty('bendSemitones');
    expect(result.draft.events[1].box).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.05,
      height: 0.05,
    });
  });

  it('treats incomplete responses as invalid output', async () => {
    const { client } = mockClient({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output_text: '',
    });
    const provider = new OpenAiProvider({ apiKey: 'k', model: 'm', client });
    await expect(
      interpretTab(provider, {
        image: new Uint8Array([1]),
        mimeType: 'image/png',
        tuningMidi: [64, 59, 55, 50, 45, 40],
      }),
    ).rejects.toMatchObject({
      code: 'ai_invalid_output',
    });
  });

  it('treats non-JSON as invalid output', async () => {
    const { client } = mockClient({
      status: 'completed',
      model: 'm',
      output_text: 'sorry',
    });
    const provider = new OpenAiProvider({ apiKey: 'k', model: 'm', client });
    await expect(
      interpretTab(provider, {
        image: new Uint8Array([1]),
        mimeType: 'image/png',
        tuningMidi: [64, 59, 55, 50, 45, 40],
      }),
    ).rejects.toMatchObject({
      code: 'ai_invalid_output',
    });
  });

  it('requires key and model from env', () => {
    expect(() => OpenAiProvider.fromEnv({})).toThrow(/OPENAI_API_KEY/);
    expect(() => OpenAiProvider.fromEnv({ OPENAI_API_KEY: 'k' })).toThrow(
      /OPENAI_MODEL/,
    );
    expect(
      OpenAiProvider.fromEnv({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm' }).name,
    ).toBe('openai');
  });
});
