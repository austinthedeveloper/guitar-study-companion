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

/**
 * Provider-neutral AI boundary (ADR-006). Capabilities are added per
 * milestone; every provider's output is validated before use.
 */
export interface AiProvider {
  /** Stable identifier, also the value of the AI_PROVIDER setting. */
  readonly name: string;
  interpretTab(input: InterpretTabInput): Promise<RawInterpretResult>;
}

export type AiEnv = Readonly<Record<string, string | undefined>>;
export type AiProviderFactory = (env: AiEnv) => AiProvider;
