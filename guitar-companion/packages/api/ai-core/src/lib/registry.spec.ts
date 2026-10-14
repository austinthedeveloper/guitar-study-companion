import {
  availableAiProviders,
  createAiProvider,
  registerAiProvider,
} from './registry';

describe('AI provider registry', () => {
  it('defaults to the fake provider', () => {
    expect(createAiProvider({}).name).toBe('fake');
    expect(createAiProvider({ AI_PROVIDER: '  ' }).name).toBe('fake');
  });

  it('includes openai', () => {
    expect(availableAiProviders()).toContain('openai');
    expect(
      createAiProvider({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'k',
        OPENAI_MODEL: 'm',
      }).name,
    ).toBe('openai');
  });

  it('includes claude', () => {
    expect(
      createAiProvider({ AI_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'k' }).name,
    ).toBe('claude');
  });

  it('rejects unknown providers with the available list', () => {
    expect(() => createAiProvider({ AI_PROVIDER: 'nope' })).toThrow(
      /Unknown AI_PROVIDER "nope". Available: claude, fake, openai/,
    );
  });

  it('resolves registered providers and passes env through', () => {
    registerAiProvider('test-provider', (env) => ({
      name: `test-provider:${env['MODEL']}`,
      interpretTab: async () => ({ draft: null, model: 'x' }),
    }));
    expect(
      createAiProvider({ AI_PROVIDER: 'test-provider', MODEL: 'm1' }).name,
    ).toBe('test-provider:m1');
  });
});
