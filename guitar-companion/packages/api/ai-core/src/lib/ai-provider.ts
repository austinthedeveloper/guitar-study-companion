import { AiUsage } from '@gsc/contracts';

export interface InterpretTabInput {
  image: Uint8Array;
  mimeType: string;
  tuningMidi: readonly number[];
  signal?: AbortSignal;
  /** Test-only scenario hint, honoured by the fake provider when E2E_MODE is on. */
  scenario?: string;
}

/** Unvalidated provider output; `draft` is parsed by interpretTab(). */
export interface RawInterpretResult {
  draft: unknown;
  model: string;
  usage?: AiUsage;
}

/** A text-only task answered as JSON matching `schema`. */
export interface GenerateJsonInput {
  /** Identifies the task for logs and the fake provider. */
  task: 'explain-phrase' | 'coach-exercises';
  system: string;
  prompt: string;
  schemaName: string;
  /** Strict-mode JSON Schema (all properties required, optional = nullable). */
  schema: Record<string, unknown>;
  /** The structured task input the prompt was built from (used by the fake provider). */
  data: unknown;
  signal?: AbortSignal;
  /** Test-only scenario hint, honoured by the fake provider when E2E_MODE is on. */
  scenario?: string;
}

export interface RawJsonResult {
  json: unknown;
  model: string;
  usage?: AiUsage;
}

/**
 * Provider-neutral AI boundary (ADR-006). Capabilities are added per
 * milestone; every provider's output is validated before use.
 */
export interface AiProvider {
  /** Stable identifier, also the value of the AI_PROVIDER setting. */
  readonly name: string;
  interpretTab(input: InterpretTabInput): Promise<RawInterpretResult>;
  /** Unvalidated JSON for a text task; callers validate with zod. */
  generateJson(input: GenerateJsonInput): Promise<RawJsonResult>;
}

export type AiEnv = Readonly<Record<string, string | undefined>>;
export type AiProviderFactory = (env: AiEnv) => AiProvider;
