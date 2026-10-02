import { Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from './core/api.service';
import { AuthService } from './core/auth.service';
import { LiveService } from './core/live.service';
import { PushService } from './core/push.service';
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
    if (!share.expiresAt) return `Sharing your location with ${who} until you stop`;
    const t = new Date(share.expiresAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    return `Sharing your location with ${who} until ${t}`;
  });

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) return;
    this.auth.ensureUser();
    this.live.start();
    this.push.check();
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
