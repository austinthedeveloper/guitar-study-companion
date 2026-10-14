import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { HealthApi } from './health-api';

describe('HealthApi', () => {
  let api: HealthApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(HealthApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('parses a valid health response', async () => {
    const result = firstValueFrom(api.getHealth());
    const body = {
      status: 'ok',
      version: 'dev',
      time: '2026-10-13T12:00:00.000Z',
      checks: { database: 'up', aiProvider: 'fake' },
    };
    http.expectOne('/api/health').flush(body);
    expect(await result).toEqual(body);
  });

  it('rejects a malformed response', async () => {
    const result = firstValueFrom(api.getHealth());
    http.expectOne('/api/health').flush({ status: 'weird' });
    await expect(result).rejects.toThrow();
  });
});
