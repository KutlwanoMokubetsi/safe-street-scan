import { Component, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TPipe, speechLang, t } from '../core/i18n';

type Phase = 'setup' | 'waiting' | 'ringing' | 'talking';

/**
 * A believable incoming call to help someone leave an uncomfortable situation.
 * Ringtone is synthesised with Web Audio (started inside the tap, so phones allow it); Android vibrates;
 * answering speaks a short line in the chosen language. Works only while the app is open.
 */
@Component({
  selector: 'app-fake-call',
  imports: [FormsModule, TPipe],
  template: `
    @if (phase() === 'setup' || phase() === 'waiting') {
      <div class="page narrow">
        <h1>{{ 'sos.fakeCall' | t }}</h1>
        <p class="muted intro">{{ 'fake.intro' | t }}</p>
        <div class="panel panel-body">
          <div class="field">
            <label for="caller">{{ 'fake.caller' | t }}</label>
            <input id="caller" [(ngModel)]="caller" maxlength="30" [disabled]="phase() === 'waiting'">
          </div>
          <fieldset [disabled]="phase() === 'waiting'">
            <legend>{{ 'fake.when' | t }}</legend>
            <div class="delays">
              @for (d of delays; track d) {
                <button type="button" class="chip" [class.on]="delay === d" (click)="delay = d">{{ d === 0 ? ('fake.now' | t) : d < 60 ? d + ' s' : d / 60 + ' min' }}</button>
              }
            </div>
          </fieldset>
          @if (phase() === 'setup') {
            <button class="btn btn-ink full" type="button" (click)="schedule()">{{ 'fake.start' | t }}</button>
          } @else {
            <p class="waiting">{{ 'fake.ringingIn' | t: { n: countdown() } }}</p>
            <button class="btn full" type="button" (click)="reset()">{{ 'common.cancel' | t }}</button>
          }
          <p class="muted small note">{{ 'fake.note' | t }}</p>
        </div>
      </div>
    } @else {
      <div class="call" role="dialog" [attr.aria-label]="'fake.incoming' | t">
        <div class="who">
          <span class="label">{{ phase() === 'ringing' ? ('fake.incoming' | t) : clock() }}</span>
          <div class="photo" aria-hidden="true">{{ caller.slice(0, 1).toUpperCase() }}</div>
          <h1>{{ caller }}</h1>
          <span class="label">{{ 'fake.mobile' | t }}</span>
        </div>
        @if (phase() === 'ringing') {
          <div class="buttons">
            <button type="button" class="round decline" (click)="reset()" [attr.aria-label]="'fake.decline' | t">
              <svg viewBox="0 0 24 24" width="34" height="34"><path fill="#fff" d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1 0-1.36C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.72c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
              <span>{{ 'fake.decline' | t }}</span>
            </button>
            <button type="button" class="round accept" (click)="answer()" [attr.aria-label]="'fake.accept' | t">
              <svg viewBox="0 0 24 24" width="34" height="34"><path fill="#fff" d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              <span>{{ 'fake.accept' | t }}</span>
            </button>
          </div>
        } @else {
          <div class="buttons single">
            <button type="button" class="round decline" (click)="reset()" [attr.aria-label]="'fake.end' | t">
              <svg viewBox="0 0 24 24" width="34" height="34"><path fill="#fff" d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1 0-1.36C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.72c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
              <span>{{ 'fake.end' | t }}</span>
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .narrow { max-width: 520px; }
    .intro { margin: 6px 0 18px; }
    fieldset { border: 0; padding: 0; margin: 0 0 16px; }
    legend { font-weight: 600; font-size: .9rem; margin-bottom: 8px; }
    .delays { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { height: 40px; padding: 0 16px; border-radius: 20px; border: 1px solid var(--line); background: #fff; font: 600 .9rem var(--font-body); cursor: pointer; }
    .chip.on { background: var(--ink); color: #fff; border-color: var(--ink); }
    .full { width: 100%; }
    .waiting { font: 700 1.3rem var(--font-head); text-align: center; margin: 4px 0 12px; }
    .note { margin-top: 12px; }
    /* Full-screen call UI, styled like a generic phone dialler (no brand marks). */
    .call {
      position: fixed; inset: 0; z-index: 3000; display: flex; flex-direction: column; justify-content: space-between;
      padding: calc(48px + env(safe-area-inset-top, 0px)) 24px calc(56px + env(safe-area-inset-bottom, 0px));
      background: linear-gradient(180deg, #2B3A4A 0%, #121A23 100%); color: #fff; text-align: center;
    }
    .who { display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .label { color: #C9D1D9; font-size: 1rem; }
    .photo { width: 112px; height: 112px; border-radius: 50%; background: #5E6873; display: grid; place-items: center; font: 600 3rem var(--font-body); margin: 18px 0 4px; }
    .call h1 { font: 500 2.2rem var(--font-body); }
    .buttons { display: flex; justify-content: space-around; }
    .buttons.single { justify-content: center; }
    .round { display: flex; flex-direction: column; align-items: center; gap: 10px; background: none; border: 0; color: #fff; font: 500 .95rem var(--font-body); cursor: pointer; }
    .round svg { width: 72px; height: 72px; padding: 19px; border-radius: 50%; box-sizing: border-box; }
    .decline svg { background: #E5484D; }
    .accept svg { background: #30A46C; animation: bob 1.2s ease-in-out infinite; }
    @keyframes bob { 50% { transform: translateY(-6px); } }
  `,
})
export class FakeCall implements OnDestroy {
  readonly phase = signal<Phase>('setup');
  readonly countdown = signal(0);
  readonly clock = signal('00:00');
  readonly delays = [0, 10, 30, 60];
  delay = 10;
  caller = t('fake.defaultCaller');

