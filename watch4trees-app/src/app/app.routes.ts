import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent),
    title: 'Watch4Trees - Twoja uwaga = czyściejsza planeta'
  },
  {
    path: 'auth',
    loadComponent: () => import('./pages/auth/auth.component').then(m => m.AuthComponent),
    title: 'Watch4Trees - Logowanie i rejestracja'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    title: 'Watch4Trees - Eko-pulpit ogrodnika'
  },
  {
    path: 'watch',
    loadComponent: () => import('./pages/watch/watch.component').then(m => m.WatchComponent),
    canActivate: [authGuard],
    title: 'Watch4Trees - Sesja oglądania i zbieranie kropel'
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/legal/legal.component').then(m => m.LegalComponent),
    data: { legalPage: 'privacy' },
    title: 'Watch4Trees - Polityka prywatności'
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/legal/legal.component').then(m => m.LegalComponent),
    data: { legalPage: 'terms' },
    title: 'Watch4Trees - Regulamin serwisu'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
