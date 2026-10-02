import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { crimeColor, crimeLabel, riskLevel, timeAgo } from '../core/crime-types';
import { Hotspot, Report, Stats } from '../core/models';
import { errorMessage } from '../core/auth.interceptor';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Hi {{ firstName() }}</h1>
          <p class="muted">Here's what the community has reported recently.</p>
        </div>
        <a routerLink="/map" class="btn">Open map</a>
      </div>

      @if (error()) {
        <div class="panel panel-body err-box">
          <p>{{ error() }}</p>
          <button class="btn btn-sm" type="button" (click)="load()">Try again</button>
        </div>
      }

      <section class="strip panel" aria-label="Summary">
        <div><strong>{{ stats()?.reportsLast7Days ?? '–' }}</strong><span>reports this week</span></div>
        <div><strong>{{ stats()?.activeHotspots ?? '–' }}</strong><span>active hotspots</span></div>
        <div><strong>{{ stats()?.verifiedReports ?? '–' }}</strong><span>verified reports</span></div>
        <div><strong>{{ stats()?.totalReports ?? '–' }}</strong><span>reports in total</span></div>
      </section>

      <div class="cols">
        <section class="panel">
          <div class="panel-head"><h2>Latest reports</h2></div>
          @if (loading()) {
            <p class="empty">Loading reports…</p>
          } @else if (reports().length === 0) {
            <div class="empty">
              <p>No reports yet. If something happened near you, add it so others know.</p>
              <a routerLink="/report" class="btn btn-vest">Report incident</a>
            </div>
          } @else {
            <ul class="feed">
              @for (r of reports(); track r.id) {
                <li [style.--c]="color(r.crimeType)">
                  <div class="row">
                    <span class="type-tag">{{ label(r.crimeType) }}</span>
                    <span class="status status-{{ r.status }}">{{ r.status === 'VERIFIED' ? 'Verified' : 'Unverified' }}</span>
                  </div>
                  <p class="desc">{{ r.description }}</p>
                  <p class="meta muted small">
                    {{ r.locationName || 'Location pinned on map' }} · {{ ago(r.occurredAt) }}
                  </p>
                </li>
              }
            </ul>
          }
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Hotspots</h2>
            <span class="muted small">Last 30 days</span>
          </div>
          @if (loading()) {
            <p class="empty">Loading hotspots…</p>
          } @else if (hotspots().length === 0) {
            <p class="empty">No hotspots right now. A hotspot appears when 3 or more incidents are reported within about 500 m.</p>
          } @else {
            <ul class="spots">
              @for (h of hotspots(); track h.id) {
                <li>
                  <a [routerLink]="['/map']" [queryParams]="{ lat: h.centerLatitude, lng: h.centerLongitude }">
                    <div class="row">
                      <h3>{{ h.name }}</h3>
                      <span class="risk" [style.color]="risk(h.intensityScore).color">{{ risk(h.intensityScore).label }}</span>
                    </div>
                    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100"
                         [attr.aria-valuenow]="pct(h.intensityScore)" [attr.aria-label]="'Risk for ' + h.name">
                      <span [style.width.%]="pct(h.intensityScore)" [style.background]="risk(h.intensityScore).color"></span>
                    </div>
                    <p class="muted small">{{ h.crimeCount }} incidents · mostly {{ label(h.topCrimeType).toLowerCase() }}</p>
                  </a>
                </li>
              }
            </ul>
          }
        </section>
      </div>
    </div>
  `,
  styles: `
    .strip { display: grid; grid-template-columns: repeat(4, 1fr); margin-bottom: 24px; }
    .strip div { padding: 16px; display: flex; flex-direction: column; border-left: 1px solid var(--line); }
    .strip div:first-child { border-left: 0; }
    .strip strong { font: 700 2rem/1 var(--font-head); }
    .strip span { color: var(--muted); font-size: 0.9rem; margin-top: 4px; }
    .cols { display: grid; grid-template-columns: 3fr 2fr; gap: 24px; align-items: start; }
    ul { list-style: none; margin: 0; padding: 0; }
    .feed li { padding: 14px 16px; border-bottom: 1px solid var(--line); border-left: 4px solid var(--c); }
    .feed li:last-child { border-bottom: 0; }
    .row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .desc { margin: 6px 0 4px; overflow-wrap: anywhere; }
    .spots li { border-bottom: 1px solid var(--line); }
    .spots li:last-child { border-bottom: 0; }
    .spots a { display: block; padding: 14px 16px; text-decoration: none; }
    .spots a:hover { background: var(--surface); }
    .risk { font-weight: 600; font-size: 0.9rem; white-space: nowrap; }
    .meter { height: 6px; background: var(--surface); border-radius: 3px; margin: 8px 0 6px; overflow: hidden; }
    .meter span { display: block; height: 100%; }
    .err-box { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; border-color: var(--risk); }
    @media (max-width: 860px) {
      .cols { grid-template-columns: 1fr; }
      .strip { grid-template-columns: repeat(2, 1fr); }
      .strip div:nth-child(3) { border-left: 0; }
      .strip div:nth-child(n+3) { border-top: 1px solid var(--line); }
    }
  `,
})
export class Dashboard implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly stats = signal<Stats | null>(null);
  readonly reports = signal<Report[]>([]);
  readonly hotspots = signal<Hotspot[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly label = crimeLabel;
  readonly color = crimeColor;
  readonly risk = riskLevel;
  readonly ago = timeAgo;
  pct = (s: number) => Math.round(s * 100);

  firstName() {
    return this.auth.firstName() || 'there';
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ stats: this.api.stats(), reports: this.api.recentReports(8), hotspots: this.api.hotspots() })
      .subscribe({
        next: d => {
          this.stats.set(d.stats);
          this.reports.set(d.reports);
          this.hotspots.set(d.hotspots.slice(0, 6));
          this.loading.set(false);
        },
        error: err => { this.error.set(errorMessage(err, "Couldn't load the overview.")); this.loading.set(false); },
      });
  }
}
