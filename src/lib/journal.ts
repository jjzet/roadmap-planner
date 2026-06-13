export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function computeStreak(
  entries: Record<string, { forward: string; blockers: string; tomorrow: string }>
): number {
  let streak = 0;
  const cursor = new Date();
  // A streak survives until you miss a full day — today being unwritten yet doesn't break it.
  if (!entries[localDateStr(cursor)]) cursor.setDate(cursor.getDate() - 1);
  while (entries[localDateStr(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
