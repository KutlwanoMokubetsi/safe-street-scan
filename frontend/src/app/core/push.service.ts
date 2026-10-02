import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export type PushState = 'unsupported' | 'disabled-on-server' | 'blocked' | 'off' | 'on';

@Injectable({ providedIn: 'root' })
export class PushService {
  private sw = inject(SwPush);
  private api = inject(ApiService);

  readonly state = signal<PushState>('off');

  async check(): Promise<void> {
    if (!this.sw.isEnabled || !('Notification' in window)) return this.state.set('unsupported');
    if (Notification.permission === 'denied') return this.state.set('blocked');
    const sub = await firstValueFrom(this.sw.subscription);
    this.state.set(sub ? 'on' : 'off');
    // Re-register an existing subscription in case this device signed in with a new account.
    if (sub) this.api.pushSubscribe(sub.toJSON()).subscribe({ error: () => {} });
  }

  async enable(): Promise<string | null> {
    if (!this.sw.isEnabled) return 'Notifications need the installed app. On iPhone, tap Share then "Add to Home Screen" first.';
    try {
      const key = await firstValueFrom(this.api.pushKey());
      if (!key.enabled) { this.state.set('disabled-on-server'); return 'Notifications are not set up on the server yet.'; }
      const sub = await this.sw.requestSubscription({ serverPublicKey: key.publicKey });
      await firstValueFrom(this.api.pushSubscribe(sub.toJSON()));
      this.state.set('on');
      return null;
    } catch {
      if ('Notification' in window && Notification.permission === 'denied') {
        this.state.set('blocked');
        return 'Notifications are blocked. Allow them for this site in your browser settings.';
      }
      return "Couldn't turn on notifications. Try again.";
    }
  }

  async disable(): Promise<void> {
    const sub = await firstValueFrom(this.sw.subscription);
    if (sub) {
      await firstValueFrom(this.api.pushUnsubscribe(sub.endpoint)).catch(() => {});
      await this.sw.unsubscribe().catch(() => {});
    }
    this.state.set('off');
  }
}
