import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { retryInterceptor } from './retry.interceptor';

describe('retryInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([retryInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => vi.useRealTimers());

  it('retries a GET twice on 503, then succeeds', async () => {
    const result = firstValueFrom(http.get('/api/x'));
    ctrl.expectOne('/api/x').flush('busy', { status: 503, statusText: 'Busy' });
    await vi.advanceTimersByTimeAsync(300);
    ctrl.expectOne('/api/x').flush('busy', { status: 503, statusText: 'Busy' });
    await vi.advanceTimersByTimeAsync(900);
    ctrl.expectOne('/api/x').flush({ ok: true });
    await expect(result).resolves.toEqual({ ok: true });
  });

  it('gives up after the retries', async () => {
    const result = firstValueFrom(http.get('/api/x'));
    ctrl
      .expectOne('/api/x')
      .flush('', { status: 502, statusText: 'Bad Gateway' });
    await vi.advanceTimersByTimeAsync(300);
    ctrl
      .expectOne('/api/x')
      .flush('', { status: 502, statusText: 'Bad Gateway' });
    await vi.advanceTimersByTimeAsync(900);
    ctrl
      .expectOne('/api/x')
      .flush('', { status: 502, statusText: 'Bad Gateway' });
    await expect(result).rejects.toMatchObject({ status: 502 });
  });

  it('does not retry client errors or writes', async () => {
    const get = firstValueFrom(http.get('/api/x'));
    ctrl
      .expectOne('/api/x')
      .flush('', { status: 404, statusText: 'Not Found' });
    await expect(get).rejects.toMatchObject({ status: 404 });
    const post = firstValueFrom(http.post('/api/x', {}));
    ctrl.expectOne('/api/x').flush('', { status: 503, statusText: 'Busy' });
    await expect(post).rejects.toMatchObject({ status: 503 });
    ctrl.verify();
  });
});
