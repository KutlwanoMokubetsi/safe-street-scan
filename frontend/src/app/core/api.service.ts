import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Alert, Bounds, FriendsOverview, Hotspot, Live, NewReport, Report, ReportStatus, Role, Share, Stats, User } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api`;

  stats() { return this.http.get<Stats>(`${this.base}/stats`); }

  recentReports(limit = 8) {
    return this.http.get<Report[]>(`${this.base}/reports/recent`, { params: { limit } });
  }

  reportsInArea(b: Bounds, days: number, verifiedOnly: boolean) {
    const params = new HttpParams({ fromObject: { ...b, days, verifiedOnly } as any });
    return this.http.get<Report[]>(`${this.base}/reports`, { params });
  }

  myReports() { return this.http.get<Report[]>(`${this.base}/reports/mine`); }

  createReport(r: NewReport) { return this.http.post<Report>(`${this.base}/reports`, r); }

  deleteReport(id: string) { return this.http.delete<void>(`${this.base}/reports/${id}`); }

  pendingReports() { return this.http.get<Report[]>(`${this.base}/reports/pending`); }

  reviewReport(id: string, status: Exclude<ReportStatus, 'PENDING'>) {
    return this.http.patch<Report>(`${this.base}/reports/${id}/status`, { status });
  }

  hotspots() { return this.http.get<Hotspot[]>(`${this.base}/hotspots`); }

  regenerateHotspots() { return this.http.post<{ hotspots: number }>(`${this.base}/hotspots/regenerate`, {}); }

  users() { return this.http.get<User[]>(`${this.base}/admin/users`); }

  setRole(id: string, role: Role) { return this.http.patch<User>(`${this.base}/admin/users/${id}/role`, { role }); }

  // ---- Friends ----
  friends() { return this.http.get<FriendsOverview>(`${this.base}/friends`); }
  addFriend(code: string) { return this.http.post<void>(`${this.base}/friends/requests`, { code }); }
  acceptFriend(friendshipId: string) { return this.http.post<void>(`${this.base}/friends/requests/${friendshipId}/accept`, {}); }
  removeFriend(friendshipId: string) { return this.http.delete<void>(`${this.base}/friends/${friendshipId}`); }

  // ---- Live location ----
  live() { return this.http.get<Live>(`${this.base}/live`); }
  startSharing(minutes: number | null, friendIds: string[]) {
    return this.http.post<Share>(`${this.base}/location/share`, { minutes, friendIds });
  }
  stopSharing() { return this.http.delete<void>(`${this.base}/location/share`); }
  sendLocation(latitude: number, longitude: number, accuracyM?: number) {
    return this.http.post<void>(`${this.base}/location`, { latitude, longitude, accuracyM });
  }

  // ---- Panic ----
  panic(body: { latitude?: number; longitude?: number; accuracyM?: number; message?: string }) {
    return this.http.post<Alert>(`${this.base}/panic`, body);
  }
  resolvePanic(id: string) { return this.http.post<Alert>(`${this.base}/panic/${id}/resolve`, {}); }
  alert(id: string) { return this.http.get<Alert>(`${this.base}/panic/${id}`); }

  // ---- Push ----
  pushKey() { return this.http.get<{ enabled: boolean; publicKey: string }>(`${this.base}/push/public-key`); }
  pushSubscribe(sub: PushSubscriptionJSON) { return this.http.post<void>(`${this.base}/push/subscribe`, sub); }
  pushUnsubscribe(endpoint: string) { return this.http.post<void>(`${this.base}/push/unsubscribe`, { endpoint }); }
}
