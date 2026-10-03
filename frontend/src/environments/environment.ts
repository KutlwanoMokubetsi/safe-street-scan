// Dev: /api is proxied to Spring Boot (proxy.conf.json); Keycloak runs from docker compose.
export const environment = {
  /** Sentry error tracking: paste the DSN from sentry.io to enable. Empty = off. */
  sentryDsn: '',
  apiUrl: '',
  keycloak: {
    url: 'http://localhost:8180',
    realm: 'crimespot',
    clientId: 'crimespot-web',
  },
};
