import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';
import { PushService } from '../core/push.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  template: `
    <div class="page narrow">
      <div class="page-head"><h1>Profile</h1></div>

      <form class="panel panel-body" (ngSubmit)="save()">
        <h2>About you</h2>
        <div class="field">
          <label for="name">Name</label>
          <input id="name" name="name" [(ngModel)]="name" maxlength="120" autocomplete="name">
          <span class="hint">Friends see this name. Reports never show it.</span>
        </div>
        <div class="field">
          <label for="phone">Phone number</label>
          <input id="phone" name="phone" type="tel" [(ngModel)]="phone" maxlength="30" autocomplete="tel" placeholder="082 123 4567">
          <span class="hint">Only your friends see this, so they can call you during an emergency alert.</span>
        </div>
        <button class="btn btn-ink" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
      </form>

      <section class="panel panel-body">
        <h2>Notifications</h2>
        @switch (push.state()) {
          @case ('on') {
            <p>On for this device. You'll be alerted when a friend presses SOS.</p>
            <button class="btn btn-sm" type="button" (click)="push.disable()">Turn off on this device</button>
          }
          @case ('blocked') {
            <p class="warn">Blocked by your browser. Allow notifications for this site in your browser settings, then reload.</p>
          }
          @case ('unsupported') {
            <p class="warn">Not available here. On iPhone, tap Share, then "Add to Home Screen", and open CrimeSpot from your home screen.</p>
          }
          @default {
            <p>Turn on notifications so you hear about a friend's emergency even when CrimeSpot is closed.</p>
            <button class="btn btn-vest" type="button" (click)="enablePush()">Turn on notifications</button>
          }
        }
      </section>

      <section class="panel panel-body">
        <h2>Account</h2>
        <p class="muted small">Signed in as {{ auth.user()?.email }}</p>
        <div class="row">
          <button class="btn" type="button" (click)="auth.manageAccount()">Password and security</button>
          <button class="btn btn-danger" type="button" (click)="auth.logout()">Sign out</button>
        </div>
      </section>
    </div>
  `,
  styles: `
    .narrow { max-width: 640px; }
    section, form { margin-bottom: 20px; }
    h2 { margin-bottom: 12px; }
    p { margin-bottom: 12px; }
    .warn { color: #7A1F16; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; }
  `,
})
export class Profile implements OnInit {
  protected auth = inject(AuthService);
  protected push = inject(PushService);
  private toast = inject(ToastService);

  readonly saving = signal(false);
  name = '';
  phone = '';

  async ngOnInit(): Promise<void> {
    const u = await this.auth.ensureUser();
    this.name = u?.fullName ?? '';
    this.phone = u?.phone ?? '';
    this.push.check();
  }

  save(): void {
    this.saving.set(true);
    this.auth.updateProfile({ fullName: this.name, phone: this.phone }).subscribe({
      next: u => { this.auth.user.set(u); this.saving.set(false); this.toast.ok('Profile saved.'); },
      error: err => { this.saving.set(false); this.toast.error(errorMessage(err)); },
    });
  }

  async enablePush(): Promise<void> {
    const problem = await this.push.enable();
    if (problem) this.toast.error(problem);
    else this.toast.ok('Notifications are on.');
  }
}
