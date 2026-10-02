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
  hasHome: boolean;
  alertRadiusM: number;
  avatarUrl?: string;
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
  source?: 'USER' | 'NEWS';
  sourceUrl?: string;
  sourceName?: string;
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
  peakHours?: string;
  trend?: 'RISING' | 'STEADY' | 'FALLING';
  generatedAt: string;
}

export interface NewsItem { title: string; url: string; source: string; publishedAt?: string; }
export interface News { area: string; items: NewsItem[]; }

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

export interface Person { userId: string; name: string; phone?: string; avatarUrl?: string; }
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
  checkinDueAt?: string;
}

export interface LiveFriend {
  userId: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
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
  emergency?: EmergencyInfo;
}

export interface Live {
  sharing: boolean;
  myShare?: Share;
  myAlert?: Alert;
  friends: LiveFriend[];
  alerts: Alert[];
}

export interface CommentItem {
  id: string; author: string; role?: 'REPORTER'; body: string; createdAt: string;
  mine: boolean; flaggedByMe: boolean; hidden: boolean;
}
export interface Suggestion {
  id: string; title: string; url: string; sourceDomain?: string; publishedAt?: string; area?: string;
  crimeType: CrimeType; confidence: number; placeName: string; latitude: number; longitude: number;
  precisionM: number; corroborations: number; otherSources: string[]; status: string;
}

export interface RouteOption {
  kind: 'SAFER' | 'FASTEST' | 'SAFE_AND_FAST';
  distanceM: number; durationS: number; path: [number, number][];
  exposureScore: number; metresInHotspots: number; hotspotsPassed: string[];
}
export interface RoutePlan { routes: RouteOption[]; provider: string; }
export interface PlaceResult { name: string; detail: string; lat: number; lng: number; }
export interface EmergencyInfo {
  bloodType?: string; allergies?: string; medications?: string; conditions?: string; medicalAid?: string;
  medicalAidNumber?: string; contactName?: string; contactPhone?: string; contactRelation?: string; notes?: string;
}
