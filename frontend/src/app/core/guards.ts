import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () =>
  inject(AuthService).isLoggedIn() || inject(Router).parseUrl('/login');

export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isLoggedIn() || inject(Router).parseUrl('/');

export const moderatorGuard: CanActivateFn = () =>
  inject(AuthService).canModerate() || inject(Router).parseUrl('/');
