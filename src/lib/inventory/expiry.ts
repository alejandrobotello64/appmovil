export type ExpiryBucket = "caducado" | "30" | "60" | "90" | "180";

export const EXPIRY_BUCKETS: { id: ExpiryBucket; label: string; maxDays: number }[] = [
  { id: "caducado", label: "Caducados", maxDays: -1 },
  { id: "30", label: "≤ 30 días", maxDays: 30 },
  { id: "60", label: "≤ 60 días", maxDays: 60 },
  { id: "90", label: "≤ 90 días", maxDays: 90 },
  { id: "180", label: "≤ 180 días", maxDays: 180 },
];

export function daysUntilExpiry(isoDate: string): number | null {
  if (!isoDate) return null;
  const expiry = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
}

export function expiryBucket(days: number): ExpiryBucket | null {
  if (days < 0) return "caducado";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  if (days <= 90) return "90";
  if (days <= 180) return "180";
  return null;
}
