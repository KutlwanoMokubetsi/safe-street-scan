import { Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="wrap">
      <section class="intro">
        <div class="mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="44" height="44">
            <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z" fill="#F5C518"/>
            <circle cx="12" cy="9" r="2.6" fill="#17202B"/>
          </svg>
        </div>
        <h1>Know what's happening on your street.</h1>
        <p>Report incidents, see where crime is clustering, and keep your neighbours informed. Reports are anonymous to other users.</p>
      </section>

      <section class="form-side">
        <form class="panel panel-body" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <h2>{{ isRegister() ? 'Create your account' : 'Sign in' }}</h2>

          @if (isRegister()) {
            <div class="field">
              <label for="fullName">Full name</label>
              <input id="fullName" formControlName="fullName" autocomplete="name">
            </div>
            <div class="field">
              <label for="phone">Phone <span class="muted">(optional)</span></label>
              <input id="phone" formControlName="phone" type="tel" autocomplete="tel" placeholder="082 123 4567">
            </div>
          }

          <div class="field">
            <label for="email">Email</label>
            <input id="email" formControlName="email" type="email" autocomplete="email">
          </div>

          <div class="field">
            <label for="password">Password</label>
            <input id="password" formControlName="password" type="password"
                   [attr.autocomplete]="isRegister() ? 'new-password' : 'current-password'">
            @if (isRegister()) { <span class="hint">At least 8 characters.</span> }
          </div>

          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }

          <button class="btn btn-ink full" type="submit" [disabled]="busy()">
            {{ busy() ? 'Please wait…' : (isRegister() ? 'Create account' : 'Sign in') }}
          </button>

          <p class="switch muted small">
            @if (isRegister()) {
              Already have an account? <a routerLink="/login">Sign in</a>
            } @else {
              New here? <a routerLink="/register">Create an account</a>
            }
          </p>
        </form>
      </section>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; }
    .intro { background: var(--ink); color: #fff; padding: 64px 48px; display: flex; flex-direction: column; justify-content: center; gap: 16px; }
    .intro h1 { font-size: clamp(2rem, 4vw, 3rem); max-width: 14ch; }
    .intro p { color: #C9D1D9; max-width: 42ch; font-size: 1.05rem; }
    .form-side { display: flex; align-items: center; justify-content: center; padding: 32px 16px; }
    form { width: 100%; max-width: 400px; }
    form h2 { margin-bottom: 20px; }
    .full { width: 100%; margin-top: 4px; }
    .err { color: var(--risk); margin-bottom: 12px; font-size: 0.9rem; }
    .switch { margin-top: 16px; text-align: center; }
    @media (max-width: 760px) {
      .wrap { grid-template-columns: 1fr; }
      .intro { padding: 32px 20px; }
      .intro h1 { font-size: 1.9rem; }
    }
  `,
})
export class AuthPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  /** Bound from route data. */
  readonly mode = input<'login' | 'register'>('login');
  readonly isRegister = computed(() => this.mode() === 'register');

  readonly busy = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    fullName: [''],
    phone: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    const v = this.form.getRawValue();
    if (!v.email || !v.password) return this.error.set('Enter your email and password.');
    if (this.form.controls.email.invalid) return this.error.set('Enter a valid email address.');
    if (this.isRegister()) {
      if (!v.fullName.trim()) return this.error.set('Enter your full name.');
      if (v.password.length < 8) return this.error.set('Use a password of at least 8 characters.');
    }

    this.busy.set(true);
    this.error.set('');
    const req = this.isRegister()
      ? this.auth.register({ email: v.email, password: v.password, fullName: v.fullName, phone: v.phone || undefined })
      : this.auth.login(v.email, v.password);

    req.subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: err => { this.error.set(errorMessage(err)); this.busy.set(false); },
    });
  }
}
