import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { clearSession, keycloak } from './keycloak';
import { User } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  /** Set once at startup from Keycloak; a sign-in or sign-out reloads the page. */
  readonly isLoggedIn = signal(!!keycloak.authenticated);
  readonly user = signal<User | null>(null);

  readonly canModerate = computed(() => ['MODERATOR', 'ADMIN'].includes(this.user()?.role ?? ''));
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  readonly firstName = computed(() => {
    const u = this.user();
    return (u?.fullName || u?.email.split('@')[0] || '').split(' ')[0];
  });

  private loading?: Promise<User | null>;

  /** Loads the local profile (role, friend code). Safe to call many times. */
  ensureUser(): Promise<User | null> {
    if (!this.isLoggedIn()) return Promise.resolve(null);
    if (this.user()) return Promise.resolve(this.user());
    this.loading ??= firstValueFrom(this.http.get<User>(`${environment.apiUrl}/api/me`))
      .then(u => { this.user.set(u); return u; })
      .catch(() => null)
      .finally(() => (this.loading = undefined));
    return this.loading;
  }

  async reloadUser(): Promise<void> {
    const u = await firstValueFrom(this.http.get<User>(`${environment.apiUrl}/api/me`));
    this.user.set(u);
  }

  updateProfile(data: { fullName?: string; phone?: string }) {
    return this.http.patch<User>(`${environment.apiUrl}/api/me`, data);
  }

  login(): void {
    keycloak.login({ redirectUri: `${location.origin}/` });
  }

  loginWithGoogle(): void {
    keycloak.login({ idpHint: 'google', redirectUri: `${location.origin}/` });
  }

  register(): void {
    keycloak.register({ redirectUri: `${location.origin}/` });
  }

  /** Change password, email etc. on Keycloak's account page. */
  manageAccount(): void {
    keycloak.accountManagement();
  }

  logout(): void {
    clearSession();
    keycloak.logout({ redirectUri: `${location.origin}/welcome` });
  }
}
