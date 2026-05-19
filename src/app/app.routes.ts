import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./shared/layout/layout.routes').then((c) => c.LAYOUT_ROUTES),
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
