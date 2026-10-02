import { CrimeType } from './models';

export const CRIME_TYPES: { value: CrimeType; label: string; color: string }[] = [
  { value: 'ROBBERY', label: 'Robbery', color: '#C0392B' },
  { value: 'HIJACKING', label: 'Hijacking', color: '#A31F34' },
  { value: 'ASSAULT', label: 'Assault', color: '#D9480F' },
  { value: 'BURGLARY', label: 'Burglary / break-in', color: '#7B4FA0' },
  { value: 'THEFT', label: 'Theft', color: '#D9822B' },
  { value: 'DRUG_RELATED', label: 'Drug-related', color: '#3F5BA9' },
  { value: 'FRAUD', label: 'Fraud / scam', color: '#B5487A' },
  { value: 'VANDALISM', label: 'Vandalism', color: '#8A7A2B' },
  { value: 'SUSPICIOUS_ACTIVITY', label: 'Suspicious activity', color: '#2C7A8C' },
  { value: 'OTHER', label: 'Other', color: '#5E6873' },
];

const byValue = new Map(CRIME_TYPES.map(t => [t.value, t]));

export const crimeLabel = (t?: CrimeType) => (t && byValue.get(t)?.label) || 'Other';
export const crimeColor = (t?: CrimeType) => (t && byValue.get(t)?.color) || '#5E6873';

export function riskLevel(score: number): { label: string; color: string } {
  if (score >= 0.75) return { label: 'Very high', color: '#C0392B' };
  if (score >= 0.5) return { label: 'High', color: '#D9480F' };
  if (score >= 0.25) return { label: 'Moderate', color: '#D9822B' };
  return { label: 'Low', color: '#2E7D5B' };
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Three severity groups keep the map readable; the full type is shown in the detail card. */
export type Severity = 'violent' | 'property' | 'other';
export const SEVERITY: Record<Severity, { label: string; color: string }> = {
  violent: { label: 'Violent', color: '#C0392B' },
  property: { label: 'Property', color: '#D9822B' },
  other: { label: 'Other', color: '#5E6873' },
};
export function severityOf(t: CrimeType): Severity {
  if (t === 'ASSAULT' || t === 'ROBBERY' || t === 'HIJACKING') return 'violent';
  if (t === 'BURGLARY' || t === 'THEFT' || t === 'VANDALISM' || t === 'FRAUD') return 'property';
  return 'other';
}
