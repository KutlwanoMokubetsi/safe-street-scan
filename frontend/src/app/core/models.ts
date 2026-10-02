export type Role = 'USER' | 'MODERATOR' | 'ADMIN';
export type ReportStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type CrimeType =
  | 'ASSAULT' | 'ROBBERY' | 'HIJACKING' | 'BURGLARY' | 'THEFT'
  | 'DRUG_RELATED' | 'FRAUD' | 'VANDALISM' | 'SUSPICIOUS_ACTIVITY' | 'OTHER';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  role: Role;
  friendCode: string;
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

// ---- Friends, live location, panic ----

export interface Person { userId: string; name: string; phone?: string; }
export interface FriendEntry { friendshipId: string; person: Person; since: string; }
export interface FriendsOverview {
  myCode: string;
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
}

export type ShareReason = 'MANUAL' | 'PANIC';

export interface Share {
  id: string;
  reason: ShareReason;
  startedAt: string;
  expiresAt?: string;
  viewerIds: string[];
}

export interface LiveFriend {
  userId: string;
  name: string;
  phone?: string;
  reason: ShareReason;
  expiresAt?: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  updatedAt?: string;
}

export interface Alert {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  status: 'ACTIVE' | 'RESOLVED';
  message?: string;
  createdAt: string;
  resolvedAt?: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  locationUpdatedAt?: string;
}

export interface Live {
  sharing: boolean;
  myShare?: Share;
  myAlert?: Alert;
  friends: LiveFriend[];
  alerts: Alert[];
}
