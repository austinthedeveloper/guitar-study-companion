import OpenAI from 'openai';
import {
  AiEnv,
  AiProvider,
  InterpretTabInput,
  RawInterpretResult,
} from '../ai-provider';
import { DRAFT_WIRE_JSON_SCHEMA, wireToDraft } from '../draft-wire-schema';
import { AiError } from '../errors';
import { TAB_SYSTEM_PROMPT, tabUserPrompt } from '../prompts';

export interface OpenAiProviderOptions {
  apiKey: string;
  model: string;
  maxOutputTokens?: number;
  /** Injectable for tests. */
  client?: Pick<OpenAI, 'responses'>;
}

/** OpenAI Responses API with image input and strict JSON-schema output. */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly client: Pick<OpenAI, 'responses'>;

  constructor(private readonly options: OpenAiProviderOptions) {
    this.client =
      options.client ?? new OpenAI({ apiKey: options.apiKey, maxRetries: 1 });
  }

  static fromEnv(env: AiEnv): OpenAiProvider {
    const apiKey = env['OPENAI_API_KEY'];
    const model = env['OPENAI_MODEL'];
    if (!apiKey)
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
    if (!model)
      throw new Error(
        'OPENAI_MODEL is required when AI_PROVIDER=openai (a vision-capable model)',
      );
    return new OpenAiProvider({
      apiKey,
      model,
      maxOutputTokens: Number(env['AI_MAX_OUTPUT_TOKENS']) || undefined,
    });
  }

  async interpretTab(input: InterpretTabInput): Promise<RawInterpretResult> {
    const dataUrl = `data:${input.mimeType};base64,${Buffer.from(input.image).toString('base64')}`;
    const response = await this.client.responses.create(
      {
        model: this.options.model,
        max_output_tokens: this.options.maxOutputTokens ?? 8000,
        input: [
          { role: 'system', content: TAB_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: tabUserPrompt(input.tuningMidi) },
              { type: 'input_image', image_url: dataUrl, detail: 'high' },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'transcription_draft',
            strict: true,
            schema: DRAFT_WIRE_JSON_SCHEMA as unknown as Record<
              string,
              unknown
            >,
          },
        },
      },
      { signal: input.signal },
    );

    if (response.status === 'incomplete') {
      throw new AiError(
        'ai_invalid_output',
        `OpenAI response incomplete: ${response.incomplete_details?.reason ?? 'unknown'}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch (err) {
      throw new AiError(
        'ai_invalid_output',
        'OpenAI returned non-JSON output',
        { cause: err },
      );
    }
    return {
      draft: wireToDraft(parsed),
      model: response.model,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          }
        : undefined,
    };
  }
}
