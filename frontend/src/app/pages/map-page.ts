import { AfterViewInit, Component, ElementRef, OnDestroy, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { Subject, Subscription, debounceTime, forkJoin, switchMap } from 'rxjs';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { SEVERITY, Severity, crimeColor, crimeLabel, riskLevel, severityOf, timeAgo } from '../core/crime-types';
import { DEFAULT_CENTER, createMap, currentPosition } from '../core/geo';
import { Hotspot, Report } from '../core/models';
import { RealtimeService } from '../core/realtime.service';
import { ToastService } from '../core/toast.service';

const CLUSTER_PX = 56;

@Component({
  selector: 'app-map-page',
  imports: [RouterLink],
  template: `
    <div class="wrap">
      <div class="map" #mapEl role="application" aria-label="Crime map"></div>

      <!-- Filters float over the map -->
      <div class="chips" role="toolbar" aria-label="Map filters">
        @for (d of periods; track d.days) {
          <button type="button" class="chip" [class.on]="days() === d.days" (click)="setDays(d.days)">{{ d.label }}</button>
        }
        <span class="sep" aria-hidden="true"></span>
        @for (s of severities; track s) {
          <button type="button" class="chip sev" [class.on]="shown().has(s)" (click)="toggleSeverity(s)"
                  [style.--c]="SEV[s].color" [attr.aria-pressed]="shown().has(s)">{{ SEV[s].label }}</button>
        }
        <button type="button" class="chip" [class.on]="verifiedOnly()" (click)="toggleVerified()" [attr.aria-pressed]="verifiedOnly()">Verified only</button>
      </div>

      <div class="status" aria-live="polite">
        @if (loading()) { Updating… } @else { {{ count() }} {{ count() === 1 ? 'report' : 'reports' }} here@if (hotspots().length) {<span> · {{ hotspots().length }} hotspots</span>} }
      </div>

      <div class="fabs">
        <button type="button" class="fab" (click)="locate()" aria-label="Go to my location">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <a class="fab report" routerLink="/report" [queryParams]="center()">Report here</a>
      </div>

      @if (selected(); as r) {
        <div class="sheet" role="dialog" aria-label="Report details">
          <button type="button" class="close" (click)="selected.set(null)" aria-label="Close">×</button>
          <div class="sheet-head">
            <span class="type-tag" [style.--c]="color(r.crimeType)">{{ label(r.crimeType) }}</span>
            <span class="status-{{ r.status }} small">{{ r.status === 'VERIFIED' ? 'Verified' : 'Unverified' }}</span>
          </div>
          <p class="desc">{{ r.description }}</p>
          <p class="muted small">{{ r.locationName || 'Pinned location' }} · {{ ago(r.occurredAt) }}</p>
        </div>
      } @else if (spot(); as h) {
        <div class="sheet" role="dialog" aria-label="Hotspot details">
          <button type="button" class="close" (click)="spot.set(null)" aria-label="Close">×</button>
          <div class="sheet-head">
            <h2>{{ h.name }}</h2>
            <span class="risk" [style.color]="risk(h.intensityScore).color">{{ risk(h.intensityScore).label }} risk</span>
          </div>
          <p class="muted">{{ h.crimeCount }} incidents in the last 30 days, mostly {{ label(h.topCrimeType).toLowerCase() }}.</p>
          @if (h.trend === 'RISING') { <p class="trend-RISING small">▲ Rising: more incidents this week than usual</p> }
          @if (h.trend === 'FALLING') { <p class="trend-FALLING small">▼ Falling: fewer incidents this week than usual</p> }
          @if (h.peakHours) { <p class="small">Most incidents happen <strong>{{ h.peakHours }}</strong>.</p> }
        </div>
      }
    </div>
  `,
  styles: `
    .wrap { position: relative; height: calc(100vh - 60px); }
    .map { position: absolute; inset: 0; }
    .chips {
      position: absolute; z-index: 500; top: 12px; left: 12px; right: 12px;
      display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none;
    }
    .chips::-webkit-scrollbar { display: none; }
    .chip {
      flex: none; display: inline-flex; align-items: center; gap: 6px;
      height: 36px; padding: 0 14px; border-radius: 18px; cursor: pointer;
      background: #fff; color: var(--ink); border: 1px solid var(--line);
      font: 600 0.875rem var(--font-body); box-shadow: 0 1px 4px rgba(23,32,43,.12);
    }
    .chip.on { background: var(--ink); color: #fff; border-color: var(--ink); }
    .chip.sev::before { content: ''; width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
    .chip.sev:not(.on) { color: var(--muted); }
    .chip.sev:not(.on)::before { opacity: .35; }
    .sep { flex: none; width: 1px; background: var(--line); margin: 6px 2px; }
    .status {
      position: absolute; z-index: 500; top: 58px; left: 12px;
      background: rgba(255,255,255,.92); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; color: var(--muted);
    }
    .fabs { position: absolute; z-index: 500; right: 12px; bottom: 24px; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
    .fab {
      display: grid; place-items: center; min-width: 48px; height: 48px; border-radius: 24px; padding: 0 14px;
      background: #fff; color: var(--ink); border: 0; cursor: pointer; text-decoration: none;
      box-shadow: 0 2px 10px rgba(23,32,43,.25); font: 700 0.95rem var(--font-body);
    }
    .fab.report { background: var(--vest); padding: 0 20px; }
    .sheet {
      position: absolute; z-index: 600; left: 12px; right: 12px; bottom: 24px; max-width: 440px;
      background: #fff; border-radius: 14px; padding: 16px 18px; box-shadow: 0 8px 30px rgba(23,32,43,.3);
    }
    .sheet-head { display: flex; align-items: baseline; gap: 10px; padding-right: 28px; margin-bottom: 6px; flex-wrap: wrap; }
    .sheet h2 { font-size: 1.15rem; }
    .risk { font-weight: 600; font-size: 0.9rem; }
    .desc { margin-bottom: 6px; overflow-wrap: anywhere; }
    .close { position: absolute; top: 8px; right: 10px; width: 36px; height: 36px; border: 0; background: none; font-size: 1.5rem; color: var(--muted); cursor: pointer; }
    @media (max-width: 860px) {
      /* Header (two rows) and the SOS/Report bar take ~170px; dvh follows the browser toolbar. */
      .wrap { height: calc(100vh - 170px); height: calc(100dvh - 170px); }
      .fabs { bottom: 16px; }
      .fab.report { display: none; } /* the bottom bar already has Report */
      .sheet { bottom: 12px; max-width: none; }
    }
  `,
})
export class MapPage implements AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private live = inject(RealtimeService).on('reports', 'hotspots').pipe(takeUntilDestroyed());

  readonly lat = input<string>();
  readonly lng = input<string>();

  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');
  private map?: L.Map;
  private hotLayer = L.layerGroup();
  private dotLayer = L.layerGroup();
  private me?: L.CircleMarker;
  private moves = new Subject<void>();
  private sub?: Subscription;
  private reports: Report[] = [];

  readonly SEV = SEVERITY;
  readonly severities: Severity[] = ['violent', 'property', 'other'];
  readonly periods = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }];
  private readonly saved = MapPage.loadFilters();
  readonly days = signal(this.saved.days);
  readonly verifiedOnly = signal(this.saved.verifiedOnly);
  readonly shown = signal(new Set<Severity>(this.saved.shown));

  /** Filters are remembered on this device between visits. */
  private static loadFilters(): { days: number; verifiedOnly: boolean; shown: Severity[] } {
    const d = { days: 30, verifiedOnly: false, shown: ['violent', 'property', 'other'] as Severity[] };
    try { return { ...d, ...JSON.parse(localStorage.getItem('crimespot.mapFilters') ?? '{}') }; } catch { return d; }
  }
  private saveFilters(): void {
    try {
      localStorage.setItem('crimespot.mapFilters', JSON.stringify({ days: this.days(), verifiedOnly: this.verifiedOnly(), shown: [...this.shown()] }));
    } catch { /* ignore */ }
  }
  readonly loading = signal(false);
  readonly count = signal(0);
  readonly hotspots = signal<Hotspot[]>([]);
  readonly selected = signal<Report | null>(null);
  readonly spot = signal<Hotspot | null>(null);
  readonly center = signal<{ lat?: number; lng?: number }>({});

  readonly label = crimeLabel;
  readonly color = crimeColor;
  readonly risk = riskLevel;
  readonly ago = timeAgo;

  async ngAfterViewInit(): Promise<void> {
    const fromUrl = this.lat() && this.lng() ? [Number(this.lat()), Number(this.lng())] as [number, number] : null;
    this.map = createMap(this.mapEl().nativeElement, fromUrl ?? DEFAULT_CENTER, fromUrl ? 16 : 14);
    this.map.zoomControl.setPosition('bottomleft');
    this.hotLayer.addTo(this.map);
    this.dotLayer.addTo(this.map);
    this.map.on('click', () => { this.selected.set(null); this.spot.set(null); });

    this.sub = this.moves.pipe(
      debounceTime(300),
      switchMap(() => {
        this.loading.set(true);
        const b = this.map!.getBounds().pad(0.25);
        return forkJoin({
          reports: this.api.reportsInArea({ minLat: b.getSouth(), maxLat: b.getNorth(), minLng: b.getWest(), maxLng: b.getEast() },
            this.days(), this.verifiedOnly()),
          hotspots: this.api.hotspots(),
        });
      }),
    ).subscribe({
      next: d => { this.reports = d.reports; this.hotspots.set(d.hotspots); this.loading.set(false); this.draw(); },
      error: err => { this.loading.set(false); this.toast.error(errorMessage(err, "Couldn't load the map.")); },
    });

    this.map.on('moveend', () => { this.updateCenter(); this.moves.next(); });
    this.map.on('zoomend', () => this.draw());
    this.live.subscribe(() => this.moves.next());
    this.updateCenter();
    this.moves.next();

    if (!fromUrl) {
      const pos = await currentPosition();
      if (pos && this.map) { this.map.setView(pos, 15); this.showMe(pos); }
    }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); this.map?.remove(); }

  setDays(d: number): void { this.days.set(d); this.saveFilters(); this.moves.next(); }
  toggleVerified(): void { this.verifiedOnly.update(v => !v); this.saveFilters(); this.moves.next(); }
  toggleSeverity(s: Severity): void {
    this.shown.update(set => { const n = new Set(set); n.has(s) ? n.delete(s) : n.add(s); return n.size ? n : set; });
    this.saveFilters();
    this.draw();
  }

  async locate(): Promise<void> {
    const pos = await currentPosition();
    if (!pos) return this.toast.error('Location is off. Allow location access in your browser to use this.');
    this.map?.setView(pos, 16);
    this.showMe(pos);
  }

  /** Soft hotspots + reports grouped into clusters by screen distance, recomputed on every zoom. */
  private draw(): void {
    const map = this.map;
    if (!map) return;

    this.hotLayer.clearLayers();
    for (const h of this.hotspots()) {
      const lvl = riskLevel(h.intensityScore);
      L.circle([h.centerLatitude, h.centerLongitude], {
        radius: h.radiusMeters, stroke: false, fillColor: lvl.color, fillOpacity: 0.06 + h.intensityScore * 0.14,
      }).on('click', e => { L.DomEvent.stopPropagation(e); this.selected.set(null); this.spot.set(h); })
        .addTo(this.hotLayer);
    }

    this.dotLayer.clearLayers();
    const visible = this.reports.filter(r => this.shown().has(severityOf(r.crimeType)));
    this.count.set(visible.length);

    const cells = new Map<string, Report[]>();
    for (const r of visible) {
      const p = map.project([r.latitude, r.longitude], map.getZoom());
      const key = `${Math.floor(p.x / CLUSTER_PX)}:${Math.floor(p.y / CLUSTER_PX)}`;
      (cells.get(key) ?? cells.set(key, []).get(key)!).push(r);
    }

    for (const group of cells.values()) {
      if (group.length === 1) {
        const r = group[0];
        const icon = L.divIcon({
          className: '', iconSize: [18, 18], iconAnchor: [9, 9],
          html: `<div class="cs-dot ${r.status === 'VERIFIED' ? '' : 'unverified'}" style="--c:${SEVERITY[severityOf(r.crimeType)].color}"></div>`,
        });
        L.marker([r.latitude, r.longitude], { icon, keyboard: true, title: crimeLabel(r.crimeType) })
          .on('click', e => { L.DomEvent.stopPropagation(e); this.spot.set(null); this.selected.set(r); })
          .addTo(this.dotLayer);
      } else {
        const lat = group.reduce((a, r) => a + r.latitude, 0) / group.length;
        const lng = group.reduce((a, r) => a + r.longitude, 0) / group.length;
        const size = Math.min(52, 30 + Math.log2(group.length) * 6);
        const icon = L.divIcon({
          className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
          html: `<div class="cs-cluster" style="width:${size}px;height:${size}px">${group.length}</div>`,
        });
        L.marker([lat, lng], { icon, keyboard: true, title: `${group.length} reports` })
          .on('click', e => {
            L.DomEvent.stopPropagation(e);
            map.fitBounds(L.latLngBounds(group.map(r => [r.latitude, r.longitude] as [number, number])), { padding: [60, 60], maxZoom: 18 });
          })
          .addTo(this.dotLayer);
      }
    }
  }

  private showMe(pos: [number, number]): void {
    this.me?.remove();
    this.me = L.circleMarker(pos, { radius: 8, color: '#fff', weight: 3, fillColor: '#2F80ED', fillOpacity: 1 })
      .bindTooltip('You are here').addTo(this.map!);
  }

  private updateCenter(): void {
    const c = this.map!.getCenter();
    this.center.set({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) });
  }
}
