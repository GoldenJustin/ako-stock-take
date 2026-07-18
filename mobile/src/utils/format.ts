export function formatQty(n: number | null | undefined, digits = 3): string {
  const v = Number(n ?? 0);
  if (Number.isNaN(v)) return '0';
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatMoney(n: number | null | undefined, currency?: string): string {
  const v = Number(n ?? 0);
  try {
    return v.toLocaleString(undefined, {
      style: currency ? 'currency' : 'decimal',
      currency: currency || undefined,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return v.toFixed(2);
  }
}

export function varianceColor(variance: number): string {
  if (variance > 0) return '#059669';
  if (variance < 0) return '#DC2626';
  return '#64748B';
}

export function statusColor(status: string): string {
  switch (status) {
    case 'In Progress':
      return '#D97706';
    case 'Submitted':
      return '#059669';
    case 'Cancelled':
      return '#DC2626';
    case 'Closed':
      return '#475569';
    default:
      return '#2563EB';
  }
}

export function calcVariance(physical: number, actual: number): number {
  return Number(physical || 0) - Number(actual || 0);
}
