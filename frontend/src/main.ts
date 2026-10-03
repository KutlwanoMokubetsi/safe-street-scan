import { bootstrapApplication } from '@angular/platform-browser';
import * as Sentry from '@sentry/angular';
import { environment } from './environments/environment';

// Error tracking only when a DSN is configured. No personal data, no session replays.
if (environment.sentryDsn) {
  // The browser SDK sends no personal data (IP, cookies) unless told to.
  Sentry.init({ dsn: environment.sentryDsn, tracesSampleRate: 0.05, environment: 'production', initialScope: { tags: { app: 'web' } } });
}
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
