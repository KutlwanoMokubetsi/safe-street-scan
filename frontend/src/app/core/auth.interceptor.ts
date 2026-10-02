import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      // Expired or invalid session: send the person back to sign in.
      if (err.status === 401 && token && !req.url.includes('/api/auth/login')) auth.logout();
      return throwError(() => err);
    }),
  );
};

/** Turns an API error into one readable sentence. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return "Can't reach the server. Check your connection.";
    return err.error?.detail || err.error?.message || fallback;
  }
  return fallback;
}
