import { HttpErrorResponse, HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { clearSession, keycloak } from './keycloak';
import { currentLang } from './i18n';
import { signal } from '@angular/core';
import { tap } from 'rxjs';

/** True while the API keeps failing (server down or unreachable), so the app can say so. */
export const apiDown = signal(false);
let failures = 0;

/** Adds a fresh Keycloak access token to every API call. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApi = req.url.startsWith(`${environment.apiUrl}/api/`);
  if (!isApi) return next(req);
  // Server messages and errors come back in the user's language.
  req = req.clone({ setHeaders: { 'Accept-Language': currentLang() } });
  const health = tap<HttpEvent<unknown>>({
    next: () => { failures = 0; apiDown.set(false); },
    error: (e: HttpErrorResponse) => {
      if (e.status === 0 || e.status >= 502) { if (++failures >= 2) apiDown.set(true); } else { failures = 0; apiDown.set(false); }
    },
  });
  if (!keycloak.authenticated) return next(req).pipe(health);

  return from(keycloak.updateToken(30).catch(() => false)).pipe(
    switchMap(() => {
      const token = keycloak.token;
      return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req).pipe(health);
    }),
    catchError((err: HttpErrorResponse) => {
      // The session ended (expired or signed out elsewhere): back to our sign-in page.
      if (err.status === 401) {
        clearSession();
        keycloak.clearToken();
        location.assign('/login');
      }
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
