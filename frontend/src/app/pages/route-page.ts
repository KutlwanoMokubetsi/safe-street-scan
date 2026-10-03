import { AfterViewInit, Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { Subject, debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { riskLevel } from '../core/crime-types';
import { DEFAULT_CENTER, createMap, currentPosition } from '../core/geo';
import { TPipe, t } from '../core/i18n';
import { LiveService } from '../core/live.service';
import { PlaceResult, RouteOption, RoutePlan } from '../core/models';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-route-page',
  imports: [FormsModule, TPipe],
  template: `
    <div class="layout">
      <aside class="side">
        <h1>{{ 'nav.route' | t }}</h1>
        <p class="muted small">{{ 'route.intro' | t }}</p>

        <div class="field">
          <label>{{ 'route.from' | t }}</label>
          <div class="fixed">{{ from() ? ('route.myLocation' | t) : '…' }}</div>
        </div>
        <div class="field to">
          <label for="to">{{ 'route.to' | t }}</label>
          <input id="to" [(ngModel)]="query" (ngModelChange)="search$.next($event)" autocomplete="off"
                 [placeholder]="'route.search' | t">
          @if (results().length) {
            <ul class="results" role="listbox">
              @for (r of results(); track r.lat + ',' + r.lng) {
                <li role="option"><button type="button" (click)="pick(r)"><strong>{{ r.name }}</strong><span class="muted small">{{ r.detail }}</span></button></li>
              }
            </ul>
          }
        </div>

        <div class="modes" role="radiogroup">
          <button type="button" class="chip" [class.on]="walk()" (click)="walk.set(true)" role="radio" [attr.aria-checked]="walk()">{{ 'route.walk' | t }}</button>
          <button type="button" class="chip" [class.on]="!walk()" (click)="walk.set(false)" role="radio" [attr.aria-checked]="!walk()">{{ 'route.drive' | t }}</button>
        </div>
        <div class="field">
          <label for="leave">{{ 'route.leave' | t }}</label>
          <select id="leave" [(ngModel)]="leave">
            <option value="now">{{ 'fake.now' | t }}</option>
            <option value="1h">{{ 'route.leave1h' | t }}</option>
            <option value="18">{{ 'route.tonight' | t: { t: '18:00' } }}</option>
            <option value="21">{{ 'route.tonight' | t: { t: '21:00' } }}</option>
          </select>
        </div>
        <button class="btn btn-ink full" type="button" (click)="find()" [disabled]="busy() || !from() || !to()">
          {{ busy() ? ('route.finding' | t) : ('route.find' | t) }}
        </button>

        @if (plan(); as p) {
          <div class="options">
            @for (o of p.routes; track o.kind) {
              <button type="button" class="opt" [class.sel]="selected() === o" [class.safe]="o.kind !== 'FASTEST'" (click)="select(o)">
                <span class="kind">{{ 'route.' + o.kind | t }}</span>
                <span class="nums">{{ km(o.distanceM) }} · {{ mins(o.durationS) }}</span>
                @if (o.hotspotsPassed.length) {
                  <span class="warn small">{{ 'route.passes' | t: { list: o.hotspotsPassed.join(', ') } }}</span>
                } @else {
                  <span class="ok small">{{ 'route.clear' | t }}</span>
                }
              </button>
            }
          </div>
          <button class="btn btn-vest full" type="button" (click)="shareTrip()">{{ 'route.share' | t }}</button>
          <p class="muted small">{{ 'route.shareNote' | t }}</p>
          <p class="muted tiny">Routes © OpenStreetMap contributors · {{ p.provider === 'openrouteservice' ? 'openrouteservice.org' : 'FOSSGIS OSRM' }}</p>
        }
      </aside>
      <div class="map" #mapEl aria-label="Route map"></div>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 360px 1fr; height: calc(100dvh - var(--chrome-top, 60px) - var(--chrome-bottom, 0px)); }
    .side { padding: 20px 16px; overflow-y: auto; background: var(--card); border-right: 1px solid var(--line); }
    .side h1 { margin-bottom: 4px; }
    .side > p { margin-bottom: 16px; }
    .fixed { padding: 10px 12px; background: var(--surface); border-radius: var(--radius-s); font-weight: 600; }
    .to { position: relative; }
    .results { list-style: none; margin: 4px 0 0; padding: 0; position: absolute; left: 0; right: 0; top: 100%; z-index: 10;
      background: #fff; border: 1px solid var(--line); border-radius: var(--radius-m); box-shadow: 0 6px 20px rgba(23,32,43,.15); }
    .results button { width: 100%; text-align: left; display: flex; flex-direction: column; padding: 10px 12px; background: none; border: 0; border-bottom: 1px solid var(--line); cursor: pointer; font: inherit; }
    .results li:last-child button { border-bottom: 0; }
    .results button:hover { background: var(--surface); }
    .modes { display: flex; gap: 8px; margin-bottom: 12px; }
    .chip { height: 38px; padding: 0 16px; border-radius: 19px; border: 1px solid var(--line); background: #fff; font: 600 .9rem var(--font-body); cursor: pointer; }
    .chip.on { background: var(--ink); color: #fff; border-color: var(--ink); }
    .full { width: 100%; margin-bottom: 10px; }
    .options { display: grid; gap: 10px; margin: 16px 0 12px; }
    .opt { text-align: left; display: grid; gap: 4px; padding: 12px 14px; border-radius: var(--radius-m); border: 2px solid var(--line); background: #fff; cursor: pointer; font: inherit; }
    .opt.sel { border-color: var(--ink); }
    .opt.safe .kind { color: var(--safe); }
    .kind { font: 700 1.05rem var(--font-head); }
    .nums { font-weight: 600; }
    .warn { color: var(--risk); }
    .ok { color: var(--safe); }
    .tiny { font-size: .72rem; margin-top: 8px; }
    .map { height: 100%; }
    @media (max-width: 860px) {
      .layout { grid-template-columns: 1fr; height: auto; }
      .map { order: -1; height: 45vh; }
      .side { border-right: 0; padding-bottom: 88px; }
    }
  `,
})
export class RoutePage implements AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private live = inject(LiveService);
  private router = inject(Router);

  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');
  private map?: L.Map;
  private layer = L.layerGroup();
  private pins = L.layerGroup();

  readonly from = signal<[number, number] | null>(null);
  readonly to = signal<[number, number] | null>(null);
  readonly walk = signal(true);
  readonly busy = signal(false);
  readonly plan = signal<RoutePlan | null>(null);
  readonly selected = signal<RouteOption | null>(null);
  readonly results = signal<PlaceResult[]>([]);
  readonly search$ = new Subject<string>();
  query = '';
  leave = 'now';

  constructor() {
    this.search$.pipe(debounceTime(450), distinctUntilChanged(), filter(q => q.trim().length >= 3),
      switchMap(q => this.api.places(q.trim()))).subscribe({ next: r => this.results.set(r), error: () => {} });
  }

  async ngAfterViewInit(): Promise<void> {
    this.map = createMap(this.mapEl().nativeElement, DEFAULT_CENTER, 14);
    this.layer.addTo(this.map);
    this.pins.addTo(this.map);
    this.map.on('click', (e: L.LeafletMouseEvent) => { this.query = ''; this.results.set([]); this.setTo([e.latlng.lat, e.latlng.lng]); });
    this.drawHotspots();
    const pos = await currentPosition(8000);
    if (pos) { this.from.set(pos); this.map.setView(pos, 15); this.drawPins(); }
    else this.toast.error('Allow location access so routes can start from where you are.');
  }

  ngOnDestroy(): void { this.map?.remove(); }

  pick(r: PlaceResult): void {
    this.query = r.name;
    this.results.set([]);
    this.setTo([r.lat, r.lng]);
  }

  private setTo(p: [number, number]): void {
    this.to.set(p);
    this.plan.set(null);
    this.layer.clearLayers();
    this.drawHotspots();
    this.drawPins();
  }

  find(): void {
    const f = this.from(), d = this.to();
    if (!f || !d) return;
    this.busy.set(true);
    this.api.routes(f, d, this.walk(), this.departure()).subscribe({
      next: p => { this.busy.set(false); this.plan.set(p); this.select(p.routes[0]); },
      error: err => { this.busy.set(false); this.toast.error(errorMessage(err, "Couldn't find a route.")); },
    });
  }

  select(o: RouteOption): void {
    this.selected.set(o);
    this.layer.clearLayers();
    this.drawHotspots();
    const plan = this.plan();
    if (!plan || !this.map) return;
    // Unselected route underneath, dashed grey; selected on top, green if it's a safe option.
    for (const r of [...plan.routes].sort(a => (a === o ? 1 : -1))) {
      const sel = r === o;
      L.polyline(r.path, {
        color: sel ? (r.kind === 'FASTEST' ? '#17202B' : '#2E7D5B') : '#8A96A3',
        weight: sel ? 6 : 4, opacity: sel ? 0.95 : 0.7, dashArray: sel ? undefined : '6 8',
      }).on('click', () => this.select(r)).addTo(this.layer);
    }
    this.map.fitBounds(L.latLngBounds(o.path), { padding: [40, 40] });
  }

  /** Start sharing for about the trip length, with a check-in deadline: friends are alerted if you don't arrive. */
  shareTrip(): void {
    const o = this.selected();
    if (!o) return;
    const tripMin = Math.ceil(o.durationS / 60);
    const checkIn = Math.min(720, Math.max(10, tripMin + 15));
    const share = checkIn <= 60 ? 60 : checkIn <= 480 ? 480 : null;
    this.api.startSharing(share, [], checkIn).subscribe({
      next: () => { this.live.refresh(); this.toast.ok(t('live.sharing')); this.router.navigateByUrl('/live'); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  /** Hotspot risk depends on the time, so plan for when you'll actually be walking. */
  private departure(): Date | null {
    if (this.leave === 'now') return null;
    const d = new Date();
    if (this.leave === '1h') return new Date(d.getTime() + 3_600_000);
    d.setHours(Number(this.leave), 0, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d;
  }

  km(m: number): string { return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`; }
  mins(s: number): string { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; }

  private drawHotspots(): void {
    this.api.hotspots().subscribe(hs => {
      for (const h of hs) {
        L.circle([h.centerLatitude, h.centerLongitude], {
          radius: h.radiusMeters, stroke: false, fillColor: riskLevel(h.intensityScore).color, fillOpacity: 0.08 + h.intensityScore * 0.14,
          interactive: false,
        }).addTo(this.layer);
      }
    });
  }

  private drawPins(): void {
    this.pins.clearLayers();
    const f = this.from(), d = this.to();
    if (f) L.circleMarker(f, { radius: 8, color: '#fff', weight: 3, fillColor: '#2F80ED', fillOpacity: 1 }).addTo(this.pins);
    if (d) L.circleMarker(d, { radius: 9, color: '#17202B', weight: 3, fillColor: '#F5C518', fillOpacity: 1 }).addTo(this.pins);
  }
}
