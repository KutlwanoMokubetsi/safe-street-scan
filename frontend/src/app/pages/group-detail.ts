import { Component, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';
import { avatarSrc, initialsOf } from '../core/avatar';
import { crimeColor, crimeLabel, timeAgo } from '../core/crime-types';
import { TPipe } from '../core/i18n';
import { GroupDetail, GroupMember, GroupPost, Report } from '../core/models';
import { RealtimeService } from '../core/realtime.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-group-detail',
  imports: [FormsModule, RouterLink, TPipe],
  template: `
    <div class="page">
      <a routerLink="/groups" class="back"><i class="pi pi-arrow-left" aria-hidden="true"></i> {{ 'groups.title' | t }}</a>
      @if (g(); as g) {
        <div class="page-head">
          <div>
            <h1>{{ g.name }}</h1>
            @if (g.description) { <p class="muted">{{ g.description }}</p> }
            <p class="muted small">{{ g.members.length }}{{ g.memberCap ? ' / ' + g.memberCap : '' }} members · invite code <strong class="code">{{ g.inviteCode }}</strong></p>
          </div>
          <a class="btn btn-sm" [href]="whatsapp(g)" target="_blank" rel="noopener">Invite on WhatsApp</a>
        </div>

        <div class="cols">
          <div class="stack">
            <section class="panel">
              <div class="panel-head"><h2>Feed</h2></div>
              <form class="composer" (ngSubmit)="post(false)">
                <label for="pbody" class="sr">Write to the group</label>
                <textarea id="pbody" name="pbody" [(ngModel)]="body" maxlength="1000" rows="2" placeholder="Share something with the group. No names, phone numbers or car registrations."></textarea>
                <div class="row">
                  <button class="btn btn-ink btn-sm" type="submit" [disabled]="!body.trim()">Post</button>
                  @if (isAdmin(g)) {
                    <button class="btn btn-sm btn-danger" type="button" (click)="post(true)" [disabled]="!body.trim()">Send as alert to everyone</button>
                  }
                </div>
              </form>
              @if (!g.posts.length) { <p class="empty">No posts yet.</p> }
              <ul class="posts">
                @for (p of g.posts; track p.id) {
                  <li [class.alert]="p.alert">
                    <div class="row"><strong>@if (p.alert) { <i class="pi pi-exclamation-triangle alert-ico" aria-hidden="true"></i> }{{ p.author }}</strong><span class="muted small">{{ ago(p.createdAt) }}</span></div>
                    <p class="pb">{{ p.body }}</p>
                    @if (p.mine || isAdmin(g)) { <button type="button" class="link danger" (click)="deletePost(p)">Delete</button> }
                  </li>
                }
              </ul>
            </section>

            <section class="panel">
              <div class="panel-head"><h2>In the group's area</h2><span class="muted small">Last 14 days</span></div>
              @if (g.areaLat == null) {
                <p class="empty">No area set.@if (isAdmin(g)) { <button class="btn btn-sm" type="button" (click)="setArea()">Use where I am now</button> }</p>
              } @else if (!reports().length) {
                <p class="empty">No reports in this area recently.</p>
              } @else {
                <ul class="reports">
                  @for (r of reports(); track r.id) {
                    <li [style.--c]="color(r.crimeType)"><a [routerLink]="['/reports', r.id]">
                      <span class="type-tag">{{ label(r.crimeType) }}</span> <span class="muted small">· {{ ago(r.occurredAt) }}</span>
                      <p>{{ r.description }}</p></a></li>
                  }
                </ul>
              }
            </section>
          </div>

          <div class="stack">
            <section class="panel panel-body">
              <h2>SOS</h2>
              <label class="check"><input type="checkbox" [checked]="g.mySosShare" (change)="toggleSos($any($event.target).checked)"> {{ 'groups.sosShare' | t }}</label>
              <p class="muted small">{{ 'groups.sosShareNote' | t }}</p>
            </section>

            <section class="panel">
              <div class="panel-head"><h2>Members</h2></div>
              <ul class="members">
                @for (m of g.members; track m.userId) {
                  <li>
                    @if (pic(m.avatarUrl); as src) { <img [src]="src" alt="" class="av"> } @else { <span class="av">{{ ini(m.name) }}</span> }
                    <span class="mn"><strong>{{ m.name }}</strong><span class="muted small">{{ m.role.toLowerCase() }}</span></span>
                    @if (g.myRole === 'OWNER' && m.role !== 'OWNER') {
                      <select [attr.aria-label]="'Role for ' + m.name" (change)="setRole(m, $any($event.target).value)">
                        <option value="MEMBER" [selected]="m.role === 'MEMBER'">Member</option>
                        <option value="ADMIN" [selected]="m.role === 'ADMIN'">Admin</option>
                        <option value="OWNER">Make owner</option>
                      </select>
                    }
                    @if (isAdmin(g) && m.role !== 'OWNER' && m.userId !== auth.user()?.id) {
                      <button type="button" class="link danger" (click)="remove(m)">Remove</button>
                    }
                  </li>
                }
              </ul>
            </section>

            <section class="panel panel-body">
              @if (g.myRole === 'OWNER') {
                <button class="btn btn-danger btn-sm" type="button" (click)="deleteGroup()">Delete group</button>
              } @else {
                <button class="btn btn-sm" type="button" (click)="leave()">Leave group</button>
              }
            </section>
          </div>
        </div>
      } @else {
        <div class="panel"><div class="sk-row"><div class="sk sk-line w40"></div><div class="sk sk-line w90"></div></div></div>
      }
    </div>
  `,
  styles: `
    .back { display: inline-block; margin-bottom: 12px; color: var(--muted); text-decoration: none; }
    .code { letter-spacing: .1em; color: var(--ink); }
    .cols { display: grid; grid-template-columns: 3fr 2fr; gap: 24px; align-items: start; }
    .stack { display: grid; gap: 24px; }
    h2 { margin-bottom: 10px; }
    .panel-head h2 { margin: 0; }
    .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .composer { padding: 12px 16px; border-bottom: 1px solid var(--line); display: grid; gap: 8px; }
    .composer .row { justify-content: flex-start; }
    ul { list-style: none; margin: 0; padding: 0; }
    .posts li { padding: 12px 16px; border-bottom: 1px solid var(--line); }
    .posts li.alert { background: #FDECEA; border-left: 4px solid var(--risk); }
    .pb { margin: 4px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .reports li a { display: block; padding: 12px 16px; border-bottom: 1px solid var(--line); border-left: 4px solid var(--c); text-decoration: none; }
    .reports p { margin: 4px 0 0; }
    .members li { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--line); }
    .mn { flex: 1; display: grid; }
    .av { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; display: grid; place-items: center; background: var(--surface); border: 1px solid var(--line); font-size: .8rem; font-weight: 600; flex: none; }
    .members select { width: auto; min-height: 34px; padding: 2px 6px; }
    .check { display: flex; gap: 10px; align-items: flex-start; font-weight: 500; margin-bottom: 6px; }
    .check input { width: 22px; height: 22px; min-height: 0; flex: none; margin-top: 2px; }
    .link { background: none; border: 0; padding: 4px 0; color: var(--muted); font: 600 .85rem var(--font-body); cursor: pointer; }
    .link.danger { color: var(--risk); }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    @media (max-width: 860px) { .cols { grid-template-columns: 1fr; } }
  `,
})
export class GroupDetailPage implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  protected auth = inject(AuthService);
  private rt = inject(RealtimeService).on('groups').pipe(takeUntilDestroyed());

  readonly id = input.required<string>();
  readonly g = signal<GroupDetail | null>(null);
  readonly reports = signal<Report[]>([]);
  body = '';
  readonly pic = avatarSrc;
  readonly ini = initialsOf;
  readonly label = crimeLabel;
  readonly color = crimeColor;
  readonly ago = timeAgo;

  ngOnInit(): void {
    this.auth.ensureUser();
    this.load();
    this.rt.subscribe(() => this.load());
  }

  load(): void {
    this.api.group(this.id()).subscribe({
      next: g => { this.g.set(g); if (g.areaLat != null) this.api.groupReports(g.id).subscribe(r => this.reports.set(r)); },
      error: err => { this.toast.error(errorMessage(err, "This group isn't available.")); this.router.navigateByUrl('/groups'); },
    });
  }

  isAdmin(g: GroupDetail): boolean { return g.myRole === 'OWNER' || g.myRole === 'ADMIN'; }

  whatsapp(g: GroupDetail): string {
    const text = `Join "${g.name}" on CrimeSpot so we can look out for each other. Invite code: ${g.inviteCode}. ${location.origin}/groups`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  post(alert: boolean): void {
    if (alert && !confirm('Send this as an alert? Every member gets a notification.')) return;
    this.api.groupPost(this.id(), this.body.trim(), alert).subscribe({
      next: () => { this.body = ''; this.load(); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  deletePost(p: GroupPost): void {
    if (!confirm('Delete this post?')) return;
    this.api.deleteGroupPost(this.id(), p.id).subscribe({ next: () => this.load(), error: err => this.toast.error(errorMessage(err)) });
  }

  toggleSos(share: boolean): void {
    this.api.setGroupSos(this.id(), share).subscribe({ next: () => this.load(), error: err => this.toast.error(errorMessage(err)) });
  }

  setRole(m: GroupMember, role: string): void {
    if (role === 'OWNER' && !confirm(`Make ${m.name} the owner? You'll become an admin.`)) { this.load(); return; }
    this.api.setMemberRole(this.id(), m.userId, role).subscribe({ next: () => this.load(), error: err => this.toast.error(errorMessage(err)) });
  }

  remove(m: GroupMember): void {
    if (!confirm(`Remove ${m.name} from the group?`)) return;
    this.api.removeMember(this.id(), m.userId).subscribe({ next: () => this.load(), error: err => this.toast.error(errorMessage(err)) });
  }

  leave(): void {
    const me = this.auth.user()?.id;
    if (!me || !confirm('Leave this group?')) return;
    this.api.removeMember(this.id(), me).subscribe({ next: () => this.router.navigateByUrl('/groups'), error: err => this.toast.error(errorMessage(err)) });
  }

  deleteGroup(): void {
    if (!confirm('Delete this group for everyone? This can’t be undone.')) return;
    this.api.deleteGroup(this.id()).subscribe({ next: () => this.router.navigateByUrl('/groups'), error: err => this.toast.error(errorMessage(err)) });
  }

  async setArea(): Promise<void> {
    const { currentPosition } = await import('../core/geo');
    const pos = await currentPosition(8000);
    if (!pos) return this.toast.error('Allow location access to set the area.');
    this.api.updateGroup(this.id(), { lat: pos[0], lng: pos[1] }).subscribe({ next: () => this.load(), error: err => this.toast.error(errorMessage(err)) });
  }
}
