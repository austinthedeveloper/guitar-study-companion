import { AiProvider, AiProviderFactory } from './ai-provider';
import { FakeAiProvider } from './fake-provider';

export const DEFAULT_AI_PROVIDER = 'fake';

const factories = new Map<string, AiProviderFactory>([
  ['fake', () => new FakeAiProvider()],
]);

export function registerAiProvider(
  name: string,
  factory: AiProviderFactory,
): void {
  factories.set(name, factory);
}

export function availableAiProviders(): string[] {
  return [...factories.keys()].sort();
}

/** Resolves the provider named by AI_PROVIDER (default: fake). Throws on unknown names. */
export function createAiProvider(
  env: Readonly<Record<string, string | undefined>>,
): AiProvider {
  const name = env['AI_PROVIDER']?.trim() || DEFAULT_AI_PROVIDER;
  const factory = factories.get(name);
  if (!factory) {
    throw new Error(
      `Unknown AI_PROVIDER "${name}". Available: ${availableAiProviders().join(', ')}`,
    );
  }
  return factory(env);
}
