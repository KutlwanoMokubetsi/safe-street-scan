import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { crimeColor, crimeLabel, timeAgo } from '../core/crime-types';
import { Report, Role, User } from '../core/models';
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
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  readonly queue = signal<Report[]>([]);
  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly regenerating = signal(false);
  readonly label = crimeLabel;
  readonly color = crimeColor;
  readonly ago = timeAgo;

  ngOnInit(): void {
    this.api.pendingReports().subscribe({
      next: q => { this.queue.set(q); this.loading.set(false); },
      error: err => { this.toast.error(errorMessage(err)); this.loading.set(false); },
    });
    if (this.auth.isAdmin()) {
      this.api.users().subscribe({ next: u => this.users.set(u), error: err => this.toast.error(errorMessage(err)) });
    }
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
