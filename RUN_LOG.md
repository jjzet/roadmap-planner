# Scheduled enhancement run log

Newest entries on top.

---

## 2026-05-15 — Skills #2: link-goals-and-todos

- **Branch:** `claude/modest-edison-LJOLj` (session-pinned, per bootstrap instructions).
- **Commit SHA:** `1fc0143`.
- **PR:** _not opened — guardrail says do not auto-merge; awaiting user._
- **Deploy needed:** `supabase functions deploy chat` so the new tools and skill ship to prod.

### Signal observed
- Supabase: 1 goal ("Automate the roles of 100 people using AI agents"), untouched since 2026-04-09. 3 active task pages — "ToDo" (last touched 2026-05-06), "Test Sub Page", "Handover Items". 0 journal entries. 0 palaces (the one from earlier runs has been deleted).
- Recent `ai_messages` (sequences 10–29 inspected) — every tool call was a task / page operation (`get_page`, `update_task`, `create_task`). The agent drafted a substantial 7-item handover email but never had a way to express "this task is toward goal X" in the data layer, even though the user has both goals and tasks live.
- Holiday caveat noted — anchoring on the user's standing request from the previous RUN_LOG entry's "Suggested next step" rather than on raw volumes.

### What shipped
Second Agent Skill on top of the pattern established yesterday: **`link-goals-and-todos`**. Tasks can now be linked to a goal, and the agent can answer "what am I doing toward goal X?" with one call.

- **New folder: `supabase/functions/chat/skills/link-goals-and-todos/SKILL.md`**
  - YAML frontmatter (`name`, `description`, `tools`). Trigger covers "link this to my goal", "is for the X goal", "what am I doing toward X", "progress on X", "which tasks are part of X", "unlink it from the goal".
  - Body covers: resolve the goal (substring match, ask if ambiguous, never invent ids); resolve the task (prefer active page); linking (single + bulk, idempotent, confirm in plain English); surfacing progress (cap lists, group by open / completed); unlinking (always confirm bulk counts); style + don'ts.
- **`src/types/index.ts`** — additive `goalId?: string` on `TodoItem`. No migration: `todo_lists.data` is jsonb.
- **`supabase/functions/chat/index.ts`** — additive only:
  - New tools `link_task_to_goal`, `unlink_task_from_goal`, `list_tasks_for_goal`.
    - `link_task_to_goal` validates that the goal exists and is not archived before saving.
    - `list_tasks_for_goal` scans `todo_lists.data`, returns `{ goal, counts: {open, completed, total}, open[], completed[] }`. `open[]` carries `due` + `pinned` so the assistant can lead with overdue / due-this-week / pinned per the skill body.
  - `create_task` and `update_task` accept optional `goal_id` (empty string on update unlinks).
  - `serializePage` now emits `goal: <id>` in the inline meta block so the assistant can see existing links when reading a page.
  - System prompt advertises the new tool family; `SKILL_SLUGS` registry adds `link-goals-and-todos` (auto-rendered in the `─── REGISTERED SKILLS ───` block).
  - `TASK_MUTATIONS` updated so the client's chat hook refreshes `todo_lists` after a link/unlink — keeping the new goal badge in sync without a page reload.
- **`src/components/todo/TodoItemRow.tsx`** — small amber goal badge using `lucide-react/Target`, shown next to the existing due-date / link badges when `item.goalId` resolves. Click → navigates to the Goals view. On row hover, a tiny × appears for inline unlink. Truncates at 180px and uses the same amber palette as `GoalCardBlock` for consistency.

### Why this was the right next step
- Direct execution of the prior run's logged "Suggested next step". The Skills pattern needed a second consumer to prove the registry / progressive-disclosure split (system prompt advertises the trigger; assistant calls `load_skill`); shipping the second one now closes that loop.
- One stale goal + many open tasks is the canonical place a "what am I doing on this goal?" answer pays off. Without a link, the agent had no way to answer it except by reading prose.
- Schema is purely additive (jsonb field on existing data — no migration). No tool was renamed or removed. The chat hook's mutated-domain refresh logic continues to work because both new write tools are in the `tasks` domain.

