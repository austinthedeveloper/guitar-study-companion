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
import { apiBaseInterceptor, ApiConfig } from './api-config';

const respond = (body: unknown, ok = true) =>
  (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

describe('ApiConfig', () => {
  it('reads an https apiBaseUrl and trims trailing slashes', async () => {
    const c = new ApiConfig();
    await c.load(respond({ apiBaseUrl: 'https://api.example.net/' }));
    expect(c.baseUrl).toBe('https://api.example.net');
  });

  it('stays relative without a config, with HTML, or with a non-https URL', async () => {
    for (const fetchFn of [
      respond({}, false),
      (async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError('html');
        },
      })) as unknown as typeof fetch,
      respond({ apiBaseUrl: 'http://insecure.example.net' }),
    ]) {
      const c = new ApiConfig();
      await c.load(fetchFn);
      expect(c.baseUrl).toBe('');
    }
  });
});

describe('apiBaseInterceptor', () => {
  it('prefixes /api requests only when a base is set', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    const local = firstValueFrom(http.get('/api/health'));
    ctrl.expectOne('/api/health').flush({});
    await local;
    TestBed.inject(ApiConfig).baseUrl = 'https://api.example.net';
    const remote = firstValueFrom(http.get('/api/health'));
    ctrl.expectOne('https://api.example.net/api/health').flush({});
    await remote;
    const other = firstValueFrom(http.get('/assets/x.json'));
    ctrl.expectOne('/assets/x.json').flush({});
    await other;
  });
});
