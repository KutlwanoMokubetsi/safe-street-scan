import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { keycloak } from './keycloak';

/** Adds a fresh Keycloak access token to every API call. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApi = req.url.startsWith(`${environment.apiUrl}/api/`);
  if (!isApi || !keycloak.authenticated) return next(req);

  return from(keycloak.updateToken(30).catch(() => false)).pipe(
    switchMap(() => {
      const token = keycloak.token;
      return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
    }),
    catchError((err: HttpErrorResponse) => {
      // The Keycloak session ended (expired or signed out elsewhere): sign in again.
      if (err.status === 401) keycloak.login({ redirectUri: location.href });
      return throwError(() => err);
    }),
  );
};

/** Turns an API error into one readable sentence. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return "Can't reach the server. Check your connection, or wait a minute if it's waking up.";
    return err.error?.detail || err.error?.message || fallback;
  }
  return fallback;
}
