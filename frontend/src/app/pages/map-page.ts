import { AfterViewInit, Component, ElementRef, OnDestroy, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { Subscription, debounceTime, Subject, switchMap, forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import { CRIME_TYPES, crimeColor, crimeLabel, riskLevel, timeAgo } from '../core/crime-types';
import { DEFAULT_CENTER, createMap, currentPosition, escapeHtml } from '../core/geo';
import { CrimeType, Hotspot, Report } from '../core/models';
import { errorMessage } from '../core/auth.interceptor';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-map-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="layout">
      <aside class="side">
        <h1>Map</h1>
        <p class="muted small">Shaded circles are hotspots. Dots are individual reports in the visible area.</p>

        <div class="filters">
          <div class="field">
            <label for="days">Period</label>
            <select id="days" [(ngModel)]="days" (ngModelChange)="refresh()">
              <option [ngValue]="7">Past 7 days</option>
              <option [ngValue]="30">Past 30 days</option>
              <option [ngValue]="90">Past 90 days</option>
            </select>
          </div>
          <div class="field">
            <label for="type">Type</label>
            <select id="type" [(ngModel)]="type" (ngModelChange)="draw()">
              <option value="">All types</option>
              @for (t of types; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
            </select>
          </div>
          <label class="check">
            <input type="checkbox" [(ngModel)]="verifiedOnly" (ngModelChange)="refresh()">
            Verified reports only
          </label>
        </div>

        <p class="count small">
          @if (loading()) { Loading… } @else { {{ visibleCount() }} reports in view }
        </p>

        <div class="actions">
          <button class="btn" type="button" (click)="locate()">Go to my location</button>
          <a class="btn btn-vest" routerLink="/report" [queryParams]="centerParams()">Report here</a>
        </div>

        @if (hotspots().length) {
          <h2 class="spots-head">Hotspots</h2>
          <ul class="spots">
            @for (h of hotspots(); track h.id) {
              <li>
                <button type="button" (click)="focus(h)">
                  <span class="name">{{ h.name }}</span>
                  <span class="lvl" [style.color]="risk(h.intensityScore).color">{{ risk(h.intensityScore).label }}</span>
                </button>
              </li>
            }
          </ul>
        }
      </aside>

      <div class="map" #mapEl role="application" aria-label="Crime map"></div>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 320px 1fr; height: calc(100vh - 60px); }
    .side { padding: 20px 16px; overflow-y: auto; background: var(--card); border-right: 1px solid var(--line); }
    .side h1 { margin-bottom: 4px; }
    .filters { margin-top: 16px; }
    .check { display: flex; align-items: center; gap: 8px; font-weight: 500; }
    .check input { width: 20px; height: 20px; min-height: 0; }
    .count { margin: 16px 0 8px; color: var(--muted); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .spots-head { margin: 24px 0 8px; font-size: 1.1rem; }
    .spots { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
    .spots button {
      width: 100%; display: flex; justify-content: space-between; gap: 8px; text-align: left;
      padding: 10px 2px; background: none; border: 0; border-bottom: 1px solid var(--line);
      font: inherit; color: inherit; cursor: pointer;
    }
    .spots button:hover .name { text-decoration: underline; }
    .lvl { font-weight: 600; font-size: 0.875rem; white-space: nowrap; }
    .map { height: 100%; width: 100%; }
    @media (max-width: 760px) {
      .layout { grid-template-columns: 1fr; grid-template-rows: 55vh auto; height: auto; }
      .map { order: -1; height: 55vh; }
      .side { border-right: 0; border-top: 1px solid var(--line); padding-bottom: 88px; }
    }
  `,
})
export class MapPage implements AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  /** Optional ?lat=&lng= query params to open the map on a spot. */
  readonly lat = input<string>();
  readonly lng = input<string>();

  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');
  private map?: L.Map;
  private reportLayer = L.layerGroup();
  private hotspotLayer = L.layerGroup();
  private me?: L.CircleMarker;
  private moves = new Subject<void>();
  private sub?: Subscription;

  readonly types = CRIME_TYPES;
  readonly risk = riskLevel;
  readonly loading = signal(false);
  readonly hotspots = signal<Hotspot[]>([]);
  readonly visibleCount = signal(0);
  readonly centerParams = signal<{ lat?: number; lng?: number }>({});
  private reports: Report[] = [];

  days = 30;
  type: CrimeType | '' = '';
  verifiedOnly = false;

  async ngAfterViewInit(): Promise<void> {
    const fromUrl = this.lat() && this.lng() ? [Number(this.lat()), Number(this.lng())] as [number, number] : null;
    this.map = createMap(this.mapEl().nativeElement, fromUrl ?? DEFAULT_CENTER, fromUrl ? 16 : 14);
    this.hotspotLayer.addTo(this.map);
    this.reportLayer.addTo(this.map);

    this.sub = this.moves.pipe(
      debounceTime(350),
      switchMap(() => {
        this.loading.set(true);
        const b = this.map!.getBounds();
        return forkJoin({
          reports: this.api.reportsInArea({
            minLat: b.getSouth(), maxLat: b.getNorth(), minLng: b.getWest(), maxLng: b.getEast(),
          }, this.days, this.verifiedOnly),
          hotspots: this.api.hotspots(),
        });
      }),
    ).subscribe({
      next: d => {
        this.reports = d.reports;
        this.hotspots.set(d.hotspots);
        this.loading.set(false);
        this.draw();
      },
      error: err => { this.loading.set(false); this.toast.error(errorMessage(err, "Couldn't load map data.")); },
    });

    this.map.on('moveend', () => { this.updateCenter(); this.moves.next(); });
    this.updateCenter();
    this.moves.next();

    if (!fromUrl) {
      const pos = await currentPosition();
      if (pos && this.map) { this.map.setView(pos, 15); this.showMe(pos); }
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.map?.remove();
  }

  refresh(): void { this.moves.next(); }

  draw(): void {
    if (!this.map) return;
    this.hotspotLayer.clearLayers();
    for (const h of this.hotspots()) {
      const lvl = riskLevel(h.intensityScore);
      L.circle([h.centerLatitude, h.centerLongitude], {
        radius: h.radiusMeters, color: lvl.color, weight: 2, fillColor: lvl.color, fillOpacity: 0.12 + h.intensityScore * 0.2,
      }).bindPopup(
        `<strong>${escapeHtml(h.name)}</strong><br>${lvl.label} risk · ${h.crimeCount} incidents<br>` +
        `<span style="color:#5E6873">Mostly ${escapeHtml(crimeLabel(h.topCrimeType).toLowerCase())}</span>`,
      ).addTo(this.hotspotLayer);
    }

    this.reportLayer.clearLayers();
    const shown = this.type ? this.reports.filter(r => r.crimeType === this.type) : this.reports;
    for (const r of shown) {
      L.circleMarker([r.latitude, r.longitude], {
        radius: 7, weight: 2, color: '#fff', fillColor: crimeColor(r.crimeType), fillOpacity: 1,
        dashArray: r.status === 'VERIFIED' ? undefined : '3 3',
      }).bindPopup(
        `<strong>${escapeHtml(crimeLabel(r.crimeType))}</strong>` +
        ` <span style="color:${r.status === 'VERIFIED' ? '#2E7D5B' : '#D9822B'};font-size:12px">` +
        `${r.status === 'VERIFIED' ? 'Verified' : 'Unverified'}</span><br>` +
        `${escapeHtml(r.description)}<br>` +
        `<span style="color:#5E6873">${escapeHtml(r.locationName || '')} ${r.locationName ? '· ' : ''}${timeAgo(r.occurredAt)}</span>`,
      ).addTo(this.reportLayer);
    }
    this.visibleCount.set(shown.length);
  }

  focus(h: Hotspot): void {
    this.map?.setView([h.centerLatitude, h.centerLongitude], 16);
  }

  async locate(): Promise<void> {
    const pos = await currentPosition();
    if (!pos) return this.toast.error('Location is off. Allow location access in your browser to use this.');
    this.map?.setView(pos, 16);
    this.showMe(pos);
  }

  private showMe(pos: [number, number]): void {
    this.me?.remove();
    this.me = L.circleMarker(pos, { radius: 8, color: '#17202B', weight: 3, fillColor: '#F5C518', fillOpacity: 1 })
      .bindTooltip('You are here').addTo(this.map!);
  }

  private updateCenter(): void {
    const c = this.map!.getCenter();
    this.centerParams.set({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) });
  }
}
