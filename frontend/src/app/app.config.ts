import {
  ApplicationConfig, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withInMemoryScrolling, withPreloading, withViewTransitions } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { initKeycloak } from './core/keycloak';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Keycloak must finish before routing so guards know whether you're signed in.
    provideAppInitializer(() => initKeycloak()),
    provideRouter(routes,
      withComponentInputBinding(),
      withViewTransitions({ skipInitialTransition: true }),       // smooth cross-fade between pages
      withPreloading(PreloadAllModules),                            // other pages load in the background, so taps are instant
      withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
