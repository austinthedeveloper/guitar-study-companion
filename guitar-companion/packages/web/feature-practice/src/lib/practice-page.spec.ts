import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Phrase, PracticePlan } from '@gsc/contracts';
import { AUDIO_ENGINE } from '@gsc/web/data-access';
import { PracticePage } from './practice-page';

const phrase: Phrase = {
  id: 'abc',
  title: 'Bend lick',
  source: { bookTitle: 'Book' },
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
  ],
  revision: 2,
  createdAt: '2026-10-13T12:00:00.000Z',
  updatedAt: '2026-10-13T12:00:00.000Z',
};
const plan: PracticePlan = {
  id: 'plan1',
  phraseId: 'abc',
  phraseRevision: 2,
  settings: { difficulty: 'medium', minutes: 15, focus: 'balanced' },
  exercises: [
    {
      id: 'x1',
      kind: 'slow',
      title: 'Whole phrase, slowly',
      objective: 'Play it slowly.',
      eventIds: ['e1'],
      referenceNotes: [],
      tempo: { startBpm: 48, targetBpm: 80, stepBpm: 5, rhythmic: false },
      repetitions: 6,
      successCriterion: 'Clean at 80 bpm.',
      instructions: ['Raise the tempo after a clean run.'],
      coaching: ['Relax your thumb.'],
      minutes: 4,
    },
  ],
  rejected: [],
  coachedBy: { provider: 'fake', model: 'fake-coach' },
  createdAt: '2026-10-16T00:00:00.000Z',
};

const played: unknown[] = [];
beforeEach(() => {
  played.length = 0;
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: AUDIO_ENGINE,
        useValue: () => ({
          play: (events: unknown) => played.push(events),
          stopNotes: () => undefined,
          stopMetronome: () => undefined,
          dispose: () => undefined,
        }),
      },
    ],
  });
});

async function render() {
  const fixture = TestBed.createComponent(PracticePage);
  fixture.componentRef.setInput('id', 'abc');
  fixture.detectChanges();
  TestBed.tick();
  const http = TestBed.inject(HttpTestingController);
  // Not whenStable(): it would wait for requests the test hasn't flushed yet.
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r));
      TestBed.tick();
    }
    fixture.detectChanges();
  };
  const el = fixture.nativeElement as HTMLElement;
  const q = (id: string) =>
    el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  return { http, settle, q };
}

describe('PracticePage', () => {
  it('shows an empty state, then builds a plan for the current revision', async () => {
    const { http, settle, q } = await render();
    http.expectOne('/api/phrases/abc').flush(phrase);
    http.expectOne('/api/phrases/abc/plans/latest').flush(
      { error: { code: 'not_found', message: 'No plan', retryable: false } },
      {
        status: 404,
        statusText: 'Not Found',
      },
    );
    await settle();
    expect(q('plan-empty')?.textContent).toContain('No plan yet');

    q('plan-build')?.click();
    const req = http.expectOne('/api/phrases/abc/plans');
    expect(req.request.body).toEqual({
      revision: 2,
      settings: { difficulty: 'medium', minutes: 15, focus: 'balanced' },
    });
    req.flush(plan);
    await settle();
    http.expectOne('/api/plans/plan1/session').flush({
      planId: 'plan1',
      progress: {},
      notes: '',
      updatedAt: plan.createdAt,
    });
    await settle();
    expect(q('exercise-title')?.textContent).toContain('Whole phrase');
    expect(q('exercise-coaching')?.textContent).toContain('Relax your thumb.');
    expect(q('tempo')?.textContent).toContain('48 bpm');
  });

  it('plays the exercise notes with the bend, at the current tempo', async () => {
    const { http, settle, q } = await render();
    http.expectOne('/api/phrases/abc').flush(phrase);
    http.expectOne('/api/phrases/abc/plans/latest').flush(plan);
    await settle();
    http.expectOne('/api/plans/plan1/session').flush({
      planId: 'plan1',
      progress: {},
      notes: '',
      updatedAt: plan.createdAt,
    });
    await settle();
    q('tempo-up')?.click();
    await settle();
    expect(q('tempo')?.textContent).toContain('53 bpm');
    q('play')?.click();
    expect(played).toEqual([
      [
        {
          midi: 76,
          start: 0,
          duration: expect.closeTo((60 / 53) * 0.9),
          bendCents: 200,
        },
      ],
    ]);
  });

  it('saves completion with the tempo reached', async () => {
    const { http, settle, q } = await render();
    http.expectOne('/api/phrases/abc').flush(phrase);
    http.expectOne('/api/phrases/abc/plans/latest').flush(plan);
    await settle();
    http.expectOne('/api/plans/plan1/session').flush({
      planId: 'plan1',
      progress: {},
      notes: '',
      updatedAt: plan.createdAt,
    });
    await settle();
    q('exercise-done')?.click();
    const save = http.expectOne('/api/plans/plan1/session');
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({
      progress: { x1: { completedAt: expect.any(String), bestBpm: 48 } },
      notes: '',
    });
    save.flush({
      planId: 'plan1',
      ...save.request.body,
      updatedAt: plan.createdAt,
    });
    await settle();
    expect(q('plan-progress')?.textContent).toContain('1 of 1 done');
  });
});
