import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse, User } from './models';

const TOKEN_KEY = 'crimespot.token';
const USER_KEY = 'crimespot.user';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly _token = signal<string | null>(read(TOKEN_KEY));
  private readonly _user = signal<User | null>(JSON.parse(read(USER_KEY) ?? 'null'));

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());
  readonly canModerate = computed(() => ['MODERATOR', 'ADMIN'].includes(this._user()?.role ?? ''));
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/api/auth/login`, { email, password })
      .pipe(tap(r => this.store(r)));
  }

  register(data: { email: string; password: string; fullName: string; phone?: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/api/auth/register`, data)
      .pipe(tap(r => this.store(r)));
  }

  /** Refreshes the cached user, so role changes made by an admin show up. */
  refreshMe(): void {
    if (!this._token()) return;
    this.http.get<User>(`${environment.apiUrl}/api/auth/me`).subscribe({
      next: u => { this._user.set(u); this.write(USER_KEY, JSON.stringify(u)); },
    });
  }

  logout(): void {
    this._token.set(null);
    this._user.set(null);
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
    this.router.navigateByUrl('/login');
  }

  private store(r: AuthResponse): void {
    this._token.set(r.token);
    this._user.set(r.user);
    this.write(TOKEN_KEY, r.token);
    this.write(USER_KEY, JSON.stringify(r.user));
  }

  private write(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* private mode: session only */ }
  }
}
