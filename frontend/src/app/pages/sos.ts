import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { currentPosition } from '../core/geo';
import { LiveService } from '../core/live.service';
import { ToastService } from '../core/toast.service';

const HOLD_MS = 3000;

@Component({
  selector: 'app-sos',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page narrow">
      @if (live.myAlert(); as alert) {
        <section class="active" role="alert">
          <h1>Alert sent</h1>
          <p>Your friends have been notified and can see where you are. Keep CrimeSpot open so your location keeps updating.</p>
          @if (live.gpsError()) { <p class="gps">{{ live.gpsError() }}</p> }
          @if (live.lastSentAt(); as t) { <p class="small">Location last sent at {{ t.toLocaleTimeString('en-ZA') }}</p> }
        </section>

        <div class="calls">
          <a class="call primary" href="tel:10111"><strong>10111</strong><span>Police (SAPS)</span></a>
          <a class="call" href="tel:112"><strong>112</strong><span>Emergency from a cellphone</span></a>
          <a class="call" href="tel:10177"><strong>10177</strong><span>Ambulance</span></a>
        </div>

        <button class="btn safe" type="button" (click)="resolve(alert.id)" [disabled]="busy()">
          I'm safe. End the alert.
        </button>
      } @else {
        <div class="page-head">
          <div>
            <h1>Emergency SOS</h1>
            <p class="muted">Hold the button for 3 seconds. Your friends get an urgent alert with your live location.</p>
          </div>
        </div>

        @if (friendCount() === 0) {
          <p class="nofriends">
            You haven't added any friends yet, so an alert would reach no one.
            <a routerLink="/friends">Add friends</a>, and call 10111 if you're in danger now.
          </p>
        }

        <div class="hold-wrap">
          <button type="button" class="hold" [class.holding]="holding()"
                  [style.--p]="progress()"
                  (pointerdown)="startHold($event)" (pointerup)="cancelHold()" (pointerleave)="cancelHold()" (pointercancel)="cancelHold()"
                  (keydown.space)="keyHold($event)" (keydown.enter)="keyHold($event)"
                  (keyup.space)="cancelHold()" (keyup.enter)="cancelHold()"
                  (contextmenu)="$event.preventDefault()"
                  [disabled]="busy()" aria-describedby="hold-help">
            <span class="ring" aria-hidden="true"></span>
            <span class="label">{{ busy() ? 'Sending…' : holding() ? 'Keep holding' : 'Hold for SOS' }}</span>
          </button>
          <p id="hold-help" class="muted small">Let go to cancel.</p>
        </div>

        <details class="msg">
          <summary>Add a short message (optional)</summary>
          <input [(ngModel)]="message" maxlength="280" placeholder="e.g. Car broke down on N1 near Midrand">
        </details>

        <div class="calls">
          <a class="call primary" href="tel:10111"><strong>10111</strong><span>Police (SAPS)</span></a>
          <a class="call" href="tel:112"><strong>112</strong><span>Emergency from a cellphone</span></a>
          <a class="call" href="tel:10177"><strong>10177</strong><span>Ambulance</span></a>
        </div>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 560px; }
    .active { background: var(--risk); color: #fff; border-radius: var(--radius-m); padding: 20px; margin-bottom: 20px; }
    .active h1 { margin-bottom: 8px; }
    .active p { margin-bottom: 6px; }
    .gps { background: rgba(0,0,0,.2); padding: 8px 10px; border-radius: var(--radius-s); }
    .nofriends { background: #FFF6D6; border: 1px solid #F0D98A; padding: 12px 14px; border-radius: var(--radius-m); margin-bottom: 20px; }
    .hold-wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 16px 0 24px; }
    .hold {
      --p: 0;
      position: relative; width: min(64vw, 240px); aspect-ratio: 1; border-radius: 50%;
      border: 0; cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none;
      background: var(--risk); color: #fff;
      box-shadow: 0 0 0 10px rgba(192, 57, 43, 0.15);
      font: 700 1.4rem/1.15 var(--font-head);
    }
    .hold:disabled { opacity: 0.7; }
    .hold.holding { background: #A93226; }
    .ring {
      position: absolute; inset: -10px; border-radius: 50%;
      background: conic-gradient(var(--ink) calc(var(--p) * 1turn), transparent 0);
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 10px));
              mask: radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 10px));
    }
    .label { position: relative; padding: 0 24px; display: block; }
    .msg { margin-bottom: 24px; }
    .msg summary { cursor: pointer; font-weight: 600; margin-bottom: 8px; }
    .calls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px; }
    .call {
      display: flex; flex-direction: column; padding: 12px; text-decoration: none;
      background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m);
    }
    .call strong { font: 700 1.5rem var(--font-head); }
    .call span { font-size: 0.8rem; color: var(--muted); }
    .call.primary { border-color: var(--ink); border-width: 2px; }
    .safe { width: 100%; min-height: 52px; background: var(--safe); color: #fff; border-color: #24654A; font-size: 1.05rem; }
    @media (max-width: 480px) { .calls { grid-template-columns: 1fr; } }
  `,
})
export class Sos implements OnInit, OnDestroy {
  protected live = inject(LiveService);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  readonly holding = signal(false);
  readonly progress = signal(0);
  readonly busy = signal(false);
  readonly friendCount = signal<number | null>(null);
  message = '';

  private started = 0;
  private frame?: number;
  /** Fetched while holding so the alert can include a position without extra delay. */
  private position?: Promise<[number, number] | null>;
  private accuracy?: number;

  ngOnInit(): void {
    this.live.refresh();
    this.api.friends().subscribe({ next: f => this.friendCount.set(f.friends.length), error: () => {} });
  }

  ngOnDestroy(): void { this.cancelHold(); }

  startHold(e: PointerEvent): void {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.begin();
  }

  keyHold(e: Event): void {
    e.preventDefault();
    if (!this.holding()) this.begin(); // Ignore key auto-repeat.
  }

  cancelHold(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.holding.set(false);
    this.progress.set(0);
  }

  private begin(): void {
    if (this.busy()) return;
    this.holding.set(true);
    this.started = performance.now();
    this.position ??= this.locate();
    const tick = () => {
      const p = Math.min(1, (performance.now() - this.started) / HOLD_MS);
      this.progress.set(p);
      if (p >= 1) { this.cancelHold(); this.fire(); return; }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private locate(): Promise<[number, number] | null> {
    return new Promise(resolve => {
      if (!('geolocation' in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        p => { this.accuracy = Math.round(p.coords.accuracy); resolve([p.coords.latitude, p.coords.longitude]); },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30_000 },
      );
    });
  }

  private async fire(): Promise<void> {
    this.busy.set(true);
    navigator.vibrate?.(200);
    // Don't hold the alert back for GPS: wait at most 4 s, then send without a position.
    const pos = await Promise.race([this.position ?? currentPosition(4000), new Promise<null>(r => setTimeout(() => r(null), 4000))]);
    this.position = undefined;
    this.api.panic({
      latitude: pos?.[0], longitude: pos?.[1], accuracyM: pos ? this.accuracy : undefined,
      message: this.message.trim() || undefined,
    }).subscribe({
      next: () => { this.busy.set(false); this.live.refresh(); navigator.vibrate?.([100, 60, 100]); },
      error: err => {
        this.busy.set(false);
        this.toast.error(errorMessage(err, "The alert didn't send.") + ' Call 10111 now.');
      },
    });
  }

  resolve(id: string): void {
    if (!confirm('End the alert and let your friends know you are safe?')) return;
    this.busy.set(true);
    this.api.resolvePanic(id).subscribe({
      next: () => { this.busy.set(false); this.live.refresh(); this.toast.ok('Alert ended. Your friends know you are safe.'); },
      error: err => { this.busy.set(false); this.toast.error(errorMessage(err)); },
    });
  }
}
