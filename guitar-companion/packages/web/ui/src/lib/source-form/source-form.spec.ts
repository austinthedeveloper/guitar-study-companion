import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SourceFormComponent, SourceFormValue } from './source-form';

/** Binds the output back to the input, the way the import page does. */
@Component({
  imports: [SourceFormComponent],
  template: `<gsc-source-form
    [initial]="meta()"
    (valueChange)="meta.set($event)"
  />`,
})
class HostComponent {
  readonly meta = signal<SourceFormValue | null>(null);
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('SourceFormComponent', () => {
  it('keeps spaces while typing when the output feeds back into initial', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const book = el.querySelector<HTMLInputElement>(
      '[data-testid="book-title"]',
    );
    const song = el.querySelector<HTMLInputElement>(
      '[data-testid="song-title"]',
    );
    if (!book || !song) throw new Error('inputs missing');

    type(book, 'Blues ');
    await fixture.whenStable();
    expect(book.value).toBe('Blues ');

    type(song, 'Lick ');
    await fixture.whenStable();
    expect(song.value).toBe('Lick ');
    expect(book.value).toBe('Blues ');
    expect(fixture.componentInstance.meta()?.source).toEqual({
      bookTitle: 'Blues',
      songTitle: 'Lick',
      page: undefined,
    });
  });

  it('seeds the form from initial', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.meta.set({
      source: { bookTitle: 'Fretboard Logic', page: '12' },
      context: { tuningMidi: [64, 59, 55, 50, 45, 40], capo: 2 },
    });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(
      el.querySelector<HTMLInputElement>('[data-testid="book-title"]')?.value,
    ).toBe('Fretboard Logic');
    expect(
      el.querySelector<HTMLInputElement>('[data-testid="page"]')?.value,
    ).toBe('12');
    expect(
      el.querySelector<HTMLInputElement>('[data-testid="capo"]')?.value,
    ).toBe('2');
  });
});
