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
    path: routerPath(ROUTE_PATHS.phrase),
    title: title('Phrase'),
    loadComponent: () =>
      import('@gsc/web/feature-phrases').then((m) => m.PhraseDetailPage),
  },
  { path: '**', title: title('Not found'), component: NotFoundComponent },
];
