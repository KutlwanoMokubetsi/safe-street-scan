import { Injectable, NgZone, computed, effect, inject, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { RealtimeService } from './realtime.service';
import { Live } from './models';

const POLL_MS = 15_000;
const SEND_EVERY_MS = 15_000;
const SEND_IF_MOVED_M = 25;

function metersBetween(a: GeolocationCoordinates, lat: number, lng: number): number {
  const r = 6_371_000, toRad = Math.PI / 180;
  const dLat = (lat - a.latitude) * toRad, dLng = (lng - a.longitude) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * toRad) * Math.cos(lat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/**
 * Polls /api/live for sharing state and friends' alerts, and while you are sharing
 * (or have an active panic alert) sends your position from this device.
 * Browsers only allow this while the app is open.
 */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private zone = inject(NgZone);
  private realtime = inject(RealtimeService);
  private lastRefresh = 0;

  readonly state = signal<Live | null>(null);
  readonly lastSentAt = signal<Date | null>(null);
  readonly gpsError = signal('');

  readonly sharing = computed(() => !!this.state()?.sharing);
  readonly friendAlerts = computed(() => this.state()?.alerts ?? []);
  readonly myAlert = computed(() => this.state()?.myAlert ?? null);

  private poll?: Subscription;
  private watchId?: number;
  private lastSent?: { lat: number; lng: number; at: number };

  constructor() {
    effect(() => {
      if (this.sharing()) this.startWatching();
      else this.stopWatching();
    });
  }

  start(): void {
    if (this.poll || !this.auth.isLoggedIn()) return;
    // With a live socket, events drive refreshes and polling drops to once a minute as a safety net.
    this.poll = timer(0, POLL_MS).subscribe(() => {
      if (document.visibilityState !== 'visible') return;
      if (this.realtime.connected() && Date.now() - this.lastRefresh < 60_000) return;
      this.refresh();
    });
    this.realtime.on('live', 'friends').subscribe(() => this.refresh());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.refresh();
    });
  }

  refresh(): void {
    this.lastRefresh = Date.now();
    this.api.live().subscribe({ next: s => this.state.set(s), error: () => { /* keep last state */ } });
  }

  /** Sends one position immediately (used right after sharing starts). */
  sendNow(pos: GeolocationPosition): void {
    this.send(pos, true);
  }

  private startWatching(): void {
    if (this.watchId !== undefined || !('geolocation' in navigator)) return;
    this.watchId = navigator.geolocation.watchPosition(
      pos => this.zone.run(() => { this.gpsError.set(''); this.send(pos, false); }),
      err => this.zone.run(() => this.gpsError.set(
        err.code === err.PERMISSION_DENIED
          ? 'Location access is blocked. Allow it in your browser settings so friends can see you.'
          : "Can't get your location right now.")),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
  }

  private stopWatching(): void {
    if (this.watchId !== undefined) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = undefined;
    this.lastSent = undefined;
  }

  private send(pos: GeolocationPosition, force: boolean): void {
    const { latitude, longitude, accuracy } = pos.coords;
    const now = Date.now();
    if (!force && this.lastSent) {
      const recent = now - this.lastSent.at < SEND_EVERY_MS;
      const moved = metersBetween(pos.coords, this.lastSent.lat, this.lastSent.lng) >= SEND_IF_MOVED_M;
      if (recent && !moved) return;
    }
    this.lastSent = { lat: latitude, lng: longitude, at: now };
    this.api.sendLocation(latitude, longitude, Math.round(accuracy)).subscribe({
      next: () => this.lastSentAt.set(new Date()),
      error: err => { if (err.status === 409) this.refresh(); }, // Sharing ended elsewhere.
    });
  }
}
