# Scheduled enhancement run log

Newest entries on top.

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
