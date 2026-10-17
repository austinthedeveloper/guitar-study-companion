import { Route } from '@angular/router';
import { ROUTE_PATHS, routerPath } from '@gsc/web/routes';
import { NotFoundComponent } from '@gsc/web/ui';

const title = (page: string) => `${page} · Guitar Study Companion`;

export const appRoutes: Route[] = [
  {
    path: routerPath(ROUTE_PATHS.home),
    pathMatch: 'full',
    title: 'Guitar Study Companion',
    loadComponent: () =>
      import('@gsc/web/feature-home').then((m) => m.HomePage),
  },
  {
    path: routerPath(ROUTE_PATHS.import),
    title: title('Import'),
    loadComponent: () =>
      import('@gsc/web/feature-import').then((m) => m.ImportPage),
  },
  {
    path: routerPath(ROUTE_PATHS.phrases),
    title: title('My phrases'),
    loadComponent: () =>
      import('@gsc/web/feature-phrases').then((m) => m.PhraseListPage),
  },
  {
    path: routerPath(ROUTE_PATHS.review),
    title: title('Review'),
    loadComponent: () =>
      import('@gsc/web/feature-practice').then((m) => m.ReviewPage),
  },
  {
    path: routerPath(ROUTE_PATHS.phrase),
    title: title('Phrase'),
    loadComponent: () =>
      import('@gsc/web/feature-phrases').then((m) => m.PhraseDetailPage),
  },
  {
    path: routerPath(ROUTE_PATHS.practice),
    title: title('Practice'),
    loadComponent: () =>
      import('@gsc/web/feature-practice').then((m) => m.PracticePage),
  },
  {
    path: routerPath(ROUTE_PATHS.transpose),
    title: title('Transpose'),
    loadComponent: () =>
      import('@gsc/web/feature-transpose').then((m) => m.TransposePage),
  },
  { path: '**', title: title('Not found'), component: NotFoundComponent },
];