  private audio?: AudioContext;
  private ringTimer?: ReturnType<typeof setInterval>;
  private tick?: ReturnType<typeof setInterval>;
  private wake?: { release(): Promise<void> };

  schedule(): void {
    // Create the audio context inside the tap: browsers only allow sound that starts from a user gesture.
    this.audio ??= new AudioContext();
    this.audio.resume();
    this.keepAwake();
    this.countdown.set(this.delay);
    if (this.delay === 0) return this.ring();
    this.phase.set('waiting');
    this.tick = setInterval(() => {
      this.countdown.update(n => n - 1);
      if (this.countdown() <= 0) { clearInterval(this.tick); this.ring(); }
    }, 1000);
  }

  private ring(): void {
    this.phase.set('ringing');
    const burst = () => {
      this.tone();
      navigator.vibrate?.([800, 400, 800]);
    };
    burst();
    this.ringTimer = setInterval(burst, 3000);
  }

  /** A two-tone ring, about 1.6 s, built from oscillators. */
  private tone(): void {
    const ctx = this.audio;
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const start of [0, 0.4, 0.8, 1.2]) {
      for (const freq of [440, 480]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, now + start);
        g.gain.linearRampToValueAtTime(0.15, now + start + 0.02);
        g.gain.setValueAtTime(0.15, now + start + 0.35);
        g.gain.linearRampToValueAtTime(0, now + start + 0.38);
        o.connect(g).connect(ctx.destination);
        o.start(now + start);
        o.stop(now + start + 0.4);
      }
    }
  }

  answer(): void {
    this.stopRinging();
    this.phase.set('talking');
    const started = Date.now();
    this.tick = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      this.clock.set(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
    }, 1000);
    // A short line through the earpiece/speaker, so it sounds like a real conversation nearby.
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(t('fake.script'));
      u.lang = speechLang();
      u.rate = 0.95;
      setTimeout(() => speechSynthesis.speak(u), 1200);
    }
  }

  reset(): void {
    this.stopRinging();
    clearInterval(this.tick);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.wake?.release().catch(() => {});
    this.wake = undefined;
    this.phase.set('setup');
    this.clock.set('00:00');
  }

  ngOnDestroy(): void { this.reset(); this.audio?.close(); }

  private stopRinging(): void {
    clearInterval(this.ringTimer);
    navigator.vibrate?.(0);
  }

  /** Keep the screen on while waiting, so the call can appear. */
  private async keepAwake(): Promise<void> {
    try { this.wake = await (navigator as any).wakeLock?.request('screen'); } catch { /* not supported */ }
  }
}
