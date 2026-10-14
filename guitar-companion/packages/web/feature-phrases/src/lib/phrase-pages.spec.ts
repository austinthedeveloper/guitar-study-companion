import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Phrase } from '@gsc/contracts';
import { PhraseDetailPage } from './phrase-detail-page';
import { PhraseListPage } from './phrase-list-page';

const phrase: Phrase = {
  id: 'abc',
  title: 'Bend lick',
  source: { bookTitle: 'Book', page: '63', songTitle: 'Song' },
  context: { tuningMidi: [64, 59, 55, 50, 45, 38], capo: 2, key: 'G' },
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
  draftProvider: 'openai',
  revision: 1,
  createdAt: '2026-10-13T12:00:00.000Z',
  updatedAt: '2026-10-13T12:00:00.000Z',
};

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
    ],
  });
});

async function render<T>(
  cmp: new (...args: never[]) => T,
  inputs: Record<string, unknown> = {},
) {
  const fixture = TestBed.createComponent(cmp);
  for (const [k, v] of Object.entries(inputs))
    fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  TestBed.tick();
  const http = TestBed.inject(HttpTestingController);
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { el: fixture.nativeElement as HTMLElement, http, settle };
}

const text = (el: HTMLElement, id: string) =>
  el.querySelector(`[data-testid="${id}"]`)?.textContent?.trim();

describe('PhraseDetailPage', () => {
  it('renders the phrase with tuning, rhythm, and origin', async () => {
    const { el, http, settle } = await render(PhraseDetailPage, { id: 'abc' });
    http.expectOne('/api/phrases/abc').flush(phrase);
    await settle();
    expect(text(el, 'phrase-heading')).toBe('Bend lick');
    expect(text(el, 'phrase-tuning')).toContain('Drop D');
    expect(text(el, 'phrase-rhythm')).toContain('Unknown');
    expect(text(el, 'phrase-origin')).toContain('openai');
    expect(text(el, 'cell-0-1')).toBe('17');
  });

  it('shows not found for 404', async () => {
    const { el, http, settle } = await render(PhraseDetailPage, {
      id: 'missing',
    });
    http.expectOne('/api/phrases/missing').flush(
      {
        error: {
          code: 'not_found',
          message: 'Phrase not found.',
          retryable: false,
        },
      },
      { status: 404, statusText: 'Not Found' },
    );
    await settle();
    expect(el.querySelector('[data-testid="phrase-not-found"]')).not.toBeNull();
  });
});

describe('PhraseListPage', () => {
  it('shows an empty state', async () => {
    const { el, http, settle } = await render(PhraseListPage);
    http.expectOne('/api/phrases').flush([]);
    await settle();
    expect(el.querySelector('[data-testid="phrases-empty"]')).not.toBeNull();
  });

  it('lists phrases', async () => {
    const { el, http, settle } = await render(PhraseListPage);
    http.expectOne('/api/phrases').flush([
      {
        id: 'abc',
        title: 'Bend lick',
        source: phrase.source,
        createdAt: phrase.createdAt,
      },
    ]);
    await settle();
    expect(
      el.querySelector('[data-testid="phrase-link-abc"]')?.textContent,
    ).toContain('Bend lick');
  });
});
