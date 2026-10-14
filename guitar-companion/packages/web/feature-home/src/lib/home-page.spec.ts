import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomePage } from './home-page';

describe('HomePage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
  });

  async function setup() {
    const fixture = TestBed.createComponent(HomePage);
    // Render once to start the request; whenStable() would wait on it.
    fixture.detectChanges();
    TestBed.tick();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('shows loading before the API responds', async () => {
    const { fixture, http } = await setup();
    fixture.detectChanges();
    expect(stateOf(fixture.nativeElement)).toBe('loading');
    http.expectOne('/api/health');
  });

  const stateOf = (el: HTMLElement) =>
    el.querySelector('[data-testid="api-status"]')?.getAttribute('data-state');

  it('renders API status once loaded', async () => {
    const { fixture, http } = await setup();
    http.expectOne('/api/health').flush({
      status: 'ok',
      version: 'dev',
      time: '2026-10-13T12:00:00.000Z',
      checks: { database: 'up', aiProvider: 'fake' },
    });
    await fixture.whenStable();
    expect(stateOf(fixture.nativeElement)).toBe('ok');
  });

  it('renders an error when the API fails', async () => {
    const { fixture, http } = await setup();
    http
      .expectOne('/api/health')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(stateOf(fixture.nativeElement)).toBe('error');
  });
});
