import { Route } from '@angular/router';
import { NotFoundComponent } from '@gsc/web/ui';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Guitar Study Companion',
    loadComponent: () =>
      import('@gsc/web/feature-home').then((m) => m.HomePage),
  },
  {
    path: '**',
    title: 'Not found · Guitar Study Companion',
    component: NotFoundComponent,
  },
];
