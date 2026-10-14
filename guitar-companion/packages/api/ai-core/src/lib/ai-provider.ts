/**
 * Provider-neutral AI boundary (ADR-006). Capabilities (interpret, explain,
 * design practice) are added to this interface milestone by milestone; every
 * provider's output is validated against shared schemas before use.
 */
export interface AiProvider {
  /** Stable identifier, also the value of the AI_PROVIDER setting. */
  readonly name: string;
}

export type AiProviderFactory = (
  env: Readonly<Record<string, string | undefined>>,
) => AiProvider;
