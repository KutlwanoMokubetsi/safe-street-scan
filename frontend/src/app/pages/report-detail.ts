import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { crimeColor, crimeLabel, timeAgo } from '../core/crime-types';
import { CommentItem, Report } from '../core/models';
import { ToastService } from '../core/toast.service';
import { TPipe } from '../core/i18n';

@Component({
  selector: 'app-report-detail',
  imports: [FormsModule, RouterLink, TPipe],
  template: `
    <div class="page narrow">
      <a routerLink="/map" class="back"><i class="pi pi-arrow-left" aria-hidden="true"></i> Map</a>

      @if (error()) {
        <p class="panel panel-body">{{ error() }}</p>
      } @else if (report(); as r) {
        <article class="panel panel-body report" [style.--c]="color(r.crimeType)">
          <div class="row">
            <span class="type-tag">{{ label(r.crimeType) }}</span>
            <span class="status status-{{ r.status }}">{{ r.status === 'VERIFIED' ? 'Verified' : r.status === 'REJECTED' ? 'Not published' : 'Unverified' }}</span>
          </div>
          <p class="desc">{{ r.description }}</p>
          <p class="muted small">{{ r.locationName || 'Pinned location' }} · {{ ago(r.occurredAt) }}</p>
          @if (r.source === 'NEWS' && r.sourceUrl) {
            <p class="small news-src">From the news, checked by a moderator: <a [href]="r.sourceUrl" target="_blank" rel="noopener noreferrer">{{ r.sourceName || 'source' }} <i class="pi pi-external-link ext" aria-hidden="true"></i></a></p>
          }
          @if (r.reporterTrusted) { <p class="small trusted"><i class="pi pi-verified" aria-hidden="true"></i> {{ 'seen.trusted' | t }}</p> }
          <div class="seen-row">
            @if (!r.mine && r.status !== 'REJECTED') {
              <button type="button" class="btn btn-sm" [class.on]="r.confirmedByMe" (click)="toggleSeen(r)" [attr.aria-pressed]="!!r.confirmedByMe">
                <i class="pi" [class.pi-eye]="!r.confirmedByMe" [class.pi-check]="r.confirmedByMe" aria-hidden="true"></i> {{ 'seen.button' | t }}
              </button>
            }
            @if (r.confirmations) { <span class="muted small">{{ 'seen.count' | t: { n: r.confirmations } }}</span> }
            <a class="btn btn-sm" routerLink="/map" [queryParams]="{ lat: r.latitude, lng: r.longitude }">Show on map</a>
          </div>
        </article>

        <section class="panel">
          <div class="panel-head">
            <h2>Comments</h2>
            <span class="muted small">{{ comments().length }}</span>
          </div>
          @if (comments().length === 0) {
            <p class="empty">No comments yet. Add useful details, like what happened next or whether police responded.</p>
          } @else {
            <ul class="comments">
              @for (c of comments(); track c.id) {
                <li [class.hidden]="c.hidden">
                  <div class="row">
                    <strong [class.reporter]="c.role === 'REPORTER'">{{ c.author }}</strong>
                    <span class="muted small">{{ ago(c.createdAt) }}</span>
                  </div>
                  @if (c.hidden) { <p class="small flagnote">Hidden after community flags. Only you{{ auth.canModerate() ? ' and moderators' : '' }} can see it.</p> }
                  <p class="body">{{ c.body }}</p>
                  <div class="acts">
                    @if (c.mine || auth.canModerate()) {
                      <button type="button" class="link danger" (click)="remove(c)">Delete</button>
                    }
                    @if (!c.mine) {
                      <button type="button" class="link" (click)="flag(c)" [disabled]="c.flaggedByMe">{{ c.flaggedByMe ? 'Flagged' : 'Flag' }}</button>
                    }
                    @if (auth.canModerate() && c.hidden) {
                      <button type="button" class="link" (click)="restore(c)">Restore</button>
                    }
                  </div>
                </li>
              }
            </ul>
          }
          @if (report()?.status !== 'REJECTED') {
            <form class="composer" (ngSubmit)="post()">
              <label for="cbody" class="visually-hidden">Add a comment</label>
              <textarea id="cbody" name="body" [(ngModel)]="body" maxlength="1000" rows="3"
                        placeholder="Add a comment. You'll appear as an anonymous neighbour."></textarea>
              @if (formError()) { <p class="err small" role="alert">{{ formError() }}</p> }
              <div class="row">
                <span class="muted small">No names, phone numbers or car registrations. Be kind.</span>
                <button class="btn btn-ink btn-sm" type="submit" [disabled]="busy() || !body.trim()">{{ busy() ? 'Posting…' : 'Post' }}</button>
              </div>
            </form>
          }
        </section>
      } @else {
        <div class="panel"><div class="sk-row"><div class="sk sk-line w40"></div><div class="sk sk-line w90"></div><div class="sk sk-line w70"></div></div></div>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 720px; }
    .back { display: inline-block; margin-bottom: 12px; color: var(--muted); text-decoration: none; }
    .report { border-left: 5px solid var(--c); margin-bottom: 20px; }
    .row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
    .desc { font-size: 1.1rem; margin: 10px 0 6px; overflow-wrap: anywhere; }
    .news-src { margin: 8px 0 12px; }
    .seen-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
    .seen-row .btn.on { background: var(--ink); color: #fff; border-color: var(--ink); }
    .trusted { color: var(--safe); font-weight: 600; margin-top: 6px; }
    .comments { list-style: none; margin: 0; padding: 0; }
    .comments li { padding: 12px 16px; border-bottom: 1px solid var(--line); }
    .comments li.hidden { background: #FFF6D6; }
    .reporter { color: var(--ink); background: var(--vest); padding: 0 6px; border-radius: 3px; }
    .body { margin: 4px 0; overflow-wrap: anywhere; white-space: pre-wrap; }
    .flagnote { color: #7A5B00; }
    .acts { display: flex; gap: 14px; }
    .link { background: none; border: 0; padding: 4px 0; color: var(--muted); font: 600 0.85rem var(--font-body); cursor: pointer; }
    .link:hover:not(:disabled) { color: var(--ink); text-decoration: underline; }
    .link.danger { color: var(--risk); }
    .composer { padding: 14px 16px; border-top: 1px solid var(--line); display: grid; gap: 8px; }
    .composer textarea { min-height: 80px; }
    .err { color: var(--risk); }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `,
})
export class ReportDetail implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  readonly id = input.required<string>();
  readonly report = signal<Report | null>(null);
  readonly comments = signal<CommentItem[]>([]);
  readonly error = signal('');
  readonly formError = signal('');
  readonly busy = signal(false);
  body = '';

  readonly label = crimeLabel;
  readonly color = crimeColor;
  readonly ago = timeAgo;
  private poll?: Subscription;

  ngOnInit(): void {
    this.auth.ensureUser();
    this.api.report(this.id()).subscribe({
      next: r => this.report.set(r),
      error: err => this.error.set(errorMessage(err, "This report isn't available.")),
    });
    // New comments appear while the page is open.
    this.poll = timer(0, 20_000).subscribe(() => this.loadComments());
  }

  ngOnDestroy(): void { this.poll?.unsubscribe(); }

  loadComments(): void {
    if (document.visibilityState !== 'visible') return;
    this.api.comments(this.id()).subscribe({ next: c => this.comments.set(c), error: () => {} });
  }

  post(): void {
    this.formError.set('');
    this.busy.set(true);
    this.api.postComment(this.id(), this.body.trim()).subscribe({
      next: res => {
        this.busy.set(false);
        this.body = '';
        this.comments.update(list => [...list, res.comment]);
        if (res.notice) this.toast.ok(res.notice);
      },
      // The server explains what to change (e.g. no phone numbers), so show it next to the box.
      error: err => { this.busy.set(false); this.formError.set(errorMessage(err, "Couldn't post your comment.")); },
    });
  }

  toggleSeen(r: Report): void {
    const req = r.confirmedByMe ? this.api.unconfirm(r.id) : this.api.confirm(r.id);
    req.subscribe({
      next: res => this.report.set({ ...r, confirmedByMe: !r.confirmedByMe, confirmations: res.confirmations }),
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  flag(c: CommentItem): void {
    this.api.flagComment(c.id).subscribe({
      next: () => { this.comments.update(l => l.map(x => x.id === c.id ? { ...x, flaggedByMe: true } : x)); this.toast.ok('Thanks. Moderators will take a look.'); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  remove(c: CommentItem): void {
    if (!confirm('Delete this comment?')) return;
    this.api.deleteComment(c.id).subscribe({
      next: () => this.comments.update(l => l.filter(x => x.id !== c.id)),
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  restore(c: CommentItem): void {
    this.api.setCommentStatus(c.id, 'VISIBLE').subscribe({
      next: () => this.comments.update(l => l.map(x => x.id === c.id ? { ...x, hidden: false } : x)),
      error: err => this.toast.error(errorMessage(err)),
    });
  }
}
