const STREAK_KEY = 'palace-review-streak';

// Day-granularity streak: reviewing on consecutive days extends it, a gap
// resets to 1, multiple sessions in one day keep the current value.
export function bumpStreak(): number {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    const prev = raw ? (JSON.parse(raw) as { last: string; streak: number }) : null;
    let streak = 1;
    if (prev?.last === today) streak = prev.streak;
    else if (prev?.last === yesterday) streak = prev.streak + 1;
    localStorage.setItem(STREAK_KEY, JSON.stringify({ last: today, streak }));
    return streak;
  } catch {
    return 1;
  }
}
