import { interpretTab } from '../interpret';
import { ClaudeProvider, DEFAULT_CLAUDE_MODEL } from './claude-provider';

const tuningMidi = [64, 59, 55, 50, 45, 40];
const wireDraft = {
  stringCount: 6,
  rhythmKnown: false,
  events: [
    {
      id: 'e1',
      order: 0,
      stringIndex: 1,
      fret: 15,
      durationTicks: null,
      techniques: ['bend'],
      bendSemitones: 2,
      confidence: 0.9,
      box: null,
    },
  ],
  uncertainties: [],
  detectedSymbols: [],
  notes: '',
};

function mockClient(response: Record<string, unknown>) {
  const create = vi.fn().mockResolvedValue(response);
  return { create, client: { beta: { messages: { create } } } as never };
}

const ok = (patch: Record<string, unknown> = {}) => ({
  model: 'claude-opus-5-5',
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(wireDraft) }],
  usage: { input_tokens: 1500, output_tokens: 200 },
  ...patch,
});

const run = (client: never) =>
  interpretTab(new ClaudeProvider({ client }), {
    image: new Uint8Array([0x89, 0x50]),
    mimeType: 'image/png',
    tuningMidi,
  });

describe('ClaudeProvider', () => {
  it('sends a base64 image with a JSON-schema output format, high effort, and refusal fallback', async () => {
    const { create, client } = mockClient(ok());
    const result = await run(client);

    const [body, options] = create.mock.calls[0];
    expect(body.model).toBe(DEFAULT_CLAUDE_MODEL);
    expect(body.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(body.fallbacks).toBe('default');
    expect(body.output_config.effort).toBe('high');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.messages[0].content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'iVA=' },
    });
    expect(body.messages[0].content[1].text).toContain(
      'TOP line is the highest-pitched string',
    );
    expect(options).toHaveProperty('signal');

    expect(result).toMatchObject({
      provider: 'claude',
      model: 'claude-opus-5-5',
      usage: { inputTokens: 1500, outputTokens: 200 },
    });
    expect(result.draft.events[0]).toMatchObject({
      fret: 15,
      bendSemitones: 2,
    });
  });

  it('maps a refusal to a retryable unavailable error', async () => {
    const { client } = mockClient(
      ok({
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: null },
        content: [],
      }),
    );
    await expect(run(client)).rejects.toMatchObject({ code: 'ai_unavailable' });
  });

  it('treats truncation and non-JSON as invalid output', async () => {
    await expect(
      run(mockClient(ok({ stop_reason: 'max_tokens' })).client),
    ).rejects.toMatchObject({ code: 'ai_invalid_output' });
    await expect(
      run(mockClient(ok({ content: [{ type: 'text', text: 'nope' }] })).client),
    ).rejects.toMatchObject({ code: 'ai_invalid_output' });
  });

  it('ignores non-text blocks such as thinking', async () => {
    const { client } = mockClient(
      ok({
        content: [
          { type: 'thinking', thinking: '' },
          { type: 'text', text: JSON.stringify(wireDraft) },
        ],
      }),
    );
    expect((await run(client)).draft.events).toHaveLength(1);
  });

  it('reads key and optional model override from env', () => {
    expect(() => ClaudeProvider.fromEnv({})).toThrow(/ANTHROPIC_API_KEY/);
    expect(ClaudeProvider.fromEnv({ ANTHROPIC_API_KEY: 'k' }).name).toBe(
      'claude',
    );
  });
});
