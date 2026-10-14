import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ImportPage } from './import-page';

describe('ImportPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(ImportPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const upload = async (file: File) => {
      const input = el.querySelector<HTMLInputElement>(
        '[data-testid="file-input"]',
      );
      if (!input) throw new Error('no input');
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      });
      input.dispatchEvent(new Event('change'));
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
    };
    return { el, upload };
  }

  it('starts on the upload step', async () => {
    const { el } = await render();
    expect(el.querySelector('[data-testid="step-upload"]')).not.toBeNull();
    expect(el.querySelector('[aria-current="step"]')?.textContent).toContain(
      'Upload',
    );
  });

  it('rejects unsupported files without leaving the upload step', async () => {
    const { el, upload } = await render();
    await upload(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect(el.querySelector('[data-testid="alert"]')?.textContent).toContain(
      'Unsupported file type',
    );
    expect(el.querySelector('[data-testid="step-upload"]')).not.toBeNull();
  });

  it('rejects empty files', async () => {
    const { el, upload } = await render();
    await upload(new File([], 'page.jpg', { type: 'image/jpeg' }));
    expect(el.querySelector('[data-testid="alert"]')?.textContent).toContain(
      'empty',
    );
  });
});
