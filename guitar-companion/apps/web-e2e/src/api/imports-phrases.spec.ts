import { expect, test } from '@playwright/test';
import { ApiErrorSchema, InterpretResponseSchema } from '@gsc/contracts';
import { readFileSync } from 'node:fs';
import { fixture } from '../support/import-flow';
import { createPhrase, samplePhrase } from '../support/api';

const png = readFileSync(fixture('synthetic-lick.png')).toString('base64');
const body = {
  image: { mimeType: 'image/png', dataBase64: png },
  tuningMidi: [64, 59, 55, 50, 45, 40],
  consent: true,
};
const errorCode = async (res: { json(): Promise<unknown> }) =>
  ApiErrorSchema.parse(await res.json()).error.code;

test.describe('API: POST /api/imports/interpret', () => {
  test('returns a validated draft', async ({ request }) => {
    const res = await request.post('/api/imports/interpret', { data: body });
    expect(res.status()).toBe(200);
    const parsed = InterpretResponseSchema.parse(await res.json());
    expect(parsed.provider).toBe('fake');
    expect(parsed.draft.rhythmKnown).toBe(false);
  });

  test('requires consent', async ({ request }) => {
    const res = await request.post('/api/imports/interpret', {
      data: { ...body, consent: false },
    });
    expect(res.status()).toBe(400);
    expect(await errorCode(res)).toBe('consent_required');
  });

  test('rejects spoofed content types', async ({ request }) => {
    const res = await request.post('/api/imports/interpret', {
      data: { ...body, image: { mimeType: 'image/jpeg', dataBase64: png } },
    });
    expect(res.status()).toBe(415);
  });

  test('rejects oversized images', async ({ request }) => {
    const big = Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64');
    const res = await request.post('/api/imports/interpret', {
      data: { ...body, image: { mimeType: 'image/png', dataBase64: big } },
    });
    expect(res.status()).toBe(413);
  });

  test('rejects invalid JSON', async ({ request }) => {
    const res = await request.post('/api/imports/interpret', {
      data: '{nope',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBe(400);
  });

  test('ignores the fake-scenario header only outside E2E mode (here it is honoured)', async ({
    request,
  }) => {
    const res = await request.post('/api/imports/interpret', {
      data: body,
      headers: { 'x-gsc-fake-scenario': 'unavailable' },
    });
    expect(res.status()).toBe(502);
    expect(ApiErrorSchema.parse(await res.json()).error.retryable).toBe(true);
  });
});

test.describe('API: phrases', () => {
  test('creates and reads a phrase', async ({ request }) => {
    const phrase = await createPhrase(request, `API ${Date.now()}`);
    const res = await request.get(`/api/phrases/${phrase.id}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).events).toEqual(phrase.events);
  });

  test('rejects musically invalid phrases with per-event issues', async ({
    request,
  }) => {
    const bad = samplePhrase('bad');
    bad.events.push({
      id: 'e3',
      order: 0,
      stringIndex: 1,
      fret: 3,
      durationTicks: null,
      techniques: [],
    });
    const res = await request.post('/api/phrases', { data: bad });
    expect(res.status()).toBe(422);
    expect(ApiErrorSchema.parse(await res.json()).error.issues?.[0].path).toBe(
      'events.e3',
    );
  });

  test('rejects invented durations when rhythm is unknown', async ({
    request,
  }) => {
    const bad = samplePhrase('bad');
    bad.events[0].durationTicks = 480;
    expect((await request.post('/api/phrases', { data: bad })).status()).toBe(
      422,
    );
  });

  test('404s unknown phrases', async ({ request }) => {
    expect(
      (await request.get('/api/phrases/0123456789abcdef01234567')).status(),
    ).toBe(404);
  });
});
