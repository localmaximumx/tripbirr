/**
 * Formats integer minor units (cents) into currency string.
 * Example: 5000 -> "ETB 50.00"
 */
export function formatMinorUnits(
  minorUnits: number | null | undefined,
  currencyLabel: 'ETB' | 'Birr' = 'ETB'
): string {
  if (minorUnits === null || minorUnits === undefined || Number.isNaN(minorUnits)) {
    return `${currencyLabel} 0.00`;
  }
  const isNegative = minorUnits < 0;
  const absMinor = Math.abs(Math.round(minorUnits));
  const major = Math.floor(absMinor / 100);
  const cents = absMinor % 100;

  const formattedMajor = major.toLocaleString('en-US');
  const formattedCents = String(cents).padStart(2, '0');
  const sign = isNegative ? '-' : '';

  return `${sign}${currencyLabel} ${formattedMajor}.${formattedCents}`;
}

/**
 * Formats trip duration in seconds into human-readable string.
 * Example: 1980 -> "33m", 4200 -> "1h 10m"
 */
export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) {
    return '—';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const totalMins = Math.round(seconds / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) {
    return `${mins}m`;
  }
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Formats an ISO UTC string into local HH:mm time.
 */
export function formatIsoToShortTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return isoString;
  }
}

/**
 * Formats an ISO UTC string into readable date + time.
 */
export function formatIsoToDateAndTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day}/${month}/${year} · ${time}`;
  } catch {
    return isoString;
  }
}
