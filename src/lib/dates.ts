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
