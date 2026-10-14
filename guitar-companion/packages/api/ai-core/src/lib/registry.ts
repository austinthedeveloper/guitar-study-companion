import { AiEnv, AiProvider, AiProviderFactory } from './ai-provider';
import { FakeAiProvider } from './fake/fake-provider';
import { ClaudeProvider } from './providers/claude-provider';
import { OpenAiProvider } from './providers/openai-provider';

export const DEFAULT_AI_PROVIDER = 'fake';

const factories = new Map<string, AiProviderFactory>([
  ['fake', () => new FakeAiProvider()],
  ['openai', (env) => OpenAiProvider.fromEnv(env)],
  ['claude', (env) => ClaudeProvider.fromEnv(env)],
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

/** Resolves the provider named by AI_PROVIDER (default: fake). Throws on unknown names or missing config. */
export function createAiProvider(env: AiEnv): AiProvider {
  const name = env['AI_PROVIDER']?.trim() || DEFAULT_AI_PROVIDER;
  const factory = factories.get(name);
  if (!factory) {
    throw new Error(
      `Unknown AI_PROVIDER "${name}". Available: ${availableAiProviders().join(', ')}`,
    );
  }
  return factory(env);
}
