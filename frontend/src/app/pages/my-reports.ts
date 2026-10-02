import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { crimeColor, crimeLabel, timeAgo } from '../core/crime-types';
import { Report } from '../core/models';
import { errorMessage } from '../core/auth.interceptor';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-my-reports',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>My reports</h1>
          <p class="muted">Unverified reports still count toward hotspots, at a lower weight, until a moderator reviews them.</p>
        </div>
      </div>

      <section class="panel">
        @if (loading()) {
          <div aria-busy="true" aria-label="Loading">@for (i of [1,2,3]; track i) {<div class="sk-row"><div class="sk sk-line w40"></div><div class="sk sk-line w90"></div><div class="sk sk-line w70"></div></div>}</div>
        } @else if (reports().length === 0) {
          <div class="empty">
            <p>You haven't reported anything yet.</p>
            <a routerLink="/report" class="btn btn-vest">Report incident</a>
          </div>
        } @else {
          <ul>
            @for (r of reports(); track r.id) {
              <li [style.--c]="color(r.crimeType)">
                <div class="main">
                  <div class="row">
                    <span class="type-tag">{{ label(r.crimeType) }}</span>
                    <span class="status status-{{ r.status }}">{{ statusText(r.status) }}</span>
                  </div>
                  <p class="desc">{{ r.description }}</p>
                  <p class="muted small">
                    {{ r.locationName || 'Pinned location' }} · happened {{ ago(r.occurredAt) }}
                  </p>
                </div>
                <div class="acts">
                  <a class="btn btn-sm" routerLink="/map" [queryParams]="{ lat: r.latitude, lng: r.longitude }">View on map</a>
                  @if (r.status === 'PENDING') {
                    <button class="btn btn-sm btn-danger" type="button" (click)="remove(r)">Delete</button>
                  }
                </div>
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
  styles: `
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; gap: 16px; justify-content: space-between; align-items: flex-start;
         padding: 14px 16px; border-bottom: 1px solid var(--line); border-left: 4px solid var(--c); }
    li:last-child { border-bottom: 0; }
    .main { min-width: 0; flex: 1; }
    .row { display: flex; gap: 12px; align-items: baseline; }
    .desc { margin: 6px 0 4px; overflow-wrap: anywhere; }
    .acts { display: flex; gap: 8px; flex-shrink: 0; }
    @media (max-width: 640px) { li { flex-direction: column; } }
  `,
})
export class MyReports implements OnInit {
  private api = inject(ApiService);
  private rt = inject(RealtimeService).on('reports').pipe(takeUntilDestroyed());
  private toast = inject(ToastService);

  readonly reports = signal<Report[]>([]);
  readonly loading = signal(true);
  readonly label = crimeLabel;
  readonly color = crimeColor;
  readonly ago = timeAgo;

  statusText(s: Report['status']) {
    return s === 'VERIFIED' ? 'Verified' : s === 'REJECTED' ? 'Not published' : 'Waiting for review';
  }

  private subscribed = false;

  ngOnInit(): void {
    if (!this.subscribed) { this.subscribed = true; this.rt.subscribe(() => this.ngOnInit()); }
    this.api.myReports().subscribe({
      next: r => { this.reports.set(r); this.loading.set(false); },
      error: err => { this.toast.error(errorMessage(err, "Couldn't load your reports.")); this.loading.set(false); },
    });
  }

  remove(r: Report): void {
    if (!confirm('Delete this report? This can’t be undone.')) return;
    this.api.deleteReport(r.id).subscribe({
      next: () => { this.reports.update(list => list.filter(x => x.id !== r.id)); this.toast.ok('Report deleted.'); },
      error: err => this.toast.error(errorMessage(err, "Couldn't delete the report.")),
    });
  }
}
