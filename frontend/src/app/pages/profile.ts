import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';
import { PushService } from '../core/push.service';
import { ToastService } from '../core/toast.service';
import { currentPosition } from '../core/geo';
import { ApiService } from '../core/api.service';
import { avatarSrc, initialsOf, toSquareJpeg } from '../core/avatar';
import { I18n, LANGS, TPipe } from '../core/i18n';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, TPipe, RouterLink],
  template: `
    <div class="page narrow">
      <div class="page-head"><h1>Profile</h1></div>

      <section class="panel panel-body pic-row">
        @if (avatar(); as src) { <img [src]="src" alt="Your profile picture" class="big"> }
        @else { <span class="big initials">{{ ini(auth.user()?.fullName || auth.user()?.email) }}</span> }
        <div>
          <h2>Profile picture</h2>
          <p class="muted small">Only you and your friends can see it.</p>
          <div class="row">
            <label class="btn btn-sm" [class.disabled]="picBusy()">
              {{ picBusy() ? 'Uploading…' : (avatar() ? 'Change picture' : 'Add a picture') }}
              <input type="file" accept="image/*" (change)="choose($event)" [disabled]="picBusy()" hidden>
            </label>
            @if (avatar()) { <button class="btn btn-sm btn-danger" type="button" (click)="removePic()">Remove</button> }
          </div>
        </div>
      </section>

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
        <h2>{{ 'lang.title' | t }}</h2>
        <div class="langs" role="radiogroup">
          @for (l of langs; track l.code) {
            <button type="button" class="btn btn-sm" [class.btn-ink]="i18n.lang() === l.code" role="radio"
                    [attr.aria-checked]="i18n.lang() === l.code" (click)="i18n.set(l.code)">{{ l.label }}</button>
          }
        </div>
        @if (i18n.lang() !== 'en') { <p class="muted small hint">{{ 'lang.note' | t }}</p> }
      </section>

      <section class="panel panel-body">
        <h2>{{ 'sos.card' | t }}</h2>
        <p class="muted small">{{ 'sos.cardHint' | t }}</p>
        <div class="row"><a class="btn btn-sm" routerLink="/emergency-card">{{ 'sos.card' | t }}</a>
          <a class="btn btn-sm" routerLink="/fake-call">{{ 'sos.fakeCall' | t }}</a></div>
      </section>

      <section class="panel panel-body">
        <h2>Alerts near home</h2>
        <p>Get a notification when a <strong>verified</strong> incident is reported near your home.</p>
        @if (auth.user()?.hasHome) {
          <div class="field">
            <label for="radius">Alert me within</label>
            <select id="radius" [value]="auth.user()?.alertRadiusM ?? 0" (change)="setRadius(+$any($event.target).value)">
              <option value="0">Off</option>
              <option value="1000">1 km of home</option>
              <option value="2000">2 km of home</option>
              <option value="5000">5 km of home</option>
            </select>
          </div>
          <div class="row">
            <button class="btn btn-sm" type="button" (click)="setHome()" [disabled]="homeBusy()">Update home to where I am now</button>
            <button class="btn btn-sm btn-danger" type="button" (click)="clearHome()">Remove home</button>
          </div>
        } @else {
          <button class="btn btn-vest" type="button" (click)="setHome()" [disabled]="homeBusy()">
            {{ homeBusy() ? 'Finding you…' : "I'm at home: use my location" }}
          </button>
        }
        <p class="muted small hint">Your home point is rounded to about 100 m and stored encrypted. No one else can see it.</p>
      </section>

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
        <p class="muted small legal"><a href="/privacy.html">Privacy policy</a> · <a href="/terms.html">Terms of use</a></p>
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
    .hint { margin: 12px 0 0; }
    .langs { display: flex; gap: 8px; flex-wrap: wrap; }
    .pic-row { display: flex; gap: 18px; align-items: center; }
    .pic-row h2 { margin-bottom: 4px; }
    .pic-row p { margin-bottom: 10px; }
    .big { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; flex: none; border: 3px solid var(--vest); }
    .initials { display: grid; place-items: center; background: var(--ink); color: #fff; font: 700 1.6rem var(--font-head); }
    label.btn { cursor: pointer; }
    label.disabled { opacity: .6; pointer-events: none; }
    .legal { margin: 16px 0 0; }
  `,
})
export class Profile implements OnInit {
  protected auth = inject(AuthService);
  protected push = inject(PushService);
  private toast = inject(ToastService);

  readonly saving = signal(false);
  readonly homeBusy = signal(false);
  readonly picBusy = signal(false);
  protected i18n = inject(I18n);
  readonly langs = LANGS;
  private api = inject(ApiService);
  readonly ini = initialsOf;
  avatar() { return avatarSrc(this.auth.user()?.avatarUrl); }
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

  async choose(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return this.toast.error('That picture is too large.');
    this.picBusy.set(true);
    try {
      const jpeg = await toSquareJpeg(file);
      this.api.uploadAvatar(jpeg).subscribe({
        next: r => { this.auth.user.update(u => (u ? { ...u, avatarUrl: r.avatarUrl } : u)); this.picBusy.set(false); this.toast.ok('Picture updated.'); },
        error: err => { this.picBusy.set(false); this.toast.error(errorMessage(err, "Couldn't upload the picture.")); },
      });
    } catch {
      this.picBusy.set(false);
      this.toast.error("That file couldn't be read as a picture. Try a JPEG or PNG.");
    }
  }

  removePic(): void {
    this.api.removeAvatar().subscribe({
      next: () => { this.auth.user.update(u => (u ? { ...u, avatarUrl: undefined } : u)); this.toast.ok('Picture removed.'); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  async setHome(): Promise<void> {
    this.homeBusy.set(true);
    const pos = await currentPosition(10_000);
    if (!pos) { this.homeBusy.set(false); return this.toast.error('Allow location access to set your home area.'); }
    const radius = this.auth.user()?.alertRadiusM || 2000;
    this.auth.updateProfile({ homeLatitude: pos[0], homeLongitude: pos[1], alertRadiusM: radius }).subscribe({
      next: u => { this.auth.user.set(u); this.homeBusy.set(false); this.toast.ok(`Home set. You'll get alerts within ${radius / 1000} km.`); },
      error: err => { this.homeBusy.set(false); this.toast.error(errorMessage(err)); },
    });
  }

  setRadius(alertRadiusM: number): void {
    this.auth.updateProfile({ alertRadiusM }).subscribe({
      next: u => { this.auth.user.set(u); this.toast.ok(alertRadiusM ? 'Alert distance saved.' : 'Alerts near home are off.'); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  clearHome(): void {
    this.auth.updateProfile({ clearHome: true }).subscribe({
      next: u => { this.auth.user.set(u); this.toast.ok('Home removed.'); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  async enablePush(): Promise<void> {
    const problem = await this.push.enable();
    if (problem) this.toast.error(problem);
    else this.toast.ok('Notifications are on.');
  }
}
