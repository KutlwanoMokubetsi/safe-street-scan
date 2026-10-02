import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from './core/api.service';
import { AuthService } from './core/auth.service';
import { LiveService } from './core/live.service';
import { PushService } from './core/push.service';
import { RealtimeService } from './core/realtime.service';
import { ToastService } from './core/toast.service';
import { errorMessage } from './core/auth.interceptor';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected auth = inject(AuthService);
  protected live = inject(LiveService);
  protected toast = inject(ToastService);
  private push = inject(PushService);
  protected realtime = inject(RealtimeService);
  protected readonly online = signal(navigator.onLine);
  private api = inject(ApiService);
  private router = inject(Router);

  protected readonly initials = computed(() => {
    const u = this.auth.user();
    const src = u?.fullName || u?.email || '?';
    return src.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  });

  protected readonly shareText = computed(() => {
    const s = this.live.state();
    if (!s?.sharing) return '';
    if (s.myAlert) return 'Emergency alert active. Friends can see where you are.';
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
    this.auth.ensureUser();
    this.realtime.start();
    this.live.start();
    this.push.check();
  }

  checkIn(): void {
    this.api.checkIn().subscribe({
      next: () => { this.live.refresh(); this.toast.ok("Checked in. Your friends know you're safe."); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }

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
