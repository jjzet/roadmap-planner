---
name: draft-review
description: Use when the user asks for a daily review, weekly review, recap, retrospective, "what did I ship this week", "where am I against my goals", or "what's been blocking me". Pulls task / journal / goal / palace activity into a single drafted summary.
tools:
  - get_review_context
  - list_recent_journal_entries
  - list_goals
  - get_today_briefing
---

# Draft Review

## When to invoke
- "Give me a weekly review" / "Recap this week"
- "What did I ship?" / "What got done?"
- "Where am I against my goals?"
- "What's been blocking me lately?"
- "Daily review please" / "How did today go?"

## Procedure
1. Pick a window:
   - "daily" / "today" → `days_back: 1`
   - "weekly" / no qualifier → `days_back: 7`
   - "monthly" → `days_back: 30`
2. Call `get_review_context` with that window. That single call returns tasks (completed / pinned / overdue / due-soon), journal entries, recently-updated goals, recent daily insights, and palaces touched in the window. Prefer it over chaining multiple read tools — it deduplicates the work.
3. If `get_review_context` returns an empty journal section and the user asked specifically about reflections / blockers, fall back to `list_recent_journal_entries` to be sure.
4. Draft prose, structured as:
   - **Shipped** — the substantive completed tasks. Group by page when ≥3 from the same page.
   - **In flight / blocked** — pinned + overdue. Tie to journal blockers when a pattern repeats.
   - **Journal themes** — 2–3 recurring patterns across forward / blockers / tomorrow. Quote sparingly.
   - **Goal progress** — one line per goal updated in window.
   - **Worth remembering** — palaces updated, plus one insight from `recent_insights` if it earns the space.
   - **One thing next** — your read on the highest-leverage next move, drawn from blockers + pinned + tomorrow notes.

## Style
- Plain English. No emoji. No headed bullet walls.
- Short paragraphs. Bullets only inside Shipped / In flight.
- Quote specific task text or journal phrases when it sharpens the point. Never dump IDs.
- If a section is empty, say so in one sentence and move on.
- Don't fabricate completions or journal content.

## Persist on request only
Only save the draft (e.g. via `upsert_journal_entry` with the summary in `forward`, or `update_goal` with `mode: "append"` for goal progress notes) if the user explicitly says "save it" / "log it" / "add it to today". Otherwise leave the draft in the chat.
