import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from './core/api.service';
import { AuthService } from './core/auth.service';
import { LiveService } from './core/live.service';
import { PushService } from './core/push.service';
import { RealtimeService } from './core/realtime.service';
import { ToastService } from './core/toast.service';
import { errorMessage } from './core/auth.interceptor';
import { avatarSrc } from './core/avatar';
import { I18n, Lang, TPipe, t as tr } from './core/i18n';
import { apiDown } from './core/auth.interceptor';
import { EscortSession } from './core/models';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  private host = inject(ElementRef<HTMLElement>);
  private observers: { disconnect(): void }[] = [];
  protected auth = inject(AuthService);
  protected live = inject(LiveService);
  protected toast = inject(ToastService);
  private push = inject(PushService);
  protected realtime = inject(RealtimeService);
  protected readonly online = signal(navigator.onLine);
  protected readonly apiDown = apiDown;
  private i18n = inject(I18n);
  private api = inject(ApiService);
  private router = inject(Router);

  protected readonly avatar = computed(() => avatarSrc(this.auth.user()?.avatarUrl));

  protected readonly initials = computed(() => {
    const u = this.auth.user();
    const src = u?.fullName || u?.email || '?';
    return src.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  });

  protected readonly shareText = computed(() => {
    const s = this.live.state();
    if (!s?.sharing) return '';
    if (s.myAlert) return tr('live.emergencyActive');
    const share = s.myShare;
    if (!share) return 'Sharing your location';
    const n = share.viewerIds.length;
    const who = `${n} ${n === 1 ? 'friend' : 'friends'}`;
    if (share.checkinDueAt) {
      const due = new Date(share.checkinDueAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
      return `Sharing with ${who}. Check in by ${due} or they'll be alerted`;
    }
    if (!share.expiresAt) return `Sharing your location with ${who} until you stop`;
    const t = new Date(share.expiresAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    return `Sharing your location with ${who} until ${t}`;
  });

  ngOnInit(): void {
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
    // Re-render once a minute so relative times ("2 min ago") stay accurate.
    setInterval(() => this.online.set(navigator.onLine), 60_000);
    if (!this.auth.isLoggedIn()) return;
    // Keep the account's language in step with the app, so notifications arrive in the same language.
    this.i18n.onChange = (l: Lang) => this.auth.updateProfile({ lang: l }).subscribe({ next: u => this.auth.user.set(u), error: () => {} });
    this.auth.ensureUser().then(u => { if (u && u.lang !== this.i18n.lang()) this.i18n.onChange?.(this.i18n.lang()); });
    this.realtime.start();
    this.live.start();
    this.push.check();
  }

  escortAct(s: EscortSession, action: 'accept' | 'decline' | 'ok'): void {
    this.api.escortAction(s.id, action).subscribe({ next: () => this.live.refresh(), error: err => this.toast.error(errorMessage(err)) });
  }

  checkIn(): void {
    this.api.checkIn().subscribe({
      next: () => { this.live.refresh(); this.toast.ok("Checked in. Your friends know you're safe."); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  /**
   * Publishes the real height of the top chrome (header + any banners) and the mobile bottom bar as CSS
   * variables, so full-height pages (map, live, route) never slide under them when a banner appears.
   */
  ngAfterViewInit(): void {
    const root = this.host.nativeElement as HTMLElement;
    const measure = () => {
      let top = 0;
      root.querySelectorAll(':scope > .bar, :scope > .notices')
        .forEach(el => (top += (el as HTMLElement).offsetHeight));
      const bottomBar = root.querySelector(':scope > .bottom-bar') as HTMLElement | null;
      const bottom = bottomBar && getComputedStyle(bottomBar).display !== 'none' ? bottomBar.offsetHeight : 0;
      document.documentElement.style.setProperty('--chrome-top', `${top}px`);
      document.documentElement.style.setProperty('--chrome-bottom', `${bottom}px`);
    };
    const ro = new ResizeObserver(measure);
    const watch = () => root.querySelectorAll(':scope > *').forEach(el => ro.observe(el));
    const mo = new MutationObserver(() => { watch(); measure(); }); // banners are added/removed as DOM nodes
    mo.observe(root, { childList: true });
    watch();
    measure();
    window.addEventListener('resize', measure);
    this.observers.push(ro, mo);
  }

  ngOnDestroy(): void { this.observers.forEach(o => o.disconnect()); }

  stopSharing(): void {
    this.api.stopSharing().subscribe({
      next: () => { this.live.refresh(); this.toast.ok('Stopped sharing your location.'); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

  openMyAlert(): void {
    this.router.navigateByUrl('/sos');
  }
}
