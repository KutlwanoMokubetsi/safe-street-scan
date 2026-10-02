import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Bounds, Hotspot, NewReport, Report, ReportStatus, Stats, User, Role } from './models';

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
}
