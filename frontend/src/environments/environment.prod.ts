export const environment = {
  /** Sentry error tracking: paste the DSN from sentry.io to enable. Empty = off. */
  sentryDsn: 'https://8807a00647d9bb8c79b279461642c95f@o4512192308772864.ingest.de.sentry.io/4512192315588689',
  apiUrl: 'https://crimespot-api.onrender.com',
  keycloak: {
    url: 'https://crimespot-auth.onrender.com',
    realm: 'crimespot',
    clientId: 'crimespot-web',
  },
};
