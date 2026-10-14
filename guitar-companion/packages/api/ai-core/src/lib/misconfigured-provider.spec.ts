import { interpretTab } from './interpret';
import { createAiProviderSafely } from './misconfigured-provider';

describe('createAiProviderSafely', () => {
  it('returns the real provider when configured', () => {
    expect(createAiProviderSafely({}).name).toBe('fake');
  });

  it('reports misconfiguration instead of throwing', async () => {
    const onError = vi.fn();
    const provider = createAiProviderSafely({ AI_PROVIDER: 'openai' }, onError);
    expect(provider.name).toBe('openai (misconfigured)');
    expect(onError).toHaveBeenCalledWith(
      expect.stringMatching(/OPENAI_API_KEY/),
    );
    await expect(
      interpretTab(provider, {
        image: new Uint8Array([1]),
        mimeType: 'image/png',
        tuningMidi: [64, 59, 55, 50, 45, 40],
      }),
    ).rejects.toMatchObject({ code: 'ai_unavailable' });
  });
});
