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

  it('rejects unknown providers with the available list', () => {
    expect(() => createAiProvider({ AI_PROVIDER: 'nope' })).toThrow(
      /Unknown AI_PROVIDER "nope". Available: fake/,
    );
  });

  it('resolves registered providers and passes env through', () => {
    registerAiProvider('test-provider', (env) => ({
      name: `test-provider:${env['MODEL']}`,
    }));
    expect(availableAiProviders()).toContain('test-provider');
    expect(
      createAiProvider({ AI_PROVIDER: 'test-provider', MODEL: 'm1' }).name,
    ).toBe('test-provider:m1');
  });
});
