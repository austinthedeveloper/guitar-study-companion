import { TestBed } from '@angular/core/testing';
import { EditorEvent, parseCell } from './tab-editor-model';
import { TabEditorComponent } from './tab-editor';

const ev = (p: Partial<EditorEvent>): EditorEvent => ({
  id: 'e1',
  order: 0,
  stringIndex: 0,
  fret: 5,
  durationTicks: null,
  techniques: [],
  ...p,
});

async function setup(
  events: EditorEvent[],
  inputs: Record<string, unknown> = {},
) {
  const fixture = TestBed.createComponent(TabEditorComponent);
  fixture.componentRef.setInput('events', events);
  for (const [k, v] of Object.entries(inputs))
    fixture.componentRef.setInput(k, v);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const q = (id: string) =>
    el.querySelector<HTMLInputElement>(`[data-testid="${id}"]`);
  const type = async (id: string, value: string) => {
    const input = q(id);
    if (!input) throw new Error(`missing ${id}`);
    input.value = value;
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };
  return {
    fixture,
    el,
    q,
    type,
    events: () => fixture.componentInstance.events(),
  };
}

describe('parseCell', () => {
  it.each([
    ['', { kind: 'clear' }],
    [' X ', { kind: 'dead' }],
    ['0', { kind: 'fret', fret: 0 }],
    ['17', { kind: 'fret', fret: 17 }],
    ['25', { kind: 'invalid' }],
    ['a', { kind: 'invalid' }],
  ])('%j', (text, expected) => expect(parseCell(text)).toEqual(expected));
});

describe('TabEditorComponent', () => {
  it('renders frets on the right string rows and dead notes as x', async () => {
    const { q } = await setup([
      ev({}),
      ev({
        id: 'e2',
        order: 1,
        stringIndex: 2,
        fret: null,
        techniques: ['dead-note'],
      }),
    ]);
    expect(q('cell-0-0')?.value).toBe('5');
    expect(q('cell-1-2')?.value).toBe('x');
    expect(q('cell-1-0')?.value).toBe('');
  });

  it('edits, adds, and clears notes', async () => {
    const t = await setup([ev({})]);
    await t.type('cell-0-0', '7');
    expect(t.events()[0].fret).toBe(7);
    await t.type('cell-0-3', '2');
    expect(t.events()).toContainEqual(
      expect.objectContaining({ order: 0, stringIndex: 3, fret: 2 }),
    );
    await t.type('cell-0-0', '');
    expect(t.events().map((e) => e.stringIndex)).toEqual([3]);
  });

  it('turns x into a dead note and back', async () => {
    const t = await setup([ev({})]);
    await t.type('cell-0-0', 'x');
    expect(t.events()[0]).toMatchObject({
      fret: null,
      techniques: ['dead-note'],
    });
    await t.type('cell-0-0', '3');
    expect(t.events()[0]).toMatchObject({ fret: 3, techniques: [] });
  });

  it('reverts invalid entries', async () => {
    const t = await setup([ev({})]);
    await t.type('cell-0-0', '99');
    expect(t.events()[0].fret).toBe(5);
    expect(t.q('cell-0-0')?.value).toBe('5');
  });

  it('adds a position at the end and deletes a position', async () => {
    const t = await setup([ev({})]);
    t.q('add-column')?.click();
    await t.fixture.whenStable();
    await t.type('cell-1-1', '8');
    expect(t.events()).toContainEqual(
      expect.objectContaining({ order: 1, stringIndex: 1, fret: 8 }),
    );
    t.q('column-0')?.click();
    await t.fixture.whenStable();
    t.q('delete-column')?.click();
    await t.fixture.whenStable();
    expect(t.events()).toEqual([
      expect.objectContaining({ order: 0, stringIndex: 1, fret: 8 }),
    ]);
  });

  it('clears durations when rhythm becomes unknown', async () => {
    const t = await setup([ev({ durationTicks: 480 })], { rhythmKnown: true });
    const box = t.q('rhythm-known');
    if (!box) throw new Error('no toggle');
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    await t.fixture.whenStable();
    expect(t.events()[0].durationTicks).toBeNull();
    expect(t.fixture.componentInstance.rhythmKnown()).toBe(false);
  });

  it('flags low-confidence and uncertain notes for review, and invalid ones', async () => {
    const t = await setup(
      [
        ev({ confidence: 0.4 }),
        ev({ id: 'e2', order: 1, confidence: 0.99 }),
        ev({ id: 'e3', order: 2 }),
      ],
      {
        uncertainEventIds: ['e2'],
        issues: [{ eventId: 'e3', code: 'missing-fret', message: 'Bad' }],
      },
    );
    expect(t.q('cell-0-0')?.dataset['review']).toBe('true');
    expect(t.q('cell-1-0')?.dataset['review']).toBe('true');
    expect(t.q('cell-2-0')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows existing duration and bend values in the selects', async () => {
    const t = await setup(
      [ev({ durationTicks: 240, techniques: ['bend'], bendSemitones: 1 })],
      { rhythmKnown: true },
    );
    t.q('column-0')?.click();
    await t.fixture.whenStable();
    expect(t.q('duration-0')?.value).toBe('240');
    expect(t.q('bend-0')?.value).toBe('1');
  });

  it('shows an empty state', async () => {
    const t = await setup([]);
    expect(t.q('tab-editor-empty')).not.toBeNull();
  });

  it('is read-only when asked', async () => {
    const t = await setup([ev({})], { readonly: true });
    expect(t.el.querySelector('input')).toBeNull();
    expect(t.el.querySelector('[data-testid="cell-0-0"]')?.textContent).toBe(
      '5',
    );
  });
});
