---
name: link-goals-and-todos
description: Use when the user asks to link a task to a goal, says a task "is for" / "is toward" a goal, asks "what am I doing on goal X?", "show me progress on goal Y", "which tasks are part of <goal>?", or wants a goal's open / completed task breakdown. Connects tasks to a goal and surfaces the resulting progress.
tools:
  - list_goals
  - get_goal
  - list_pages
  - get_page
  - link_task_to_goal
  - unlink_task_from_goal
  - list_tasks_for_goal
  - create_task
  - update_task
---

# Link goals and todos

## When to invoke
- "Link this to my goal about X"
- "This task is for the <goal name> goal"
- "What am I doing toward <goal>?"
- "Show me progress on <goal>"
- "Which tasks are part of <goal>?"
- "Unlink that task from the goal"
- "Create a task for the <goal name> goal: …" (combines create_task + link_task_to_goal)

## Resolve the goal first
- If the user names a goal, call `list_goals` and pick the best title match (case-insensitive substring is fine). If two or more match, ask which one.
- If no goal is named and the user said "my goal" / "the goal", call `list_goals`. If there's exactly one active goal, use it. Otherwise ask which.
- Never invent a goal id. If `list_goals` returns nothing, offer to create one with `create_goal`.

## Resolve the task(s)
- If the user references a task on the active page, prefer that. The active page is already in your system context — pull the task id from there.
- If the user references a task on a different page, call `list_pages` then `get_page` for the relevant one.
- For bulk-link requests ("link all the open API tasks to that goal"), get the page, filter open tasks by their text, list candidates back to the user, and only call `link_task_to_goal` once they confirm.

## Linking
- `link_task_to_goal(page_id, task_id, goal_id)` for each task. Idempotent — relinking is safe.
- After linking 1–3 tasks, confirm in one short sentence and quote the task text (not ids). E.g. _"Linked 'Draft RIMES PR' to **Automate 100 roles**."_
- For bulk operations (4+), say how many were linked and summarise by page.

## Surfacing progress
- For "what am I doing toward X?" / "progress on X?": call `list_tasks_for_goal(goal_id)` once. The response already groups by open vs completed and includes pages, due dates, and pinned state — don't re-query unless the user asks for detail.
- Format:
  - One line summary: _"<N> open, <M> completed for **<goal title>**."_
  - **Open** — short bulleted list. Lead with overdue / due-this-week / pinned. Cap at ~7; collapse the rest into a "+N more" line.
  - **Completed** — only show if the user asked for completed or asked for "progress". Cap at ~5 most recent.
  - End with one suggestion when it's useful (e.g. "Want me to draft the next step?"). Skip if the picture is already clear.

## Unlinking
- `unlink_task_from_goal(page_id, task_id)` — confirm in one line after.
- If the user says "unlink everything from <goal>", get the list first via `list_tasks_for_goal`, then call unlink per task. Don't silently nuke links — confirm the count before doing it.

## Style
- Plain prose. Never dump task ids or goal ids at the user.
- Quote task text in quotes; quote goal title in bold.
- If nothing is linked yet to the goal, say so and offer one concrete next step (e.g. "Want me to scan your open tasks and suggest links?").

## Don't
- Don't link archived tasks. Don't link to archived goals — the tool errors and you should re-pick.
- Don't bulk-link without confirming the candidate list first.
- Don't write the linkage into goal `body` text — the link lives on the task, not the goal.
