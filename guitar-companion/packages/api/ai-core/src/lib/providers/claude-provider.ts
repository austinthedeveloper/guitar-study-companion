import Anthropic from '@anthropic-ai/sdk';
import {
  AiEnv,
  AiProvider,
  GenerateJsonInput,
  InterpretTabInput,
  RawInterpretResult,
  RawJsonResult,
} from '../ai-provider';
import { DRAFT_WIRE_JSON_SCHEMA, wireToDraft } from '../draft-wire-schema';
import { AiError } from '../errors';
import { TAB_SYSTEM_PROMPT, tabUserPrompt } from '../prompts';

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';
const IMAGE_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export interface ClaudeProviderOptions {
  model?: string;
  maxOutputTokens?: number;
  /** Injectable for tests. Defaults to a client that reads ANTHROPIC_API_KEY. */
  client?: Pick<Anthropic, 'beta'>;
}

/**
 * Anthropic Messages API with base64 image input and JSON-schema structured
 * output. Uses server-side refusal fallback so a policy decline on the
 * primary model is retried on a fallback model within the same call.
 */
export class ClaudeProvider implements AiProvider {
  readonly name = 'claude';
  private readonly client: Pick<Anthropic, 'beta'>;
  private readonly model: string;

  constructor(
    private readonly options: ClaudeProviderOptions & { apiKey?: string } = {},
  ) {
    this.client =
      options.client ??
      new Anthropic({ apiKey: options.apiKey, maxRetries: 1 });
    this.model = options.model ?? DEFAULT_CLAUDE_MODEL;
  }

  static fromEnv(env: AiEnv): ClaudeProvider {
    const apiKey = env['ANTHROPIC_API_KEY'];
    if (!apiKey)
      throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=claude');
    return new ClaudeProvider({
      apiKey,
      model: env['ANTHROPIC_MODEL'] || undefined,
      maxOutputTokens: Number(env['AI_MAX_OUTPUT_TOKENS']) || undefined,
    });
  }

  async interpretTab(input: InterpretTabInput): Promise<RawInterpretResult> {
    if (!IMAGE_TYPES.includes(input.mimeType)) {
      throw new AiError(
        'ai_invalid_output',
        `Unsupported image type for Claude: ${input.mimeType}`,
      );
    }
    const response = await this.client.beta.messages.create(
      {
        model: this.model,
        max_tokens: this.options.maxOutputTokens ?? 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        // Transcription accuracy matters more than latency; this model defaults to medium.
        output_config: {
          effort: 'high',
          format: {
            type: 'json_schema',
            schema: DRAFT_WIRE_JSON_SCHEMA as unknown as Record<
              string,
              unknown
            >,
          },
        },
        system: TAB_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: input.mimeType as ImageMediaType,
                  data: Buffer.from(input.image).toString('base64'),
                },
              },
              { type: 'text', text: tabUserPrompt(input.tuningMidi) },
            ],
          },
        ],
      },
      { signal: input.signal },
    );

    const { json, model, usage } = parseMessage(
      response,
      'transcribe this image',
    );
    return { draft: wireToDraft(json), model, usage };
  }

  async generateJson(input: GenerateJsonInput): Promise<RawJsonResult> {
    const response = await this.client.beta.messages.create(
      {
        model: this.model,
        max_tokens: this.options.maxOutputTokens ?? 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          format: { type: 'json_schema', schema: input.schema },
        },
        system: input.system,
        messages: [{ role: 'user', content: input.prompt }],
      },
      { signal: input.signal },
    );
    return parseMessage(response, 'answer');
  }
}

type ClaudeMessage = Awaited<
  ReturnType<Pick<Anthropic, 'beta'>['beta']['messages']['create']>
>;

function parseMessage(response: ClaudeMessage, task: string): RawJsonResult {
  if (!('content' in response))
    throw new AiError('ai_invalid_output', 'Claude returned a stream');
  if (response.stop_reason === 'refusal') {
    throw new AiError(
      'ai_unavailable',
      `Claude declined to ${task} (${response.stop_details?.category ?? 'unspecified'})`,
    );
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AiError(
      'ai_invalid_output',
      'Claude response was cut off at the output token limit',
    );
  }
  const text = response.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join('');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new AiError('ai_invalid_output', 'Claude returned non-JSON output', {
      cause: err,
    });
  }
  return {
    json,
    model: response.model,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
