import Keycloak from 'keycloak-js';
import { environment } from '../../environments/environment';

/** Single Keycloak instance, initialised before the app starts (see app.config.ts). */
export const keycloak = new Keycloak({
  url: environment.keycloak.url,
  realm: environment.keycloak.realm,
  clientId: environment.keycloak.clientId,
});

const STORE_KEY = 'crimespot.session';

interface StoredSession { token: string; refreshToken: string; idToken?: string; }

function readSession(): StoredSession | null {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null'); } catch { return null; }
}

function saveSession(): void {
  if (!keycloak.token || !keycloak.refreshToken) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      token: keycloak.token, refreshToken: keycloak.refreshToken, idToken: keycloak.idToken,
    } satisfies StoredSession));
  } catch { /* private mode: session lasts until the tab closes */ }
}

export function clearSession(): void {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}

/**
 * Never redirects to Keycloak on load. It only:
 *  - finishes a sign-in when we come back from Keycloak's login page, or
 *  - restores the session saved on this device and refreshes it in the background.
 * People who aren't signed in see the home page; Keycloak opens only when they choose to sign in.
 */
export async function initKeycloak(): Promise<void> {
  keycloak.onAuthSuccess = saveSession;
  keycloak.onAuthRefreshSuccess = saveSession;
  keycloak.onAuthLogout = clearSession;
  keycloak.onAuthRefreshError = clearSession;

  const stored = readSession();
  try {
    await keycloak.init({
      pkceMethod: 'S256',
      checkLoginIframe: false,
      ...(stored ? { token: stored.token, refreshToken: stored.refreshToken, idToken: stored.idToken } : {}),
    });
    if (keycloak.authenticated) {
      // A saved access token is usually expired; swap it for a fresh one now.
      await keycloak.updateToken(-1);
      saveSession();
    }
  } catch {
    // Session expired or Keycloak unreachable: start signed out.
    clearSession();
    keycloak.clearToken();
  }
}
