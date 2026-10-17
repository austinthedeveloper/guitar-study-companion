import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import {
  apiBaseInterceptor,
  ApiConfig,
  retryInterceptor,
} from '@gsc/web/data-access';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(
      withFetch(),
      withInterceptors([apiBaseInterceptor, retryInterceptor]),
    ),
    provideAppInitializer(() => inject(ApiConfig).load()),
    provideRouter(appRoutes, withComponentInputBinding()),
  ],
};
