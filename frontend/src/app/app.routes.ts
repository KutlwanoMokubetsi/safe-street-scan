import { Routes } from '@angular/router';
import { authGuard, guestGuard, moderatorGuard } from './core/guards';

export const routes: Routes = [
  { path: 'welcome', canActivate: [guestGuard], loadComponent: () => import('./pages/welcome').then(m => m.Welcome), title: 'CrimeSpot' },
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login').then(m => m.Login), title: 'Sign in · CrimeSpot' },

  { path: '', canActivate: [authGuard], loadComponent: () => import('./pages/dashboard').then(m => m.Dashboard), title: 'CrimeSpot' },
  { path: 'map', canActivate: [authGuard], loadComponent: () => import('./pages/map-page').then(m => m.MapPage), title: 'Map · CrimeSpot' },
  { path: 'report', canActivate: [authGuard], loadComponent: () => import('./pages/report-page').then(m => m.ReportPage), title: 'Report an incident · CrimeSpot' },
  { path: 'my-reports', canActivate: [authGuard], loadComponent: () => import('./pages/my-reports').then(m => m.MyReports), title: 'My reports · CrimeSpot' },
  { path: 'friends', canActivate: [authGuard], loadComponent: () => import('./pages/friends').then(m => m.Friends), title: 'Friends · CrimeSpot' },
  { path: 'live', canActivate: [authGuard], loadComponent: () => import('./pages/live-page').then(m => m.LivePage), title: 'Live location · CrimeSpot' },
  { path: 'sos', canActivate: [authGuard], loadComponent: () => import('./pages/sos').then(m => m.Sos), title: 'Emergency · CrimeSpot' },
  { path: 'alerts/:id', canActivate: [authGuard], loadComponent: () => import('./pages/alert-page').then(m => m.AlertPage), title: 'Emergency alert · CrimeSpot' },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./pages/profile').then(m => m.Profile), title: 'Profile · CrimeSpot' },
  { path: 'moderate', canActivate: [authGuard, moderatorGuard], loadComponent: () => import('./pages/moderation').then(m => m.Moderation), title: 'Review reports · CrimeSpot' },

  { path: '**', redirectTo: '' },
];
