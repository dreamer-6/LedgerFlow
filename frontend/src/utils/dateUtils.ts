/**
 * dateUtils.ts — Authoritative date formatting and local date resolution for LedgerFlow.
 * Eliminates UTC timezone shifts, stale localStorage dates, and month index drift.
 */

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

/**
 * Returns today's actual local calendar date in strict YYYY-MM-DD format.
 * Avoids any UTC conversion drift.
 */
export function getLocalTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses any date (YYYY-MM-DD, ISO, or Date) without timezone shifting.
 * Returns display strings and structured date components.
 */
export function parseDateComponents(dateStr?: string | Date) {
  let y: number;
  let m: number; // 0-indexed
  let d: number;

  if (!dateStr) {
    const now = new Date();
    y = now.getFullYear();
    m = now.getMonth();
    d = now.getDate();
  } else if (dateStr instanceof Date) {
    y = dateStr.getFullYear();
    m = dateStr.getMonth();
    d = dateStr.getDate();
  } else if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      d = parseInt(parts[2], 10);
      if (isNaN(y) || isNaN(m) || isNaN(d) || m < 0 || m > 11) {
        const now = new Date();
        y = now.getFullYear();
        m = now.getMonth();
        d = now.getDate();
      }
    } else {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        const now = new Date();
        y = now.getFullYear();
        m = now.getMonth();
        d = now.getDate();
      } else {
        y = parsed.getFullYear();
        m = parsed.getMonth();
        d = parsed.getDate();
      }
    }
  } else {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      const now = new Date();
      y = now.getFullYear();
      m = now.getMonth();
      d = now.getDate();
    } else {
      y = parsed.getFullYear();
      m = parsed.getMonth();
      d = parsed.getDate();
    }
  }

  const dateObj = new Date(y, m, d);
  const dayOfWeek = DAYS_OF_WEEK[dateObj.getDay()];
  const monthAbbr = MONTHS_SHORT[m] || 'Oct';
  const isoDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dateFormatted = `${d} ${monthAbbr} ${y}`;

  return {
    year: y,
    month: m + 1,
    day: d,
    monthAbbr,
    dayOfWeek,
    dateFormatted,
    isoDate
  };
}

/**
 * Standard date display format: "13 Oct 2026"
 */
export function formatDateDisplay(dateStr?: string | Date): string {
  const { dateFormatted } = parseDateComponents(dateStr);
  return dateFormatted;
}

/**
 * Full date display with day of week: { dateFormatted: "13 Oct 2026", dayOfWeek: "Tuesday" }
 */
export function formatDateWithDay(dateStr?: string | Date) {
  const { dateFormatted, dayOfWeek, isoDate } = parseDateComponents(dateStr);
  return { dateFormatted, dayOfWeek, isoDate };
}
