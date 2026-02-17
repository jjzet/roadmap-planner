import { startOfWeek, addDays, diffInDays } from '../lib/dates';

/** Snap a date to the nearest Monday (week boundary). */
export function snapToWeek(date: Date): Date {
  const monday = startOfWeek(date);
  const nextMonday = addDays(monday, 7);
  const diffToCurrent = Math.abs(diffInDays(date, monday));
  const diffToNext = Math.abs(diffInDays(date, nextMonday));
  return diffToCurrent <= diffToNext ? monday : nextMonday;
}
