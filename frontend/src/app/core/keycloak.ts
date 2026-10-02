import Keycloak from 'keycloak-js';
import { environment } from '../../environments/environment';

/** Single Keycloak instance, initialised before the app starts (see app.config.ts). */
export const keycloak = new Keycloak({
  url: environment.keycloak.url,
  realm: environment.keycloak.realm,
  clientId: environment.keycloak.clientId,
});

export async function initKeycloak(): Promise<void> {
  try {
    await keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
      silentCheckSsoRedirectUri: `${location.origin}/silent-check-sso.html`,
    });
  } catch (e) {
    // Keycloak unreachable: the app still loads and shows the sign-in page.
    console.error('Keycloak init failed', e);
  }
}