### Verification
- `npm run build`: clean (`tsc -b && vite build`). Existing chunk-size warning unchanged.
- `npm run lint`: 34 problems before and after — count unchanged. The 2 pre-existing errors in `supabase/functions/chat/index.ts` (`nextSeq` const, one `any` in the handler) are untouched. Lint on touched UI files (`TodoItemRow.tsx`, `types/index.ts`, `goalStore.ts`) is clean.
- YAML frontmatter parser test: both `draft-review` and `link-goals-and-todos` parse correctly through the same regex the chat function uses — `name`, multi-line `description`, body separated.
- Live Supabase round-trip test (now deleted): inserted a throwaway page with one task, PATCHed the task's `goalId` into the existing goal id, read it back — `goalId` field preserved exactly. Then cleaned up.

### Deliberately deferred
- **Per-Skill tool gating at runtime** — `SKILL.md` declares a `tools:` list, but the loader still hands the full tool set to the model. Worth implementing only when a Skill needs to *restrict* access; the two Skills today share most of their tool surface, so the cost outweighs the value.
- **Surface linked tasks on the Goal card / Goal view** — today, link visibility flows from the task → goal direction (badge on `TodoItemRow`). The reverse direction (a list of linked tasks under each goal in `GoalsView`, or a count badge on `GoalCardBlock`) is the natural next polish — left for a future run because it touches GoalsView layout and the small surface today is enough to validate the link concept.
- **Suggested-link surface in the UI** — the agent can propose links via chat; a UI affordance ("link this task to a goal" inline) would speed that up. Deferred to keep this run scoped to the agent side.
- **Edge function deploy** — code is committed; running `supabase functions deploy chat` requires the user's local Supabase CLI auth (same as previous run).
- **Model bump** — chat still on `claude-opus-4-6`; not touched.

### Suggested next step
The reverse direction. With the link now real on the task side, the natural follow-up is surfacing a goal's task progress in the **Goals view**: a small "N tasks linked · M complete" footer on each `GoalCard`, plus an expand-to-list affordance. That uses the same `list_tasks_for_goal` data path the agent now consumes, so the Skill and the UI share one source of truth.

---

## 2026-05-14 — Agent Skills pattern + draft-review capability

- **Branch:** `claude/affectionate-cori-DFQQX` (session-pinned, per bootstrap instructions).
- **Commit SHA:** `a7fb15f`.
- **PR:** _not opened — guardrail says do not auto-merge; awaiting user._
- **Deploy needed:** `supabase functions deploy chat` so the new tools and skill loader ship to prod.

### Signal observed
- `ai_messages` (30 rows): only 4 tool calls in recent history — all task-related (`create_task`, `update_task`, `get_page`, `list_pages`). Goal / journal / palace tools are present but not invoked by the user.
- Journal: 0 entries ever — no friction to surface from prose.
- Goals: 1 goal, untouched since 2026-04-09.
- Palaces: 1 palace, 2 rooms, 2 memories, 0 reviews.
- Daily insights: 28 generated; agent has never been asked to recap them.
- Five consecutive runs landed on Memory Palaces. Spec's Priority 1 (agent action capability) hadn't been touched since the original April expansion, and "Draft daily / weekly review summaries" — one of the four explicit Priority 1 capabilities — had **no** tool today.

### What shipped
Established the **Anthropic Agent Skills pattern** in the in-app agent and shipped the first Skill: `draft-review`.

- **New folder: `supabase/functions/chat/skills/draft-review/SKILL.md`**
  - YAML frontmatter (`name`, `description`, `tools`). Description is written as a trigger ("Use when the user asks for a daily review, weekly review, recap…").
  - Body is the full procedure: when to invoke, which window to pick, which tools to call in what order, drafting structure (Shipped / In flight / Themes / Goal progress / Worth remembering / One thing next), style rules, and a "persist on request only" rule.
