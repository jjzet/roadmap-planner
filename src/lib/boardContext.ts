import { useTodoStore } from '@/store/todoStore';
import { useGoalStore } from '@/store/goalStore';
import { useJournalStore } from '@/store/journalStore';
import { stripHtml } from '@/lib/utils';
import type { BoardPersona } from '@/components/board/personas';
import type { DashboardData } from '@/hooks/useDashboardData';

function trim(s: string, max: number): string {
  const clean = stripHtml(s).replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

/**
 * One context pack shared by every board member: who the user is, where they
 * say they're heading (goals), what the work looks like right now, and how
 * the journal reads. Built fresh from live store state at ask time.
 */
export function buildBoardContext(dashboard: DashboardData | null): string {
  const goals = useGoalStore.getState().goals.filter((g) => !g.archived);
  const entries = useJournalStore.getState().entries;
  const todoList = useTodoStore.getState().todoList;

  const lines: string[] = [];

  lines.push('## Who they are');
  lines.push(
    'A senior technical leader in financial services (investment data platforms), recently relocated to London. Builds product tooling on the side. Uses this app daily to run their work and life.'
  );

  if (goals.length > 0) {
    lines.push('\n## Their stated goals (verbatim, where they say they are heading)');
    for (const g of goals.slice(0, 8)) {
      lines.push(`- ${g.title}${g.body ? ` — ${trim(g.body, 350)}` : ''}`);
    }
  }

  if (dashboard) {
    lines.push('\n## Work state right now');
    lines.push(`- Cleared all-time: ${dashboard.completedTasks}/${dashboard.totalTasks}`);
    const v = dashboard.velocity.daily;
    lines.push(`- Velocity: ${v.current} cleared in the last 7 days vs ${v.previous} the prior 7`);
    if (dashboard.overdue.length > 0) {
      lines.push(`- Overdue (${dashboard.overdue.length}): ${dashboard.overdue.slice(0, 5).map((t) => `"${trim(t.item.text, 70)}" (due ${t.item.dueDate})`).join('; ')}`);
    }
    if (dashboard.dueToday.length > 0) {
      lines.push(`- Due today: ${dashboard.dueToday.slice(0, 5).map((t) => `"${trim(t.item.text, 70)}"`).join('; ')}`);
    }
    if (dashboard.pinnedItems.length > 0) {
      lines.push(`- Pinned: ${dashboard.pinnedItems.slice(0, 5).map((t) => `"${trim(t.item.text, 70)}"`).join('; ')}`);
    }
    const topGroups = dashboard.groupHealth.slice(0, 6);
    if (topGroups.length > 0) {
      lines.push(`- Active fronts: ${topGroups.map((g) => `${g.name} (${g.completed}/${g.total}${g.overdue ? `, ${g.overdue} overdue` : ''})`).join('; ')}`);
    }
  }

  lines.push(`\n## Pages they keep: ${todoList.filter((t) => !t.parentId).map((t) => t.name).join(', ')}`);

  const recent = Object.values(entries)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  if (recent.length > 0) {
    lines.push('\n## Recent journal entries (their own words — newest first)');
    for (const e of recent) {
      const parts: string[] = [];
      if (e.forward) parts.push(`moved forward: ${trim(e.forward, 240)}`);
      if (e.blockers) parts.push(`in the way: ${trim(e.blockers, 240)}`);
      if (e.tomorrow) parts.push(`tomorrow: ${trim(e.tomorrow, 160)}`);
      if (parts.length) lines.push(`- ${e.date}: ${parts.join(' | ')}`);
    }
  }

  return lines.join('\n');
}

export function buildPersonaSystem(persona: BoardPersona, context: string): string {
  return `You are "${persona.name}" (${persona.role}) on the user's personal board of directors inside Orbit, their daily work tool.

${persona.charter}

House rules for every board member:
- Eyes up: orient to the future version of them and the path there. Reference today's data only as evidence of trajectory, never as nagging bookkeeping.
- Don't anchor on any single data point; weigh the whole picture.
- Speak directly to them ("you"), in plain confident language. No corporate filler, no bullet-point essays, no emoji, no sycophancy.
- Be concrete: name the item, the goal, the move. One sharp observation beats three soft ones.

${context}`;
}
