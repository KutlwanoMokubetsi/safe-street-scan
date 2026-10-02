import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { errorMessage } from '../core/auth.interceptor';
import { FriendEntry, FriendsOverview } from '../core/models';
import { ToastService } from '../core/toast.service';
import { avatarSrc, initialsOf } from '../core/avatar';

@Component({
  selector: 'app-friends',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Friends</h1>
          <p class="muted">Friends get your emergency alerts and can see your location when you choose to share it.</p>
        </div>
        <a routerLink="/live" class="btn">Live location</a>
      </div>

      <div class="cols">
        <div class="stack">
          <section class="panel panel-body code-box">
            <h2>Your friend code</h2>
            <p class="code" aria-label="Your friend code">{{ data()?.myCode ?? '········' }}</p>
            <p class="muted small">Give this code to someone you trust so they can add you. Only share it with people you know.</p>
            <div class="row">
              <button class="btn btn-sm" type="button" (click)="copy()" [disabled]="!data()">Copy code</button>
              <a class="btn btn-sm" [href]="whatsappLink()" target="_blank" rel="noopener">Send on WhatsApp</a>
            </div>
          </section>

          <form class="panel panel-body" (ngSubmit)="add()">
            <h2>Add a friend</h2>
            <div class="field">
              <label for="code">Their friend code</label>
              <input id="code" name="code" [(ngModel)]="code" autocomplete="off" autocapitalize="characters"
                     maxlength="12" placeholder="e.g. K7M2QX9P">
            </div>
            <button class="btn btn-ink" type="submit" [disabled]="busy() || !code.trim()">Send request</button>
          </form>
        </div>

        <div class="stack">
          @if (data()?.incoming?.length) {
            <section class="panel">
              <div class="panel-head"><h2>Requests for you</h2></div>
              <ul>
                @for (e of data()!.incoming; track e.friendshipId) {
                  <li>
                    <span class="name">{{ e.person.name }}</span>
                    <span class="acts">
                      <button class="btn btn-sm btn-ok" type="button" (click)="accept(e)">Accept</button>
                      <button class="btn btn-sm" type="button" (click)="remove(e, 'Request declined.')">Decline</button>
                    </span>
                  </li>
                }
              </ul>
            </section>
          }

          <section class="panel">
            <div class="panel-head">
              <h2>Your friends</h2>
              <span class="muted small">{{ data()?.friends?.length ?? 0 }}</span>
            </div>
            @if (loading()) {
              <div aria-busy="true" aria-label="Loading">@for (i of [1,2,3]; track i) {<div class="sk-row"><div class="sk sk-line w40"></div><div class="sk sk-line w90"></div><div class="sk sk-line w70"></div></div>}</div>
            } @else if (!data()?.friends?.length) {
              <p class="empty">No friends yet. Share your code with family or neighbours you trust.</p>
            } @else {
              <ul>
                @for (e of data()!.friends; track e.friendshipId) {
                  <li>
                    <span class="who">
                      @if (pic(e.person.avatarUrl); as src) { <img [src]="src" alt="" class="av"> } @else { <span class="av">{{ ini(e.person.name) }}</span> }
                      <span>
                      <span class="name">{{ e.person.name }}</span>
                      @if (!e.person.phone) { <span class="muted small block">No phone number added</span> }
                      </span>
                    </span>
                    <span class="acts">
                      @if (e.person.phone) { <a class="btn btn-sm" [href]="'tel:' + e.person.phone">Call</a> }
                      <button class="btn btn-sm btn-danger" type="button" (click)="removeFriend(e)">Remove</button>
                    </span>
                  </li>
                }
              </ul>
            }
          </section>

          @if (data()?.outgoing?.length) {
            <section class="panel">
              <div class="panel-head"><h2>Waiting for them</h2></div>
              <ul>
                @for (e of data()!.outgoing; track e.friendshipId) {
                  <li>
                    <span class="name">{{ e.person.name }}</span>
                    <button class="btn btn-sm" type="button" (click)="remove(e, 'Request cancelled.')">Cancel</button>
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
    .stack { display: flex; flex-direction: column; gap: 24px; }
    h2 { margin-bottom: 12px; }
    .panel-head h2 { margin: 0; }
    .code-box .code {
      font: 700 2.2rem/1.1 var(--font-head); letter-spacing: 0.12em; margin: 4px 0 8px;
      padding: 10px 14px; background: var(--surface); border: 2px dashed var(--line); border-radius: var(--radius-m);
      display: inline-block;
    }
    .row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
    li:last-child { border-bottom: 0; }
    .name { font-weight: 600; }
    .who { display: flex; align-items: center; gap: 12px; }
    .av { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex: none; display: grid; place-items: center; background: var(--surface); border: 1px solid var(--line); font-weight: 600; font-size: .85rem; }
    .block { display: block; }
    .acts { display: flex; gap: 8px; flex-shrink: 0; }
    @media (max-width: 860px) { .cols { grid-template-columns: 1fr; } }
  `,
})
export class Friends implements OnInit {
  private api = inject(ApiService);
  private rt = inject(RealtimeService).on('friends').pipe(takeUntilDestroyed());
  private toast = inject(ToastService);

  readonly data = signal<FriendsOverview | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  code = '';
  readonly pic = avatarSrc;
  readonly ini = initialsOf;

  ngOnInit(): void {
    this.load();
    this.rt.subscribe(() => this.load());
  }

  load(): void {
    this.api.friends().subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: err => { this.toast.error(errorMessage(err, "Couldn't load friends.")); this.loading.set(false); },
    });
  }

  whatsappLink(): string {
    const code = this.data()?.myCode ?? '';
    const text = `Add me on CrimeSpot so we can look out for each other. My friend code is ${code}. ${location.origin}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.data()!.myCode);
      this.toast.ok('Code copied.');
    } catch {
      this.toast.error("Couldn't copy. Select the code and copy it manually.");
    }
  }

  add(): void {
    this.busy.set(true);
    this.api.addFriend(this.code).subscribe({
      next: () => { this.toast.ok('Request sent.'); this.code = ''; this.busy.set(false); this.load(); },
      error: err => { this.toast.error(errorMessage(err)); this.busy.set(false); },
    });
  }

  accept(e: FriendEntry): void {
    this.api.acceptFriend(e.friendshipId).subscribe({
      next: () => { this.toast.ok(`You and ${e.person.name} are now friends.`); this.load(); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  removeFriend(e: FriendEntry): void {
    if (!confirm(`Remove ${e.person.name}? You'll stop seeing each other's location and alerts.`)) return;
    this.remove(e, `${e.person.name} removed.`);
  }

  remove(e: FriendEntry, done: string): void {
    this.api.removeFriend(e.friendshipId).subscribe({
      next: () => { this.toast.ok(done); this.load(); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }
}
