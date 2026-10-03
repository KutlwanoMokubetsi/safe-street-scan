import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth.service';
import { crimeColor, crimeLabel, riskLevel, timeAgo } from '../core/crime-types';
import { Hotspot, News, Report, Stats } from '../core/models';
import { currentPosition } from '../core/geo';
import { errorMessage } from '../core/auth.interceptor';
import { APK, isAndroid } from '../core/downloads';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  template: `
    <div class="page">
      @if (showAppBanner()) {
        <div class="app-banner" role="region" aria-label="Android app">
          <div>
            <strong>Get the CrimeSpot app</strong>
            <span>Location sharing and SOS keep working with your screen off.</span>
          </div>
          <a class="btn btn-vest btn-sm" [href]="apk">Download</a>
          <button type="button" class="x" (click)="hideAppBanner()" aria-label="Dismiss"><i class="pi pi-times" aria-hidden="true"></i></button>
        </div>
      }
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
            <div aria-busy="true" aria-label="Loading">@for (i of [1,2,3]; track i) {<div class="sk-row"><div class="sk sk-line w40"></div><div class="sk sk-line w90"></div><div class="sk sk-line w70"></div></div>}</div>
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
                  <a class="desc-link" [routerLink]="['/reports', r.id]"><p class="desc">{{ r.description }}</p></a>
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
            <div aria-busy="true" aria-label="Loading">@for (i of [1,2,3]; track i) {<div class="sk-row"><div class="sk sk-line w40"></div><div class="sk sk-line w90"></div><div class="sk sk-line w70"></div></div>}</div>
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
                    <p class="small insight">
                      @if (h.trend && h.trend !== 'STEADY') { <span class="trend-{{ h.trend }}"><i class="pi" [class.pi-arrow-up]="h.trend === 'RISING'" [class.pi-arrow-down]="h.trend !== 'RISING'" aria-hidden="true"></i> {{ h.trend === 'RISING' ? 'Rising' : 'Falling' }}</span> }
                      @if (h.peakHours) { <span class="muted">Most incidents {{ h.peakHours }}</span> }
                    </p>
                  </a>
                </li>
              }
            </ul>
          }
        </section>
      </div>

      <section class="panel news">
        <div class="panel-head">
          <h2>Local news{{ news()?.area ? ': ' + news()!.area : '' }}</h2>
          <span class="muted small">Past 7 days</span>
        </div>
        @if (newsLoading()) {
          <div aria-busy="true" aria-label="Loading">@for (i of [1,2,3]; track i) {<div class="sk-row"><div class="sk sk-line w40"></div><div class="sk sk-line w90"></div><div class="sk sk-line w70"></div></div>}</div>
        } @else if (!news()?.items?.length) {
          <p class="empty">No recent crime news found for this area.</p>
        } @else {
          <ul class="news-list">
            @for (n of news()!.items; track n.url) {
              <li>
                <a [href]="n.url" target="_blank" rel="noopener noreferrer">{{ n.title }}</a>
                <p class="muted small">{{ n.source }}@if (n.publishedAt) { · {{ ago(n.publishedAt) }} }</p>
              </li>
            }
          </ul>
        }
        <p class="muted small attribution">Headlines from GDELT and Google News, matched to your area. CrimeSpot doesn't check news stories; open the source for details.</p>
      </section>
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
    .desc-link { text-decoration: none; color: inherit; display: block; }
    .desc-link:hover .desc { text-decoration: underline; }
    .app-banner { display: flex; align-items: center; gap: 12px; padding: 12px 14px; margin-bottom: 16px; border-radius: var(--radius-m); background: var(--ink); color: #fff; }
    .app-banner div { flex: 1; display: grid; gap: 2px; }
    .app-banner span { color: #C9D1D9; font-size: .88rem; }
    .app-banner .x { background: none; border: 0; color: #C9D1D9; font-size: 1.5rem; line-height: 1; cursor: pointer; padding: 4px 6px; }
    .insight { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 2px; }
    .news { margin-top: 24px; }
    .news-list li { padding: 12px 16px; border-bottom: 1px solid var(--line); }
    .news-list a { font-weight: 600; text-decoration: none; }
    .news-list a:hover { text-decoration: underline; }
    .attribution { padding: 10px 16px 14px; }
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
  protected readonly apk = APK.universal;
  /** Android browser users only, until dismissed. */
  protected readonly showAppBanner = signal(isAndroid() && !localStorage.getItem('crimespot.appBannerHidden'));
  hideAppBanner(): void {
    try { localStorage.setItem('crimespot.appBannerHidden', '1'); } catch { /* ignore */ }
    this.showAppBanner.set(false);
  }

  private api = inject(ApiService);
  private rt = inject(RealtimeService).on('reports', 'hotspots').pipe(takeUntilDestroyed());
  private auth = inject(AuthService);

  readonly stats = signal<Stats | null>(null);
  readonly reports = signal<Report[]>([]);
  readonly hotspots = signal<Hotspot[]>([]);
  readonly loading = signal(true);
  readonly news = signal<News | null>(null);
  readonly newsLoading = signal(true);
  readonly error = signal('');

  readonly label = crimeLabel;
  readonly color = crimeColor;
  readonly risk = riskLevel;
  readonly ago = timeAgo;
  pct = (s: number) => Math.round(s * 100);

  firstName() {
    return this.auth.firstName() || 'there';
  }

  ngOnInit(): void {
    this.load();
    this.loadNews();
    this.rt.subscribe(() => this.load(true));
  }

  /** quiet: refresh in place without showing loading states (used for live updates). */
  load(quiet = false): void {
    if (!quiet) this.loading.set(true);
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

  /** News for where you are now (or Johannesburg if location is off). Loaded once per visit. */
  private async loadNews(): Promise<void> {
    const pos = await currentPosition(6000);
    this.api.news(pos).subscribe({
      next: n => { this.news.set(n); this.newsLoading.set(false); },
      error: () => { this.news.set(null); this.newsLoading.set(false); },
    });
  }
}
