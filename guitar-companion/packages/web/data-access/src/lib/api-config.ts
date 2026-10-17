import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

/**
 * Where the API lives. Deployed, the site and API are separate origins
 * (ADR-013), so `/config.json` names the API; locally there is no such
 * file and requests stay relative (`/api/...`) through the dev proxy.
 */
@Injectable({ providedIn: 'root' })
export class ApiConfig {
  baseUrl = '';

  /** Loads `/config.json` if it exists; anything else leaves URLs relative. */
  async load(fetchFn: typeof fetch = fetch): Promise<void> {
    try {
      const res = await fetchFn('/config.json', { cache: 'no-store' });
      if (!res.ok) return;
      const body = (await res.json()) as { apiBaseUrl?: unknown };
      if (
        typeof body.apiBaseUrl === 'string' &&
        /^https:\/\//.test(body.apiBaseUrl)
      )
        this.baseUrl = body.apiBaseUrl.replace(/\/+$/, '');
    } catch {
      // No config (or the dev server's HTML fallback): keep relative URLs.
    }
  }
}

/** Prefixes `/api/...` requests with the configured API origin. */
export const apiBaseInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(ApiConfig).baseUrl;
  return base && req.url.startsWith('/api/')
    ? next(req.clone({ url: `${base}${req.url}` }))
    : next(req);
};
