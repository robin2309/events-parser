/**
 * Date and timezone utilities
 */

/**
 * Parse ISO date string to Date object
 */
export function parseIsoDate(isoString: string): Date | null {
  try {
    const date = new Date(isoString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Format Date to ISO string
 */
export function toIsoString(date: Date): string {
  return date.toISOString();
}

/**
 * Validate IANA timezone string (basic check)
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current date in a specific timezone
 */
export function nowInTimezone(tz: string): string {
  return new Date().toLocaleString('en-US', { timeZone: tz });
}
