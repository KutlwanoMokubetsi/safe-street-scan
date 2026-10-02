export type Role = 'USER' | 'MODERATOR' | 'ADMIN';
export type ReportStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type CrimeType =
  | 'ASSAULT' | 'ROBBERY' | 'HIJACKING' | 'BURGLARY' | 'THEFT'
  | 'DRUG_RELATED' | 'FRAUD' | 'VANDALISM' | 'SUSPICIOUS_ACTIVITY' | 'OTHER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Report {
  id: string;
  crimeType: CrimeType;
  description: string;
  locationName?: string;
  latitude: number;
  longitude: number;
  occurredAt: string;
  status: ReportStatus;
  createdAt: string;
  mine: boolean;
}

export interface NewReport {
  crimeType: CrimeType;
  description: string;
  locationName?: string;
  latitude: number;
  longitude: number;
  occurredAt: string;
}

export interface Hotspot {
  id: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  intensityScore: number;
  crimeCount: number;
  topCrimeType?: CrimeType;
  generatedAt: string;
}

export interface Stats {
  totalReports: number;
  verifiedReports: number;
  pendingReports: number;
  reportsLast7Days: number;
  activeHotspots: number;
}

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}
