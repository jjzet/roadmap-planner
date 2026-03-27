import { COLUMN_WIDTH_WEEK, COLUMN_WIDTH_MONTH } from './constants';
import type { ZoomLevel } from '../types';

// ── Basic date helpers ──

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function diffInDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** Get the Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

// ── Coordinate conversion ──

export function dateToX(date: Date, origin: Date, zoom: ZoomLevel): number {
  if (zoom === 'week') {
    const days = diffInDays(date, origin);
    return (days / 7) * COLUMN_WIDTH_WEEK;
  } else {
    // month zoom — proportional within months
    const monthsDiff =
      (date.getFullYear() - origin.getFullYear()) * 12 +
      (date.getMonth() - origin.getMonth());
    const dayInMonth = date.getDate() - 1;
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return (monthsDiff + dayInMonth / daysInMonth) * COLUMN_WIDTH_MONTH;
  }
}

export function xToDate(x: number, origin: Date, zoom: ZoomLevel): Date {
  if (zoom === 'week') {
    const days = (x / COLUMN_WIDTH_WEEK) * 7;
    return addDays(origin, Math.round(days));
  } else {
    const months = x / COLUMN_WIDTH_MONTH;
    const wholeMonths = Math.floor(months);
    const frac = months - wholeMonths;
    const targetMonth = new Date(origin.getFullYear(), origin.getMonth() + wholeMonths, 1);
    const daysInMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    const day = Math.round(frac * daysInMonth);
    return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1 + day);
  }
}

// ── Column generation ──

export interface TimelineColumn {
  label: string;
  sublabel?: string;
  x: number;
  width: number;
  date: Date;
  /** 0-based month index (0=Jan, 11=Dec) — used for month-based column shading */
  month: number;
}

export function generateWeekColumns(start: Date, end: Date, origin: Date): TimelineColumn[] {
  const cols: TimelineColumn[] = [];
  let current = startOfWeek(start);
  const endTime = end.getTime();
  while (current.getTime() <= endTime) {
    const x = dateToX(current, origin, 'week');
    const d = current.getDate();
    const m = current.toLocaleString('en', { month: 'short' });
    cols.push({
      label: `${d} ${m}`,
      x,
      width: COLUMN_WIDTH_WEEK,
      date: new Date(current),
      month: current.getMonth(),
    });
    current = addDays(current, 7);
  }
  return cols;
}

export function generateMonthColumns(start: Date, end: Date, origin: Date): TimelineColumn[] {
  const cols: TimelineColumn[] = [];
  let current = startOfMonth(start);
  while (current.getTime() <= end.getTime()) {
    const x = dateToX(current, origin, 'month');
    const m = current.toLocaleString('en', { month: 'short' });
    const y = current.getFullYear();
    const q = Math.floor(current.getMonth() / 3) + 1;
    cols.push({
      label: m,
      sublabel: `Q${q} ${y}`,
      x,
      width: COLUMN_WIDTH_MONTH,
      date: new Date(current),
      month: current.getMonth(),
    });
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  return cols;
}

// ── Formatting ──

export function formatDateDisplay(s: string): string {
  const d = parseDate(s);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function durationInWeeks(start: string, end: string): number {
  return Math.round(diffInDays(parseDate(end), parseDate(start)) / 7);
}

// ── Smart due-date parsing ──

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const FULL_MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const FULL_DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Parse a natural-language date expression into an ISO date string (YYYY-MM-DD).
 * Returns null if the input cannot be parsed.
 *
 * Supported formats:
 *   today / tod
 *   tomorrow / tom
 *   mon / monday (next occurrence of weekday)
 *   +3 / +3d  (relative days)
 *   +1w       (relative weeks)
 *   +2m       (relative months)
 *   mar 30 / march 30 / 30 mar
 *   30        (day of current/next month)
 *   2026-04-15 (ISO passthrough)
 */
export function parseDateExpression(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (s === 'today' || s === 'tod') return formatDate(today);
  if (s === 'tomorrow' || s === 'tom') return formatDate(addDays(today, 1));

  // +Nd or +N
  const relDays = s.match(/^\+(\d+)d?$/);
  if (relDays) return formatDate(addDays(today, parseInt(relDays[1])));

  // +Nw
  const relWeeks = s.match(/^\+(\d+)w$/);
  if (relWeeks) return formatDate(addDays(today, parseInt(relWeeks[1]) * 7));

  // +Nm
  const relMonths = s.match(/^\+(\d+)m$/);
  if (relMonths) {
    const d = new Date(today);
    d.setMonth(d.getMonth() + parseInt(relMonths[1]));
    return formatDate(d);
  }

  // Weekday: mon, tue, monday, tuesday, etc.
  const shortDay = DAY_NAMES.indexOf(s.slice(0, 3));
  const fullDay = FULL_DAY_NAMES.indexOf(s);
  const dayIdx = shortDay !== -1 ? shortDay : fullDay;
  if (dayIdx !== -1) {
    const todayDay = today.getDay();
    let daysUntil = dayIdx - todayDay;
    if (daysUntil <= 0) daysUntil += 7;
    return formatDate(addDays(today, daysUntil));
  }

  // "mar 30" or "march 30"
  const monthFirst = s.match(/^([a-z]+)\s+(\d{1,2})$/);
  if (monthFirst) {
    const mIdx = resolveMonth(monthFirst[1]);
    if (mIdx !== -1) {
      const day = parseInt(monthFirst[2]);
      return nextOccurrenceOfMonthDay(today, mIdx, day);
    }
  }

  // "30 mar" or "30 march"
  const dayFirst = s.match(/^(\d{1,2})\s+([a-z]+)$/);
  if (dayFirst) {
    const mIdx = resolveMonth(dayFirst[2]);
    if (mIdx !== -1) {
      const day = parseInt(dayFirst[1]);
      return nextOccurrenceOfMonthDay(today, mIdx, day);
    }
  }

  // Day of month only: "30" → 30th of current or next month
  const domOnly = s.match(/^(\d{1,2})$/);
  if (domOnly) {
    const day = parseInt(domOnly[1]);
    if (day >= 1 && day <= 31) {
      let candidate = new Date(today.getFullYear(), today.getMonth(), day);
      if (candidate <= today) {
        candidate = new Date(today.getFullYear(), today.getMonth() + 1, day);
      }
      return formatDate(candidate);
    }
  }

  // ISO passthrough: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  return null;
}

function resolveMonth(name: string): number {
  const short = MONTH_NAMES.indexOf(name.slice(0, 3));
  if (short !== -1) return short;
  return FULL_MONTH_NAMES.indexOf(name);
}

function nextOccurrenceOfMonthDay(today: Date, monthIdx: number, day: number): string {
  let year = today.getFullYear();
  const candidate = new Date(year, monthIdx, day);
  if (candidate <= today) year++;
  return formatDate(new Date(year, monthIdx, day));
}

/** Format an ISO date string as a human-readable preview, e.g. "Fri, Apr 3" */
export function formatDatePreview(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Format an ISO timestamp as a relative time string, e.g. "2h ago", "just now" */
export function formatRelativeTime(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}
