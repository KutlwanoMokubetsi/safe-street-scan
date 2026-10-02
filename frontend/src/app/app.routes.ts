import { Routes } from '@angular/router';
import { authGuard, guestGuard, moderatorGuard } from './core/guards';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], data: { mode: 'login' },
    loadComponent: () => import('./pages/auth-page').then(m => m.AuthPage), title: 'Sign in · CrimeSpot' },
  { path: 'register', canActivate: [guestGuard], data: { mode: 'register' },
    loadComponent: () => import('./pages/auth-page').then(m => m.AuthPage), title: 'Create account · CrimeSpot' },

  { path: '', canActivate: [authGuard], loadComponent: () => import('./pages/dashboard').then(m => m.Dashboard), title: 'CrimeSpot' },
  { path: 'map', canActivate: [authGuard], loadComponent: () => import('./pages/map-page').then(m => m.MapPage), title: 'Map · CrimeSpot' },
  { path: 'report', canActivate: [authGuard], loadComponent: () => import('./pages/report-page').then(m => m.ReportPage), title: 'Report an incident · CrimeSpot' },
  { path: 'my-reports', canActivate: [authGuard], loadComponent: () => import('./pages/my-reports').then(m => m.MyReports), title: 'My reports · CrimeSpot' },
  { path: 'moderate', canActivate: [authGuard, moderatorGuard], loadComponent: () => import('./pages/moderation').then(m => m.Moderation), title: 'Review reports · CrimeSpot' },

  { path: '**', redirectTo: '' },
];
