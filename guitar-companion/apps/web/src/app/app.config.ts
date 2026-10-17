import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { retryInterceptor } from '@gsc/web/data-access';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([retryInterceptor])),
    provideRouter(appRoutes, withComponentInputBinding()),
  ],
};
