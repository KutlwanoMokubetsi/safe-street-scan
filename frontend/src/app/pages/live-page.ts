import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { timeAgo } from '../core/crime-types';
import { DEFAULT_CENTER, createMap, escapeHtml } from '../core/geo';
import { LiveService } from '../core/live.service';
import { EscortSession, FriendEntry, LiveFriend } from '../core/models';
import { TPipe, t } from '../core/i18n';
import { ToastService } from '../core/toast.service';
import { avatarSrc, initialsOf } from '../core/avatar';

@Component({
  selector: 'app-live-page',
  imports: [FormsModule, RouterLink, TPipe],
  template: `
    <div class="layout">
      <aside class="side">
        <h1>Live location</h1>

        <section class="mine">
          @if (myShare(); as s) {
            <h2>You're sharing</h2>
            <p>With {{ viewerNames() }}
              {{ s.expiresAt ? 'until ' + time(s.expiresAt) : 'until you stop' }}.</p>
            @if (s.checkinDueAt) {
              <p class="due">Check in by <strong>{{ time(s.checkinDueAt) }}</strong>. If you don't, your friends get an emergency alert automatically.</p>
              <button class="btn arrived" type="button" (click)="checkIn()" [disabled]="busy()">I've arrived safely</button>
            }
            @if (live.gpsError()) { <p class="err">{{ live.gpsError() }}</p> }
            @else if (live.lastSentAt(); as t) { <p class="muted small">Last sent {{ t.toLocaleTimeString('en-ZA') }}</p> }
            <button class="btn btn-danger" type="button" (click)="stop()" [disabled]="busy()">Stop sharing</button>
          } @else if (friends().length === 0) {
            <p class="muted">Add friends first, then you can share your location with them.</p>
            <a class="btn" routerLink="/friends">Add friends</a>
          } @else {
            <h2>Share your location</h2>
            <fieldset>
              <legend>For how long</legend>
              <label class="opt"><input type="radio" name="dur" [value]="60" [(ngModel)]="minutes"> 1 hour</label>
              <label class="opt"><input type="radio" name="dur" [value]="480" [(ngModel)]="minutes"> 8 hours</label>
              <label class="opt"><input type="radio" name="dur" [value]="null" [(ngModel)]="minutes"> Until I stop</label>
            </fieldset>
            <fieldset>
              <legend>Alert my friends if I don't check in</legend>
              <label class="opt"><input type="radio" name="chk" [value]="null" [(ngModel)]="checkIn_"> No check-in</label>
              <label class="opt"><input type="radio" name="chk" [value]="30" [(ngModel)]="checkIn_"> Within 30 minutes</label>
              <label class="opt"><input type="radio" name="chk" [value]="60" [(ngModel)]="checkIn_"> Within 1 hour</label>
              <label class="opt"><input type="radio" name="chk" [value]="120" [(ngModel)]="checkIn_"> Within 2 hours</label>
            </fieldset>
            <fieldset>
              <legend>With</legend>
              @for (f of friends(); track f.person.userId) {
                <label class="opt">
                  <input type="checkbox" [checked]="chosen().has(f.person.userId)" (change)="toggle(f.person.userId)">
                  {{ f.person.name }}
                </label>
              }
            </fieldset>
            <button class="btn btn-ink" type="button" (click)="start()" [disabled]="busy() || chosen().size === 0">
              {{ busy() ? 'Starting…' : 'Start sharing' }}
            </button>
          }
          <p class="note small">Your phone sends your location only while CrimeSpot is open on screen. Nothing is stored after you stop.</p>
        </section>

        <section class="walk">
          <h2>🚶 {{ 'walk.title' | t }}</h2>
          @if (live.escort()?.asWalker; as w) {
            @if (w.status === 'REQUESTED') {
              <p>{{ 'walk.waiting' | t: { name: w.escortName } }}</p>
              <button class="btn btn-sm" type="button" (click)="walkAct(w, 'end')">{{ 'common.cancel' | t }}</button>
            } @else {
              <p class="ok-text">{{ 'walk.with' | t: { name: w.escortName } }}</p>
              <button class="btn arrived" type="button" (click)="walkAct(w, 'end')">{{ 'live.arrived' | t }}</button>
            }
          } @else if (friends().length) {
            <p class="muted small">{{ 'walk.intro' | t }}</p>
            <div class="walk-friends">
              @for (f of friends(); track f.person.userId) {
                <button class="btn btn-sm" type="button" (click)="askWalk(f.person.userId)">{{ 'walk.ask' | t: { name: f.person.name } }}</button>
              }
            </div>
          }
          @for (s of live.escort()?.asEscort ?? []; track s.id) {
            <div class="escorting" [class.alarm]="s.stationary || s.lost">
              <strong>{{ 'walk.escorting' | t: { name: s.walkerName } }}</strong>
              @if (s.lost) { <p>{{ 'walk.lostEscort' | t: { name: s.walkerName } }}</p> }
              @else if (s.stationary) { <p>{{ 'walk.stillEscort' | t: { name: s.walkerName } }}</p> }
              <div class="walk-friends">
                <button class="btn btn-sm btn-danger" type="button" (click)="raise(s)">{{ 'walk.raise' | t: { name: s.walkerName } }}</button>
                <button class="btn btn-sm" type="button" (click)="walkAct(s, 'end')">{{ 'walk.end' | t }}</button>
              </div>
            </div>
          }
        </section>

        <h2 class="others">Sharing with you</h2>
        @if (visible().length === 0) {
          <p class="muted small">No one is sharing their location with you right now.</p>
        } @else {
          <ul>
            @for (f of visible(); track f.userId) {
              <li>
                <button type="button" (click)="focus(f)" [disabled]="f.latitude == null">
                  <span class="who">
                    @if (pic(f.avatarUrl); as src) { <img [src]="src" alt="" class="av"> } @else { <span class="av">{{ ini(f.name) }}</span> }
                    {{ f.name }} @if (f.reason === 'PANIC') { <strong class="sos">SOS</strong> }
                  </span>
                  <span class="muted small">{{ f.updatedAt ? 'Updated ' + ago(f.updatedAt) : 'Waiting for location' }}</span>
                </button>
              </li>
            }
          </ul>
        }
      </aside>

      <div class="map" #mapEl aria-label="Map of friends sharing their location"></div>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 340px 1fr; height: calc(100dvh - var(--chrome-top, 60px) - var(--chrome-bottom, 0px)); }
    .side { padding: 20px 16px; overflow-y: auto; background: var(--card); border-right: 1px solid var(--line); }
    .side h1 { margin-bottom: 16px; }
    .side h2 { font-size: 1.1rem; margin-bottom: 8px; }
    .mine { padding-bottom: 16px; border-bottom: 1px solid var(--line); margin-bottom: 16px; }
    .mine p { margin-bottom: 10px; }
    fieldset { border: 0; padding: 0; margin: 0 0 14px; }
    legend { font-weight: 600; font-size: 0.9rem; margin-bottom: 6px; }
    .opt { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
    .opt input { width: 20px; height: 20px; min-height: 0; }
    .note { color: var(--muted); margin-top: 12px; }
    .walk { padding-bottom: 16px; border-bottom: 1px solid var(--line); margin-bottom: 16px; }
    .walk p { margin-bottom: 8px; }
    .walk-friends { display: flex; gap: 8px; flex-wrap: wrap; }
    .ok-text { color: var(--safe); font-weight: 600; }
    .escorting { margin-top: 12px; padding: 12px; border-radius: var(--radius-m); background: #E8EEF8; }
    .escorting.alarm { background: #FFF1D6; }
    .escorting p { margin: 4px 0 8px; }
    .err { color: var(--risk); }
    .due { background: #FFF6D6; border: 1px solid #F0D98A; padding: 10px 12px; border-radius: var(--radius-m); }
    .arrived { width: 100%; background: var(--safe); color: #fff; border-color: #24654A; margin-bottom: 10px; }
    ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
    li button {
      width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
      padding: 10px 2px; background: none; border: 0; border-bottom: 1px solid var(--line);
      font: inherit; color: inherit; text-align: left; cursor: pointer;
    }
    .who { font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .av { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; display: grid; place-items: center; background: var(--surface); border: 1px solid var(--line); font-size: .7rem; }
    .sos { color: var(--risk); margin-left: 6px; font-size: 0.8rem; }
    .map { height: 100%; }
    @media (max-width: 860px) {
      .layout { grid-template-columns: 1fr; height: auto; }
      .map { order: -1; height: 50vh; }
      .side { border-right: 0; padding-bottom: 88px; }
    }
  `,
})
export class LivePage implements OnInit, AfterViewInit, OnDestroy {
  protected live = inject(LiveService);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');
  private map?: L.Map;
  private layer = L.layerGroup();
  private fitted = false;

