import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth.service';
import { CRIME_TYPES, crimeColor, crimeLabel, timeAgo } from '../core/crime-types';
import { CrimeType, Report, Role, Suggestion, User } from '../core/models';
import { errorMessage } from '../core/auth.interceptor';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-moderation',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Review reports</h1>
          <p class="muted">Verify reports that look genuine. Reject spam, duplicates, and anything that names or accuses a person.</p>
        </div>
        <button class="btn" type="button" (click)="regenerate()" [disabled]="regenerating()">
          {{ regenerating() ? 'Updating…' : 'Update hotspots now' }}
        </button>
      </div>

      <section class="panel sugg">
        <div class="panel-head">
          <h2>Suggested from news</h2>
          <button class="btn btn-sm" type="button" (click)="refreshSuggestions()">Check news now</button>
        </div>
        <p class="muted small intro">Machine-learning suggestions from local news. Nothing is published unless you accept it.
          Check the source, the place and the type. Accepting creates a verified report linked to the article.</p>
        @if (suggestions().length === 0) {
          <p class="empty">No suggestions right now. They appear when recent local news describes a specific incident at a specific place.</p>
        } @else {
          <ul class="queue">
            @for (s of suggestions(); track s.id) {
              <li [style.--c]="color(s.crimeType)">
                <div class="main">
                  <a [href]="s.url" target="_blank" rel="noopener noreferrer" class="headline">{{ s.title }} <i class="pi pi-external-link ext" aria-hidden="true"></i></a>
                  <p class="small meta">
                    <span class="type-tag">{{ label(s.crimeType) }}</span>
                    <span class="muted">{{ pct(s.confidence) }}% confident</span>
                    <span [class.multi]="s.corroborations > 1">{{ s.corroborations }} {{ s.corroborations === 1 ? 'source' : 'sources' }}</span>
                  </p>
                  <p class="muted small">{{ s.placeName }} (±{{ s.precisionM }} m) · {{ s.sourceDomain }} · {{ s.publishedAt ? ago(s.publishedAt) : '' }}
                    · <a routerLink="/map" [queryParams]="{ lat: s.latitude, lng: s.longitude }">map</a></p>
                  <label class="small fix">Type
                    <select (change)="retype(s, $any($event.target).value)" [attr.aria-label]="'Type for ' + s.title">
                      @for (t of types; track t.value) { <option [value]="t.value" [selected]="t.value === s.crimeType">{{ t.label }}</option> }
                    </select>
                  </label>
                </div>
                <div class="acts">
                  <button class="btn btn-sm btn-ok" type="button" (click)="accept(s)">Accept</button>
                  <button class="btn btn-sm btn-danger" type="button" (click)="dismiss(s)">Dismiss</button>
                </div>
              </li>
            }
          </ul>
        }
      </section>

      @if (hidden().length) {
        <section class="panel sugg">
          <div class="panel-head"><h2>Hidden comments</h2><span class="muted small">Hidden after 3 community flags</span></div>
          <ul class="queue">
            @for (c of hidden(); track c.id) {
              <li>
                <div class="main"><p class="desc">{{ c.body }}</p>
                  <p class="muted small">{{ c.flags }} flags · {{ ago(c.createdAt) }} · <a [routerLink]="['/reports', c.reportId]">open report</a></p></div>
                <div class="acts">
                  <button class="btn btn-sm btn-ok" type="button" (click)="restoreComment(c.id)">Restore</button>
                  <button class="btn btn-sm btn-danger" type="button" (click)="deleteComment(c.id)">Delete</button>
                </div>
              </li>
            }
          </ul>
        </section>
      }

      <section class="panel">
        <div class="panel-head">
          <h2>Waiting for review</h2>
          <span class="muted small">{{ queue().length }} {{ queue().length === 1 ? 'report' : 'reports' }}</span>
        </div>
        @if (loading()) {
          <p class="empty">Loading…</p>
        } @else if (queue().length === 0) {
          <p class="empty">Nothing to review. New reports will show up here.</p>
        } @else {
          <ul class="queue">
            @for (r of queue(); track r.id) {
              <li [style.--c]="color(r.crimeType)">
                <div class="main">
                  <span class="type-tag">{{ label(r.crimeType) }}</span>
                  <p class="desc">{{ r.description }}</p>
                  <p class="muted small">
                    @if (r.confirmations) { <strong class="conf"><i class="pi pi-eye" aria-hidden="true"></i> {{ r.confirmations }} confirmed</strong> · }
                    @if (r.reporterTrust === 'TRUSTED') { <strong class="tr-ok">Trusted reporter</strong> · }
                    @if (r.reporterTrust === 'LOW') { <strong class="tr-low">Low-trust reporter</strong> · }
                    @if (r.reporterTrust === 'NEW') { <span>New reporter</span> · }
                    {{ r.locationName || 'Pinned location' }} · happened {{ ago(r.occurredAt) }} · sent {{ ago(r.createdAt) }}
                    · <a routerLink="/map" [queryParams]="{ lat: r.latitude, lng: r.longitude }">map</a>
                  </p>
                </div>
                <div class="acts">
                  <button class="btn btn-sm btn-ok" type="button" (click)="review(r, 'VERIFIED')">Verify</button>
                  <button class="btn btn-sm btn-danger" type="button" (click)="review(r, 'REJECTED')">Reject</button>
                </div>
              </li>
            }
          </ul>
        }
      </section>

      @if (auth.isAdmin()) {
        <section class="panel users">
          <div class="panel-head"><h2>People and roles</h2></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
              <tbody>
                @for (u of users(); track u.id) {
                  <tr>
                    <td>{{ u.fullName || '—' }}</td>
                    <td>{{ u.email }}</td>
                    <td>
                      <select [value]="u.role" (change)="setRole(u, $any($event.target).value)"
                              [disabled]="u.id === auth.user()?.id" [attr.aria-label]="'Role for ' + u.email">
                        <option value="USER">Member</option>
                        <option value="MODERATOR">Moderator</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    ul { list-style: none; margin: 0; padding: 0; }
    .queue li { display: flex; gap: 16px; padding: 14px 16px; border-bottom: 1px solid var(--line); border-left: 4px solid var(--c); }
    .queue li:last-child { border-bottom: 0; }
    .main { flex: 1; min-width: 0; }
    .desc { margin: 6px 0 4px; overflow-wrap: anywhere; }
    .acts { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
    .users { margin-top: 24px; }
    .conf { color: var(--ink); }
    .tr-ok { color: var(--safe); }
    .tr-low { color: var(--risk); }
    .sugg { margin-bottom: 24px; }
    .intro { padding: 10px 16px 0; }
    .headline { font-weight: 600; text-decoration: none; }
    .headline:hover { text-decoration: underline; }
    .meta { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin: 6px 0 2px; }
    .multi { color: var(--safe); font-weight: 600; }
    .fix { display: inline-flex; gap: 8px; align-items: center; margin-top: 6px; }
    .fix select { min-height: 34px; padding: 2px 8px; width: auto; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 16px; border-bottom: 1px solid var(--line); }
    th { font-size: 0.85rem; color: var(--muted); font-weight: 600; }
    td select { min-height: 36px; padding: 4px 8px; width: auto; }
    @media (max-width: 640px) { .queue li { flex-direction: column; } .acts { flex-direction: row; } }
  `,
})
export class Moderation implements OnInit {
  private api = inject(ApiService);
  private rt = inject(RealtimeService).on('reports').pipe(takeUntilDestroyed());
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  readonly queue = signal<Report[]>([]);
  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly regenerating = signal(false);
  readonly suggestions = signal<Suggestion[]>([]);
  readonly hidden = signal<{ id: string; reportId: string; body: string; flags: number; createdAt: string }[]>([]);
  readonly types = CRIME_TYPES;
  pct = (x: number) => Math.round(x * 100);
  readonly label = crimeLabel;
  readonly color = crimeColor;
  readonly ago = timeAgo;

  ngOnInit(): void {
    this.rt.subscribe(() => this.reloadQueue());
    this.loadExtras();
    this.api.pendingReports().subscribe({
      next: q => { this.queue.set(q); this.loading.set(false); },
      error: err => { this.toast.error(errorMessage(err)); this.loading.set(false); },
    });
    if (this.auth.isAdmin()) {
      this.api.users().subscribe({ next: u => this.users.set(u), error: err => this.toast.error(errorMessage(err)) });
    }
  }

  loadExtras(): void {
    this.api.suggestions().subscribe({ next: s => this.suggestions.set(s), error: () => {} });
    this.api.hiddenComments().subscribe({ next: h => this.hidden.set(h), error: () => {} });
  }

  retype(s: Suggestion, t: CrimeType): void {
    this.suggestions.update(l => l.map(x => x.id === s.id ? { ...x, crimeType: t } : x));
  }

  accept(s: Suggestion): void {
    this.api.acceptSuggestion(s.id, { crimeType: s.crimeType }).subscribe({
      next: () => { this.suggestions.update(l => l.filter(x => x.id !== s.id)); this.toast.ok('Report created from the article.'); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  dismiss(s: Suggestion): void {
    this.api.dismissSuggestion(s.id).subscribe({
      next: () => { this.suggestions.update(l => l.filter(x => x.id !== s.id)); this.toast.ok('Dismissed. The model will learn from this.'); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  refreshSuggestions(): void {
    this.api.refreshSuggestions().subscribe({
      next: () => { this.toast.ok('Checking news. New suggestions appear in about a minute.'); setTimeout(() => this.loadExtras(), 60_000); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  restoreComment(id: string): void {
    this.api.setCommentStatus(id, 'VISIBLE').subscribe({ next: () => this.hidden.update(l => l.filter(x => x.id !== id)), error: err => this.toast.error(errorMessage(err)) });
  }

  deleteComment(id: string): void {
    this.api.deleteComment(id).subscribe({ next: () => this.hidden.update(l => l.filter(x => x.id !== id)), error: err => this.toast.error(errorMessage(err)) });
  }

  reloadQueue(): void {
    this.api.pendingReports().subscribe({ next: q => this.queue.set(q), error: () => {} });
  }

  review(r: Report, status: 'VERIFIED' | 'REJECTED'): void {
    this.api.reviewReport(r.id, status).subscribe({
      next: () => {
        this.queue.update(q => q.filter(x => x.id !== r.id));
        this.toast.ok(status === 'VERIFIED' ? 'Report verified.' : 'Report rejected.');
      },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  regenerate(): void {
    this.regenerating.set(true);
    this.api.regenerateHotspots().subscribe({
      next: r => { this.toast.ok(`Hotspots updated: ${r.hotspots} active.`); this.regenerating.set(false); },
      error: err => { this.toast.error(errorMessage(err)); this.regenerating.set(false); },
    });
  }

  setRole(u: User, role: Role): void {
    this.api.setRole(u.id, role).subscribe({
      next: updated => {
        this.users.update(list => list.map(x => (x.id === updated.id ? updated : x)));
        this.toast.ok(`${updated.email} is now ${role === 'USER' ? 'a member' : role === 'ADMIN' ? 'an admin' : 'a moderator'}.`);
      },
      error: err => this.toast.error(errorMessage(err)),
    });
  }
}
