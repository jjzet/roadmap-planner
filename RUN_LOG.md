# Scheduled enhancement run log

Newest entries on top.

---

## 2026-05-13 — Memory Palaces: theme-aligned presets + label fix

- **Branch:** `claude/festive-sagan-dpB1B`.
- **Commit SHA:** _filled in by commit_.
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
