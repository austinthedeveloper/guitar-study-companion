import { APIRequestContext, expect } from '@playwright/test';
import {
  API_PATHS,
  CreatePhraseRequest,
  Phrase,
  PhraseSchema,
  UpdateHarmonyRequest,
} from '@gsc/contracts';

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
  context?: Partial<CreatePhraseRequest['context']>,
  events?: CreatePhraseRequest['events'],
): Promise<Phrase> {
  const data = samplePhrase(title);
  data.context = { ...data.context, ...context };
  if (events) data.events = events;
  const res = await request.post('/api/phrases', { data });
  expect(res.status()).toBe(201);
  return PhraseSchema.parse(await res.json());
}

export async function updateHarmony(
  request: APIRequestContext,
  id: string,
  data: UpdateHarmonyRequest,
): Promise<Phrase> {
  const res = await request.put(API_PATHS.phraseHarmony(id), { data });
  expect(res.status()).toBe(200);
  return PhraseSchema.parse(await res.json());
}

/** Single notes on the high E string, e.g. frets 5 8 10 12 15 = A C D E G. */
export const highStringLick = (
  ...frets: number[]
): CreatePhraseRequest['events'] =>
  frets.map((fret, i) => ({
    id: `e${i + 1}`,
    order: i,
    stringIndex: 0,
    fret,
    durationTicks: null,
    techniques: [],
  }));
