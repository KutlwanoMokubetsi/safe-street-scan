import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { currentPosition } from '../core/geo';
import { TPipe } from '../core/i18n';
import { GroupSummary } from '../core/models';
import { RealtimeService } from '../core/realtime.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-groups',
  imports: [FormsModule, RouterLink, TPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'groups.title' | t }}</h1>
          <p class="muted">{{ 'groups.intro' | t }}</p>
        </div>
      </div>

      <div class="cols">
        <section class="panel">
          <div class="panel-head"><h2>Your groups</h2></div>
          @if (loading()) {
            <div class="sk-row"><div class="sk sk-line w40"></div><div class="sk sk-line w70"></div></div>
          } @else if (!groups().length) {
            <p class="empty">You're not in any groups yet. Create one for your street, estate or CPF, or join with a code.</p>
          } @else {
            <ul>
              @for (g of groups(); track g.id) {
                <li>
                  <a [routerLink]="['/groups', g.id]">
                    <span class="kind">{{ kindLabel(g.kind) }}</span>
                    <strong>{{ g.name }}</strong>
                    <span class="muted small">{{ g.members }} members · {{ g.role.toLowerCase() }}@if (g.sosShare) { · receives your SOS }</span>
                  </a>
                </li>
              }
            </ul>
          }
        </section>

        <div class="stack">
          <form class="panel panel-body" (ngSubmit)="join()">
            <h2>{{ 'groups.join' | t }}</h2>
            <div class="field"><label for="code">Invite code</label>
              <input id="code" name="code" [(ngModel)]="code" maxlength="12" autocapitalize="characters" autocomplete="off" placeholder="e.g. 7QK2MZPA"></div>
            <button class="btn btn-ink" type="submit" [disabled]="!code.trim() || busy()">Join</button>
          </form>

          <form class="panel panel-body" (ngSubmit)="create()">
            <h2>{{ 'groups.create' | t }}</h2>
            <div class="field"><label for="gname">Name</label><input id="gname" name="gname" [(ngModel)]="name" maxlength="80" placeholder="e.g. Melville Neighbourhood Watch"></div>
            <div class="field"><label for="kind">Type</label>
              <select id="kind" name="kind" [(ngModel)]="kind">
                <option value="WATCH">Neighbourhood watch</option>
                <option value="ESTATE">Estate or complex</option>
                <option value="CPF">Community policing forum (CPF)</option>
              </select></div>
            <div class="field"><label for="desc">Description <span class="muted">(optional)</span></label>
              <textarea id="desc" name="desc" [(ngModel)]="description" maxlength="500" rows="2"></textarea></div>
            <label class="check"><input type="checkbox" name="here" [(ngModel)]="useHere"> Use where I am now as the group's area</label>
            <button class="btn btn-vest" type="submit" [disabled]="!name.trim() || busy()">Create group</button>
            <p class="muted small note">Free for up to 100 members.</p>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: `
    .cols { display: grid; grid-template-columns: 3fr 2fr; gap: 24px; align-items: start; }
    .stack { display: grid; gap: 24px; }
    h2 { margin-bottom: 12px; }
    .panel-head h2 { margin: 0; }
    ul { list-style: none; margin: 0; padding: 0; }
    li a { display: grid; gap: 2px; padding: 14px 16px; border-bottom: 1px solid var(--line); text-decoration: none; }
    li:last-child a { border-bottom: 0; }
    li a:hover { background: var(--surface); }
    .kind { font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
    .check { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; }
    .check input { width: 20px; height: 20px; min-height: 0; }
    .note { margin-top: 8px; }
    @media (max-width: 860px) { .cols { grid-template-columns: 1fr; } }
  `,
})
export class Groups implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private rt = inject(RealtimeService).on('groups').pipe(takeUntilDestroyed());

  readonly groups = signal<GroupSummary[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  code = '';
  name = '';
  kind = 'WATCH';
  description = '';
  useHere = true;

  ngOnInit(): void {
    this.load();
    this.rt.subscribe(() => this.load());
  }

  load(): void {
    this.api.groups().subscribe({ next: g => { this.groups.set(g); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  kindLabel(k: string): string { return k === 'ESTATE' ? 'Estate' : k === 'CPF' ? 'CPF' : 'Neighbourhood watch'; }

  join(): void {
    this.busy.set(true);
    this.api.joinGroup(this.code).subscribe({
      next: r => { this.busy.set(false); this.router.navigate(['/groups', r.id]); },
      error: err => { this.busy.set(false); this.toast.error(errorMessage(err)); },
    });
  }

  async create(): Promise<void> {
    this.busy.set(true);
    const pos = this.useHere ? await currentPosition(8000) : null;
    this.api.createGroup({ name: this.name.trim(), kind: this.kind, description: this.description.trim() || undefined,
      lat: pos?.[0], lng: pos?.[1] }).subscribe({
      next: r => { this.busy.set(false); this.router.navigate(['/groups', r.id]); },
      error: err => { this.busy.set(false); this.toast.error(errorMessage(err)); },
    });
  }
}
