import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent),
    title: 'Watch4Trees — Twoja Uwaga = Czyściejsza Planeta'
  },
  {
    path: 'auth',
    loadComponent: () => import('./pages/auth/auth.component').then(m => m.AuthComponent),
    title: 'Watch4Trees — Logowanie i Rejestracja'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    title: 'Watch4Trees — Eko-Pulpit Ogrodnika'
  },
  {
    path: 'watch',
    loadComponent: () => import('./pages/watch/watch.component').then(m => m.WatchComponent),
    canActivate: [authGuard],
    title: 'Watch4Trees — Sesja Oglądania i Zbieranie Kropel'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
