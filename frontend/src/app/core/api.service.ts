import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Alert, Bounds, CommentItem, EmergencyInfo, News, PlaceResult, RoutePlan, Suggestion, FriendsOverview, Hotspot, Live, NewReport, Report, ReportStatus, Role, Share, Stats, User } from './models';

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
  startSharing(minutes: number | null, friendIds: string[], checkInMinutes: number | null = null) {
    return this.http.post<Share>(`${this.base}/location/share`, { minutes, friendIds, checkInMinutes });
  }
  checkIn() { return this.http.post<void>(`${this.base}/location/checkin`, {}); }
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

  // ---- Report detail & comments ----
  report(id: string) { return this.http.get<Report>(`${this.base}/reports/${id}`); }
  comments(reportId: string) { return this.http.get<CommentItem[]>(`${this.base}/reports/${reportId}/comments`); }
  postComment(reportId: string, body: string) {
    return this.http.post<{ comment: CommentItem; notice?: string }>(`${this.base}/reports/${reportId}/comments`, { body });
  }
  flagComment(id: string) { return this.http.post<void>(`${this.base}/comments/${id}/flag`, {}); }
  deleteComment(id: string) { return this.http.delete<void>(`${this.base}/comments/${id}`); }
  setCommentStatus(id: string, status: 'VISIBLE' | 'HIDDEN') { return this.http.patch<void>(`${this.base}/comments/${id}`, { status }); }
  hiddenComments() { return this.http.get<{ id: string; reportId: string; body: string; flags: number; createdAt: string }[]>(`${this.base}/comments/hidden`); }

  // ---- Profile picture ----
  uploadAvatar(jpeg: Blob) {
    return this.http.put<{ avatarUrl: string }>(`${this.base}/me/avatar`, jpeg, { headers: { 'Content-Type': 'image/jpeg' } });
  }
  removeAvatar() { return this.http.delete<void>(`${this.base}/me/avatar`); }

  // ---- News suggestions (moderators) ----
  suggestions() { return this.http.get<Suggestion[]>(`${this.base}/suggestions`); }
  acceptSuggestion(id: string, body: Partial<Pick<Suggestion, 'crimeType' | 'placeName'>> = {}) {
    return this.http.post<Suggestion>(`${this.base}/suggestions/${id}/accept`, body);
  }
  dismissSuggestion(id: string) { return this.http.post<void>(`${this.base}/suggestions/${id}/dismiss`, {}); }
  refreshSuggestions() { return this.http.post<{ status: string }>(`${this.base}/suggestions/refresh`, {}); }

  // ---- Safe routes ----
  routes(from: [number, number], to: [number, number], walk: boolean) {
    return this.http.post<RoutePlan>(`${this.base}/routes`, {
      from: { lat: from[0], lng: from[1] }, to: { lat: to[0], lng: to[1] }, walk,
    });
  }
  places(q: string) { return this.http.get<PlaceResult[]>(`${this.base}/places`, { params: { q } }); }

  // ---- Emergency card ----
  emergencyCard() { return this.http.get<{ consent: boolean; info: EmergencyInfo | null }>(`${this.base}/me/emergency`); }
  saveEmergencyCard(info: EmergencyInfo) { return this.http.put<unknown>(`${this.base}/me/emergency`, { consent: true, info }); }
  deleteEmergencyCard() { return this.http.delete<void>(`${this.base}/me/emergency`); }

  // ---- Local news ----
  news(pos: [number, number] | null) {
    const params: Record<string, number> = pos ? { lat: +pos[0].toFixed(3), lng: +pos[1].toFixed(3) } : {};
    return this.http.get<News>(`${this.base}/news`, { params });
  }

  // ---- Push ----
  pushKey() { return this.http.get<{ enabled: boolean; publicKey: string }>(`${this.base}/push/public-key`); }
  pushSubscribe(sub: PushSubscriptionJSON) { return this.http.post<void>(`${this.base}/push/subscribe`, sub); }
  pushUnsubscribe(endpoint: string) { return this.http.post<void>(`${this.base}/push/unsubscribe`, { endpoint }); }
}
