import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Phrase } from '@gsc/contracts';
import { AUDIO_ENGINE } from '@gsc/web/data-access';
import { TransposePage } from './transpose-page';

const phrase: Phrase = {
  id: 'abc',
  title: 'Bend lick',
  source: { bookTitle: 'Book' },
  context: {
    tuningMidi: [64, 59, 55, 50, 45, 40],
    capo: 0,
    key: 'E',
    chords: 'E7',
  },
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
      { provide: AUDIO_ENGINE, useValue: () => ({ dispose: () => undefined }) },
    ],
  });
});

async function render() {
  const fixture = TestBed.createComponent(TransposePage);
  fixture.componentRef.setInput('id', 'abc');
  fixture.detectChanges();
  TestBed.tick();
  TestBed.inject(HttpTestingController)
    .expectOne('/api/phrases/abc')
    .flush(phrase);
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r));
      TestBed.tick();
    }
    fixture.detectChanges();
  };
  await settle();
  const el = fixture.nativeElement as HTMLElement;
  const q = (id: string) =>
    el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const type = async (id: string, value: string) => {
    const input = q(id) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  return { q, type, el };
}

describe('TransposePage', () => {
  it('starts from the phrase key and asks for a target', async () => {
    const { q } = await render();
    expect((q('transpose-from') as HTMLInputElement).value).toBe('E');
    expect(q('transpose-hint')?.textContent).toContain('key to move it to');
  });

  it('transposes live, keeping roles, and moves the chords', async () => {
    const { q, type, el } = await render();
    await type('transpose-to', 'G');
    expect(q('transposed-heading')?.textContent).toContain(
      'In G major (up 3 semitones)',
    );
    expect(q('transpose-issues')).toBeNull();
    // E5 bent to F#5 over E7 becomes G5 bent to A5 over G7: still R→2.
    const row =
      el.querySelector('[data-testid="compare-row"]')?.textContent ?? '';
    expect(row).toContain('E5→F#5 (R→2 of E7)');
    expect(row).toContain('G5→A5 (R→2 of G7)');
    expect((q('apply-progression') as HTMLInputElement).value).toBe('G7');
  });
});