- **`supabase/functions/chat/index.ts`** — additive only:
  - Skill loader at cold-start: `Deno.readTextFile` over the `skills/<slug>/SKILL.md` files listed in `SKILL_SLUGS`. Parses YAML frontmatter (name + multi-line description), keeps the body separate.
  - New tool `load_skill(name)` — progressive disclosure. The system prompt only advertises the trigger; the assistant must call `load_skill` once it matches a request, then follow the procedure.
  - New tool `get_review_context(days_back?)` — one call returns the whole picture for a review draft:
    - tasks: `completed` snapshot, `pinned` (open), `overdue`, `due_in_window`
    - `journal` entries in `[start, end]`
    - `goals_updated` with `updated_at >= start`
    - `insights` (daily insights with concept + lesson) in window
    - `palaces_touched` (memory_palaces with `updated_at` in window) plus current room/memory counts
    - All lists capped at 50; `days_back` clamped to `[1, 30]`; default 7.
  - System prompt:
    - New bullets advertising `get_review_context` and `load_skill`.
    - New `─── REGISTERED SKILLS ───` block rendered at request time from the loaded `SKILLS` registry — adding a new skill folder + slug auto-surfaces it; no further prompt edits.

### Why this was the right next step
- Priority 1 capability with zero tool coverage today. The other three (create/edit/complete tasks, summarise journal by date range, link goals to todos) either already work or have an empty input domain (0 journal entries).
- Pattern enables future runs: each new capability lands as one folder + one tool, with the system prompt updating itself from the loaded registry.
- Non-breaking: zero schema changes, no removed/renamed tools, no client changes needed (the new tools are server-side; the chat hook's mutated-domain refresh logic is unaffected — `get_review_context` and `load_skill` are read-only).

### Verification
- `npm run build` (tsc -b && vite build): clean. Existing bundle-size warning unchanged.
- `npm run lint`: same 34 problems before and after my changes. Lint on `supabase/functions/chat/index.ts` alone: same 2 pre-existing errors (`nextSeq` const, one `any` in the handler) — neither introduced by this run.
- YAML frontmatter parser tested against the new SKILL.md: extracts `name` and the full multi-line `description` correctly, stopping at the next top-level YAML key (`tools:`).
- Live Supabase smoke test of every read query `get_review_context` issues (journal range, goals updated_at, insights range, palaces updated_at): all four returned valid responses against the 7-day window.

### Deliberately deferred
- **Edge function deploy** — code is committed; running `supabase functions deploy chat` is a single step but requires the user's local Supabase CLI auth. Surfaced explicitly above. Until then, the new tools live in source only.
- **More Skills** — `draft-review` is the first. The next obvious candidates: `summarise-journal-themes` (waits for journal entries to exist), `link-goal-to-todo` (needs an additive `goalId?: string` field on TodoItem), `palace-locus-suggestion` (Memory Palaces spec step 8). All deferrable to future runs.
- **Per-Skill tool gating** — `SKILL.md` frontmatter lists `tools:` but the runtime doesn't yet narrow the tool list when a skill is loaded. The single-skill case doesn't need it; once a second skill ships, the loader can return a filtered tool subset alongside the body.
- **Anthropic SDK / model bump** — model still `claude-opus-4-6`; leaving alone to keep this run scoped to the Skills pattern.
- **Frontend surfacing of Skills** — no UI today; the assistant invokes them transparently. Surfacing a "/draft-review" command in the chat input is a follow-up.

### Suggested next step
With one Skill landed and the pattern proved out, the highest-signal Priority 1 capability still missing is **link-goal-to-todo**. The user has one stale goal and todo IDs that never reference it. Concrete next-run scope:
1. Additive `goalId?: string` on `TodoItem` (no migration — `todo_lists.data` is jsonb).
2. Two tools: `link_task_to_goal(page_id, task_id, goal_id)` and `list_tasks_for_goal(goal_id)`.
3. New Skill `link-goals-and-todos/SKILL.md` describing when to suggest a link.
4. Optional: a small badge in `TodoItemRow` showing the linked goal title.

---

## 2026-05-13 — Memory Palaces: type-picker for legacy rooms

- **Branch:** `claude/festive-sagan-dpB1B`.
- **Commit SHA:** `4535883`.
- **PR:** _not opened._

### Signal
User reported: every room's Add Memory list was showing the same four items (Note / Item / Marker / Gem). Root cause — those are `FALLBACK_OBJECTS`, surfaced for any room with no `kind` field. Their existing room "Change Hut" was created before the presets landed so has no kind, and the fallback list is by definition shared across all kind-less rooms.

### What shipped
- `AddMemoryMenu` now branches by whether the room has a kind:
  - **Has kind:** unchanged — show the room-specific object list.
  - **No kind:** show a **Set "<room name>" type** picker listing the room kinds for the palace theme. Picking one calls `updateRoom` to commit `kind` + `color` to the room (the user's chosen name like "Change Hut" is preserved). The next click on Add Memory then shows that room's own object set.
- Submenu trigger for a kind-less room shows a small amber "no type" pill so the affordance is obvious before you click in.
- `FALLBACK_OBJECTS` remains as a defensive fallback inside `objectsForRoomKind`, but no longer reaches a user — a kind-less room can't get into the object picker at all.

### Verification
- `tsc -b` clean.
- `eslint` on touched files clean.
- `vite build` clean.

---

## 2026-05-13 — Memory Palaces: room-unique object presets

- **Branch:** `claude/festive-sagan-dpB1B`.
- **Commit SHA:** `af6368e`.
- **PR:** _not opened._

### What changed
Per user feedback, every object kind must belong to exactly one room — no cross-room sharing. Three duplicates existed in the previous preset registry:
- `banner` was in **throne-room** and **tower** → renamed to **Royal Banner** (`royal-banner`) and **Tower Pennant** (`tower-pennant`).
- `lantern` was in **pier** and **bridge** → renamed to **Pier Lantern** (`pier-lantern`) and **Bridge Lantern** (`bridge-lantern`).
- `treasure-chest` was in **cove** and **treasure-vault** → cove's renamed to **Pirate's Chest** (`pirates-chest`); treasure-vault keeps `treasure-chest`.

Also added a module-load integrity check in `presets.ts` that scans `ROOM_OBJECTS`, warns to the browser console if any object kind id appears in more than one room. Catches the same mistake the next time someone edits the registry.

### Verification
- `tsc -b` clean.
- `eslint src/components/palace` clean.
- `vite build` clean.
- Re-ran the `grep -oE "id: '[a-z-]+'"` and `grep -oE "name: '[^']+'"` audits over `presets.ts` — zero duplicates remain.

---

## 2026-05-13 — Memory Palaces: theme-aligned presets + label fix

- **Branch:** `claude/festive-sagan-dpB1B`.
- **Commit SHA:** `8b0764b`.
- **PR:** _not opened._

### Tweaks shipped
1. **Room label clipping fixed.** The label was hard-clipped by a foreignObject sized to the room width; now rendered as a centered pill inside a 300px-wide overflow-visible foreignObject anchored on the room's centre, so the name reads even when the room is narrow.
2. **Free-form room/object creation removed.** Replaced both `window.prompt` flows with `DropdownMenu` pickers:
   - **Add room** — lists fixed rooms per palace theme (e.g. Castle → Throne Room / Armoury / Dungeon / Grain Store / Kitchen / Library / Tower / Courtyard). Existing kinds in the palace get an `×N` counter.
   - **Add memory** — lists rooms; for each room, a submenu lists the objects that belong in that room kind (e.g. Armoury → Weapon Rack / Shield Stand / Helmet / Arms Chest). When the palace has a single room, the menu flattens to a one-level list. Disabled when there are no rooms.
3. Schema is additive — added optional `kind?: string` to `PalaceRoom` and `PalaceObject`. Existing rooms with no `kind` fall back to a small generic object preset (Note / Item / Marker / Gem) so legacy data still works.

### Files touched
- `src/components/palace/presets.ts` (new) — `THEME_ROOMS`, `ROOM_OBJECTS`, `FALLBACK_OBJECTS`, `objectsForRoomKind`.
- `src/types/index.ts` — `kind?` on PalaceRoom + PalaceObject.
- `src/components/palace/PalaceMap.tsx` — overflow-safe centered room label.
- `src/components/views/PalacesView.tsx` — new `AddRoomMenu`, `AddMemoryMenu`, `FlatRoomObjects` components; old `ToolbarButton` removed.

### Verification
- `tsc -b` clean.
- `eslint` on `src/components/palace` + `PalacesView.tsx` clean.
- `vite build` clean.
- Supabase smoke test (now deleted): created a palace, wrote a room with `kind: 'armoury'` and an object with `kind: 'weapon-rack'`, read it back — both `kind` fields roundtripped intact.

### Deferred
- **PNG sidebar icon** for Palaces (still using `Castle` Lucide icon).
- **Renaming presets / extending the registry from the UI** — by design, presets are the source of truth.

---

## 2026-05-13 — Memory Palaces: wire core feature into sidebar (correction)

- **Branch:** `claude/festive-sagan-dpB1B`.
- **Commit SHA:** `863115b`.
- **PR:** _not opened._

### Why this entry exists
User clarification mid-session: the earlier "memory palace" merge into `main` had been deleted because it was missing a previous icon-update merge. The two prior entries in this log (walk-through, spaced repetition) were shipped on top of palace code that *exists on this branch* (`src/components/palace/*`, `src/store/palaceStore.ts`, `supabase/migrations/006_memory_palaces.sql`, `PalacesView` already rendered for `activeView === 'palaces'`) **but was unreachable from the UI** — no sidebar entry. So from the user's perspective the feature was not implemented. The log overstated completion.

### What shipped this entry
- Added a **Palaces** entry to the primary nav in `AppSidebar` (Castle Lucide icon, cyan accent matching the recent direction). One click navigates to `PalacesView`.

### What's already on the branch and now reachable
- Schema (`006_memory_palaces.sql`) — applied in Supabase (verified via smoke test).
- `palaceStore` — `fetchPalaces`, `createPalace`, `renamePalace`, `setTheme`, `deletePalace`, `addRoom`, `updateRoom`, `removeRoom`, `addObject`, `updateObject`, `removeObject`.
- `PalacesView` — sidebar list, create palace, theme switch, add room, add memory, delete.
- `PalaceMap` — 24×16 tile grid, themed two-tone checker floor, room rectangles with name pill, 8-bit pixel object sprites.
- `ObjectEditor` — name, memory content, link, icon picker, colour picker, x/y position.

### Verified end-to-end against Supabase
Smoke test (now deleted) performed: insert a `memory_palaces` row → add a room → add an object → read back → cleanup. All four operations returned no error and the roundtrip showed 1 room + 1 object.

```
CREATED {"id":"c38c1de5-…","name":"SMOKE TEST","theme":"overworld"}
ROOM ADDED   {"roomId":"34f12e8d-…"}
OBJECT ADDED {"objId":"3389155a-…"}
ROUNDTRIP    {"rooms":1,"objects":1}
CLEANED UP
```

### Limitations + deferred
- Sidebar icon is a Lucide `Castle` rather than a hand-drawn PNG to match the other sidebar items. Visually it's distinct from the cartoon icons — a proper PNG is a small follow-up, not a blocker.
- Room editing today is "add a named room, auto-positioned" — no walls/doors yet (spec build-order step 4 is partial). Loci placement works without walls; this is on the next-run shortlist.
- Walk-through (step 6) and spaced-repetition surface (step 7) ship in this branch but assume the user has at least one palace + a few loci to exercise.

### Next step
With the core feature reachable and exercised: actually use it for a few days, then look at step 4 (proper room walls + doors) or step 8 (agent integration) based on which friction shows up first.

---

## 2026-05-13 — Memory Palaces: spaced repetition surface

- **Branch:** `claude/festive-sagan-dpB1B` (session-pinned, same as previous run).
- **Commit SHA:** `8b53562`
- **PR:** _not opened — guardrail says do not auto-merge; awaiting user._
- **Migration to apply:** run `supabase/migrations/007_palace_reviews.sql` in the Supabase SQL editor before using the review surface.

### Signal observed
- Same-session note from the user: the prior memory-palace builds were undone on their side, and they asked to keep advancing the feature per the run spec. The code on this branch still has steps 1–6 (schema, list, canvas, rooms, loci, walk-through), so the next incomplete step is **step 7 — spaced repetition**.

### What shipped
Build-order step **7 — Spaced repetition surface**.
- **Migration `007_palace_reviews.sql`** — new `palace_reviews(palace_id, object_id, last_seen, next_due, ease, interval_days)` table, FK to `memory_palaces(id) ON DELETE CASCADE`, unique `(palace_id, object_id)`, indexed on `next_due` and `palace_id`. RLS anon_all in line with the rest of the app. **Additive only — no destructive change.**
- **`palaceReviewStore`** — SM-2-lite scoring (Hard / OK / Easy). Hard resets interval to 1d and shaves ease; OK multiplies interval by ease; Easy multiplies by `ease × 1.5` and adds ease. Ease clamped to [1.3, 3.0]. Reviews keyed by `${palace_id}:${object_id}` for O(1) lookups. Helpers `dueState()` and `isDue()` exported for views. **Fetch failures are non-fatal** so the app keeps working even before the migration is applied to Supabase.
- **Walk mode (`PalaceWalk`)**:
  - Due-state badge in the side panel (Overdue / Due today / Due soon / Fresh / Unreviewed) with relative-day suffix.
  - Three review buttons (Hard / OK / Easy) — colour-coded rose / cyan / emerald to match the rest of the palette.
  - Second toolbar action **Next due** that jumps along the canonical path to the next locus that's due, with a live count.
- **`PalaceMap`**: optional `dueObjectIds` set — due loci get an amber dot in their corner so the user can spot them at a glance without scanning the side panel.
- **Palace sidebar (`PalaceListItem`)**: an amber `N due` pill on any palace that has work waiting, so the entry point to a review session is one click from anywhere.
- **`palaceStore.removeObject`** now best-effort-deletes the review row when its locus is deleted, so orphans don't accumulate (the FK's cascade also handles this on palace delete).
- **`usePalaceReviewLoader`** fires on app mount alongside the other store loaders.

### Why this was the right next step
- Method of Loci without spacing is just placement — recall decays. Spacing is the principle that turns a one-time encoding into durable memory; without it the prior steps don't pay off.
- Additive schema, no breaking changes, no migrations to existing data.
- Walk-through (shipped previously) is the natural surface for review actions — no new view needed.

### Deliberately deferred
- **Today-view "due today" strip** — the palace sidebar badge is the lightweight version. A dedicated strip on Today is the next obvious surface but lives in a different view's data context; cut to keep this run scoped.
- **Auto-pulse animation on due dots** — kept static for now; CSS-only pulse can land as part of the next aesthetic polish run.
- **Configurable review intervals / scheduler tuning** — SM-2-lite defaults are fine for v1; instrument once we have data.
- **Step 8 — agent integration** (locus suggestion + vivid mnemonic prompting) — depends on having review data to draw on; one more run of usage first.
- **Vivid-association prompt at capture time** — design principle from the spec; should land with step 8 since both touch the locus-creation flow.

### Suggested next step
**Step 8 — Agent integration.** With a `palace_reviews` table in place, the agent can:
1. Read review state to surface "what's due in your palaces" inside the Today briefing or chat.
2. Propose a locus + vivid mnemonic when the user asks to remember something new (uses room contents + existing loci as context).
3. Mark reviewed via the agent (`record_palace_review` tool).

### Verification
- `tsc -b`: clean.
- `vite build`: clean (existing chunk-size warning unchanged).
- `eslint` on all touched files: clean. The 30 pre-existing repo-wide errors (unrelated files) are untouched.
- No destructive schema changes. Migration is `IF NOT EXISTS`-guarded; the store tolerates the table being absent until applied.

---

## 2026-05-13 — Memory Palaces: walk-through mode

- **Branch:** `claude/festive-sagan-dpB1B` (session-pinned; convention deviates from `auto/YYYY-MM-DD-<slug>` because the bootstrap instructions explicitly disallow pushing to a different branch — noted for future runs).
- **Commit SHA:** `fab0901`
- **PR:** _not opened — guardrail says do not auto-merge; awaiting user._

### Signal observed
- Supabase: one memory palace exists ("MEMORIES", beach theme, 24×16) but contains **0 rooms and 0 objects** — the user opened the feature and named a palace, then stopped. Journal entries: 0 in last 7 days (and 0 ever). AI agent tool usage centred on todo actions (`create_task`, `update_task`, `list_pages`).
- Read: nothing to read in journal — that itself is the signal.

### What shipped
Build-order step **6 — Walk-through mode** for Memory Palaces.
- New `HeroSprite` — 8×8 pixel-art top-down hero, cyan-accent default, matches recent UI direction.
- `PalaceMap` accepts an optional `walkAvatar` tile coord and renders the hero on top of objects with a dashed yellow ring on the loci the avatar is standing on.
- New `PalaceWalk` component: keyboard movement (arrows + WASD), Esc to exit, map-bound clamping, side panel that reveals the memory under the avatar (name + content + optional link), and a **Next memory** button that jumps along a canonical order (room order, then row-major within room) — the Method-of-Loci sequence the spec calls for.
- `PalacesView` toolbar gains a Walk toggle; edit-only buttons hide while walking.

### Why this was the smallest useful next step
- The palace exists but is empty — the user has no payoff from the feature yet. Walk-through is the moment loci-style recall *clicks*; even a 2-item palace becomes worth filling.
- Step 6 is the next incomplete item in the spec's build order.
- No schema changes, no store mutations, no new dependencies. State is local to the walk component.

### Deliberately deferred
- **Room walls / door collision** — rooms in the data model are coloured rectangles, not walled enclosures. Avatar is currently free-roaming inside the map. Adding wall collision needs a richer room shape (step 4 expansion) and would have doubled the diff.
- **Touch / swipe input on mobile** — keyboard-only this run. Most palace work today is desktop; the cost/value didn't warrant a gesture layer yet.
- **Spaced repetition (step 7)** — needs a `review` table and a "due today" surface; deferred to the next run.
- **Agent suggests a locus + mnemonic at capture (step 8)** — depends on step 7's review signal being useful; deferred.
- **Vivid-association prompt at capture time** — design principle from the spec; should land alongside the agent integration.
- **Facing direction on the avatar** — kept the hero direction-agnostic for v1 to avoid 4 sprite variants for marginal value.

### Suggested next step
**Step 7 — Spaced repetition surface.** Add a `palace_reviews` table (additive schema: `id`, `object_id` FK, `last_seen`, `next_due`, `ease`, `interval_days`, timestamps). Surface a "Memories due today" strip on the Today view, and let walk-through mode mark items as reviewed (decrement next-due via a simple SM-2-lite). That gives the AI agent something to draft a daily review around in the run after that.

### Verification
- `tsc -b`: clean.
- `vite build`: clean (existing bundle-size warning unchanged).
- `eslint src/components/palace src/components/views/PalacesView.tsx`: clean. Repo-wide eslint has 31 pre-existing errors in unrelated files (`useTodayData.ts`, `supabase/functions/chat/index.ts`) — not touched.
- No data migrations, no breaking changes.
