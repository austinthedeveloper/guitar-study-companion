import { APIRequestContext, expect } from '@playwright/test';
import { CreatePhraseRequest, Phrase, PhraseSchema } from '@gsc/contracts';

export const samplePhrase = (title: string): CreatePhraseRequest => ({
  title,
  source: { bookTitle: 'API Seed Book', page: '1' },
  context: { tuningMidi: [64, 59, 55, 50, 45, 40], capo: 0 },
  rhythmKnown: false,
  ticksPerQuarter: 480,
  events: [
    {
      id: 'e1',
      order: 0,
      stringIndex: 1,
      fret: 17,
      durationTicks: null,
      techniques: ['bend'],
      bendSemitones: 2,
    },
    {
      id: 'e2',
      order: 1,
      stringIndex: 0,
      fret: 15,
      durationTicks: null,
      techniques: [],
    },
  ],
});

/** Seeds a phrase through the public API (no test-only backdoor needed). */
export async function createPhrase(
  request: APIRequestContext,
  title: string,
): Promise<Phrase> {
  const res = await request.post('/api/phrases', { data: samplePhrase(title) });
  expect(res.status()).toBe(201);
  return PhraseSchema.parse(await res.json());
}
