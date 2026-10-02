import { Injectable, inject, signal } from '@angular/core';
import { Subject, filter } from 'rxjs';
import { environment } from '../../environments/environment';
import { keycloak } from './keycloak';
import { ToastService } from './toast.service';

export type RealtimeEvent = 'live' | 'reports' | 'hotspots' | 'friends';

/**
 * One WebSocket per tab. The server sends "something changed" events; pages re-fetch through the API.
 * Re-authenticates before the access token expires, pings to keep the connection open, and reconnects
 * with backoff. Pages keep a slow polling fallback for when the socket is down.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private toast = inject(ToastService);

  readonly connected = signal(false);
  private readonly events$ = new Subject<RealtimeEvent>();

  private ws?: WebSocket;
  private started = false;
  private retry = 0;
  private timers: ReturnType<typeof setInterval>[] = [];

  on(...types: RealtimeEvent[]) {
    return this.events$.pipe(filter(t => types.includes(t)));
  }

  start(): void {
    if (this.started || !keycloak.authenticated) return;
    this.started = true;
    this.connect();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.connected()) this.connect();
    });
    window.addEventListener('online', () => this.connect());
  }

  private url(): string {
    if (environment.apiUrl) return environment.apiUrl.replace(/^http/, 'ws') + '/ws';
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  }

  private connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    let ws: WebSocket;
    try { ws = new WebSocket(this.url()); } catch { return this.scheduleReconnect(); }
    this.ws = ws;

    ws.onopen = () => this.authenticate();
    ws.onmessage = e => {
      let msg: { type?: string; text?: string };
      try { msg = JSON.parse(e.data); } catch { return; }
      switch (msg.type) {
        case 'ready':
          this.retry = 0;
          this.connected.set(true);
          // Catch up on anything missed while disconnected.
          (['live', 'reports', 'hotspots', 'friends'] as RealtimeEvent[]).forEach(t => this.events$.next(t));
          break;
        case 'live': case 'friends':
          this.events$.next(msg.type);
          break;
        case 'reports': case 'hotspots': {
          // Sent to everyone at once: add 0–1.5 s of jitter so re-fetches are spread out.
          const t = msg.type;
          setTimeout(() => this.events$.next(t), Math.random() * 1500);
          break;
        }
        case 'notice':
          if (msg.text) this.toast.ok(msg.text);
          break;
      }
    };
    ws.onclose = () => {
      this.connected.set(false);
      this.timers.forEach(clearInterval);
      this.timers = [];
      if (ws === this.ws) this.scheduleReconnect();
    };

    // Keep-alive, and re-send a fresh token well before the 5-minute access token expires.
    this.timers.push(setInterval(() => this.send({ type: 'ping' }), 25_000));
    this.timers.push(setInterval(() => this.authenticate(), 4 * 60_000));
  }

  private async authenticate(): Promise<void> {
    try { await keycloak.updateToken(60); } catch { return; }
    if (keycloak.token) this.send({ type: 'auth', token: keycloak.token });
  }

  private send(m: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  private scheduleReconnect(): void {
    if (!navigator.onLine) return; // the 'online' event reconnects
    const delay = Math.min(30_000, 1000 * 2 ** this.retry++) + Math.random() * 500;
    setTimeout(() => this.connect(), delay);
  }
}
