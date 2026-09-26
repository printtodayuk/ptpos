/**
 * London Timezone Utilities (Europe/London: GMT/BST)
 * Print Today UK operates on London local time.
 */

export const LONDON_TIMEZONE = 'Europe/London';

/**
 * Returns 'YYYY-MM-DD' representing the calendar date in Europe/London.
 */
export function getLondonDateString(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Returns a formatted date-time string in London time: 'dd/MM/yyyy HH:mm'.
 */
export function formatLondonDateTime(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Returns current London time details (hour, minute, second, dateStr).
 */
export function getLondonTimeParts(date: Date | string = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateStr: string;
  isPast2359: boolean;
} {
  const d = typeof date === 'string' ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const dateStr = getLondonDateString(d);

  // Consider past 23:59 if hour === 23 and minute === 59
  const isPast2359 = hour === 23 && minute === 59;

  return { year, month, day, hour, minute, second, dateStr, isPast2359 };
}

/**
 * Returns a Date object representing the current London calendar day (at midday to avoid UTC date-boundary shifts).
 */
export function getLondonCurrentDate(): Date {
  const dateStr = getLondonDateString(new Date());
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Checks if two dates fall on the same calendar day in Europe/London.
 */
export function isSameLondonDay(dateA: Date | string, dateB: Date | string): boolean {
  return getLondonDateString(dateA) === getLondonDateString(dateB);
}