  readonly friends = signal<FriendEntry[]>([]);
  readonly chosen = signal<Set<string>>(new Set());
  readonly busy = signal(false);
  readonly pic = avatarSrc;
  readonly ini = initialsOf;
  minutes: number | null = 60;
  checkIn_: number | null = null;

  readonly myShare = computed(() => this.live.state()?.myShare ?? null);
  readonly visible = computed(() => this.live.state()?.friends ?? []);
  readonly viewerNames = computed(() => {
    const ids = new Set(this.myShare()?.viewerIds ?? []);
    const names = this.friends().filter(f => ids.has(f.person.userId)).map(f => f.person.name);
    return names.length ? names.join(', ') : `${ids.size} friends`;
  });
  readonly ago = timeAgo;

  constructor() {
    effect(() => this.draw(this.visible()));
  }

  ngOnInit(): void {
    this.live.refresh();
    this.api.friends().subscribe({
      next: f => { this.friends.set(f.friends); this.chosen.set(new Set(f.friends.map(x => x.person.userId))); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  ngAfterViewInit(): void {
    this.map = createMap(this.mapEl().nativeElement, DEFAULT_CENTER, 12);
    this.layer.addTo(this.map);
    this.draw(this.visible());
  }

  ngOnDestroy(): void { this.map?.remove(); }

  time(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }

  toggle(id: string): void {
    this.chosen.update(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  start(): void {
    this.busy.set(true);
    if (this.checkIn_ && this.minutes && this.checkIn_ > this.minutes) {
      this.toast.error('Choose a check-in time before sharing ends.');
      return;
    }
    this.api.startSharing(this.minutes, [...this.chosen()], this.checkIn_).subscribe({
      next: () => {
        this.busy.set(false);
        this.live.refresh();
        navigator.geolocation?.getCurrentPosition(p => this.live.sendNow(p), () => {}, { enableHighAccuracy: true, timeout: 10_000 });
        this.toast.ok('Sharing your location.');
      },
      error: err => { this.busy.set(false); this.toast.error(errorMessage(err)); },
    });
  }

  checkIn(): void {
    this.busy.set(true);
    this.api.checkIn().subscribe({
      next: () => { this.busy.set(false); this.live.refresh(); this.toast.ok("Checked in. Your friends know you're safe."); },
      error: err => { this.busy.set(false); this.toast.error(errorMessage(err)); },
    });
  }

  askWalk(friendId: string): void {
    this.api.requestEscort(friendId).subscribe({
      next: () => {
        this.live.refresh();
        // Location must flow to the escort as soon as they accept.
        navigator.geolocation?.getCurrentPosition(p => this.live.sendNow(p), () => {}, { enableHighAccuracy: true, timeout: 10_000 });
      },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  walkAct(s: EscortSession, action: 'end'): void {
    this.api.escortAction(s.id, action).subscribe({ next: () => this.live.refresh(), error: err => this.toast.error(errorMessage(err)) });
  }

  raise(s: EscortSession): void {
    if (!confirm(t('walk.raiseConfirm', { name: s.walkerName }))) return;
    this.api.escortAlert(s.id).subscribe({ next: () => this.live.refresh(), error: err => this.toast.error(errorMessage(err)) });
  }

  stop(): void {
    this.busy.set(true);
    this.api.stopSharing().subscribe({
      next: () => { this.busy.set(false); this.live.refresh(); this.toast.ok('Stopped sharing your location.'); },
      error: err => { this.busy.set(false); this.toast.error(errorMessage(err)); },
    });
  }

  focus(f: LiveFriend): void {
    if (f.latitude != null && f.longitude != null) this.map?.setView([f.latitude, f.longitude], 16);
  }

  private draw(list: LiveFriend[]): void {
    if (!this.map) return;
    this.layer.clearLayers();
    const points: L.LatLngExpression[] = [];
    for (const f of list) {
      if (f.latitude == null || f.longitude == null) continue;
      const pos: [number, number] = [f.latitude, f.longitude];
      points.push(pos);
      const color = f.reason === 'PANIC' ? '#C0392B' : '#17202B';
      L.circleMarker(pos, { radius: 9, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 })
        .bindTooltip(escapeHtml(f.name), { permanent: true, direction: 'top', offset: [0, -10] })
        .bindPopup(`<strong>${escapeHtml(f.name)}</strong><br>Updated ${f.updatedAt ? timeAgo(f.updatedAt) : '–'}` +
          (f.phone ? `<br><a href="tel:${escapeHtml(f.phone)}">Call</a>` : ''))
        .addTo(this.layer);
    }
    if (!this.fitted && points.length) {
      this.map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
      this.fitted = true;
    }
  }
}
