// Dev: /api is proxied to Spring Boot (proxy.conf.json); Keycloak runs from docker compose.
export const environment = {
  apiUrl: '',
  keycloak: {
    url: 'http://localhost:8180',
    realm: 'crimespot',
    clientId: 'crimespot-web',
  },
};
