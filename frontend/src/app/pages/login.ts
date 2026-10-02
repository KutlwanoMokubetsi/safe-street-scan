import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { TPipe } from '../core/i18n';

@Component({
  selector: 'app-login',
  imports: [RouterLink, TPipe],
  template: `
    <div class="wrap">
      <a routerLink="/welcome" class="brand" aria-label="CrimeSpot home">
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
          <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z" fill="#F5C518"/>
          <circle cx="12" cy="9" r="2.6" fill="#17202B"/>
        </svg>
        <span>CrimeSpot</span>
      </a>

      <main class="panel panel-body box">
        <h1>{{ 'welcome.signin' | t }}</h1>
        <p class="muted">New here? The same buttons create your account.</p>

        <button class="btn google" type="button" (click)="auth.loginWithGoogle()">
          <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/>
            <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.4 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>
          </svg>
          {{ 'login.google' | t }}
        </button>

        <div class="or" aria-hidden="true"><span>or with your email</span></div>

        <button class="btn btn-ink full" type="button" (click)="auth.login()">{{ 'login.email' | t }}</button>
        <button class="btn full" type="button" (click)="auth.register()">{{ 'login.create' | t }}</button>

        <p class="muted small note">
          By continuing you agree to the <a href="/terms.html">terms of use</a> and
          <a href="/privacy.html">privacy policy</a>.
        </p>
      </main>

      <a routerLink="/welcome" class="back">{{ 'login.back' | t }}</a>
    </div>
  `,
  styles: `
    .wrap {
      min-height: 100vh; padding: 32px 16px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
      background: var(--ink);
    }
    .brand { display: flex; align-items: center; gap: 8px; color: #fff; text-decoration: none; font: 700 1.5rem var(--font-head); }
    .box { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 10px; }
    h1 { font-size: 1.8rem; }
    .box > p:first-of-type { margin-bottom: 10px; }
    .full, .google { width: 100%; min-height: 48px; }
    .google { background: #fff; border-color: #C4CBD1; }
    .or { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 0.85rem; margin: 6px 0; }
    .or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--line); }
    .note { margin-top: 10px; text-align: center; }
    .back { color: #C9D1D9; text-decoration: none; font-size: 0.95rem; }
    .back:hover { color: #fff; }
  `,
})
export class Login {
  protected auth = inject(AuthService);
}
