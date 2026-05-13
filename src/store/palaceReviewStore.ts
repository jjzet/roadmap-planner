import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { supabase } from '../lib/supabase';
import type { PalaceReview, ReviewQuality } from '../types';

// SM-2-lite scoring. ease and interval are clamped to keep things sane.
const EASE_MIN = 1.3;
const EASE_MAX = 3.0;
const DEFAULT_EASE = 2.5;
const DEFAULT_INTERVAL_DAYS = 1;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function score(
  prev: { ease: number; interval_days: number } | null,
  quality: ReviewQuality,
): { ease: number; interval_days: number } {
  const ease = prev?.ease ?? DEFAULT_EASE;
  const interval = prev?.interval_days ?? DEFAULT_INTERVAL_DAYS;
  if (quality === 'hard') {
    return {
      ease: clamp(ease - 0.15, EASE_MIN, EASE_MAX),
      interval_days: 1,
    };
  }
  if (quality === 'good') {
    return {
      ease,
      interval_days: Math.max(1, Math.round(interval * ease)),
    };
  }
  // easy
  return {
    ease: clamp(ease + 0.1, EASE_MIN, EASE_MAX),
    interval_days: Math.max(1, Math.round(interval * ease * 1.5)),
  };
}

function addDays(iso: string, days: number): string {
  const t = new Date(iso).getTime() + days * 86400 * 1000;
  return new Date(t).toISOString();
}

interface PalaceReviewStore {
  // Keyed by `${palace_id}:${object_id}` for O(1) lookup.
  reviews: Record<string, PalaceReview>;
  isLoading: boolean;

  fetchReviews: () => Promise<void>;
  recordReview: (palaceId: string, objectId: string, quality: ReviewQuality) => Promise<void>;
  removeReviewsForObject: (palaceId: string, objectId: string) => Promise<void>;
}

function key(palaceId: string, objectId: string): string {
  return `${palaceId}:${objectId}`;
}

export const usePalaceReviewStore = create<PalaceReviewStore>()(
  immer((set, get) => ({
    reviews: {},
    isLoading: false,

    fetchReviews: async () => {
      set({ isLoading: true });
      const { data, error } = await supabase.from('palace_reviews').select('*');
      if (error) {
        // Table may not exist yet (migration unapplied). Stay silent in UI but log.
        console.warn('palace_reviews fetch failed (migration applied?):', error.message);
        set({ isLoading: false });
        return;
      }
      const rows = (data ?? []) as PalaceReview[];
      set((s) => {
        s.reviews = {};
        for (const r of rows) s.reviews[key(r.palace_id, r.object_id)] = r;
        s.isLoading = false;
      });
    },

    recordReview: async (palaceId, objectId, quality) => {
      const k = key(palaceId, objectId);
      const prev = get().reviews[k] ?? null;
      const next = score(prev, quality);
      const now = new Date().toISOString();
      const nextDue = addDays(now, next.interval_days);
      const payload = {
        palace_id: palaceId,
        object_id: objectId,
        last_seen: now,
        next_due: nextDue,
        ease: next.ease,
        interval_days: next.interval_days,
        updated_at: now,
      };
      const { data, error } = await supabase
        .from('palace_reviews')
        .upsert(payload, { onConflict: 'palace_id,object_id' })
        .select('*')
        .single();
      if (error || !data) {
        console.error('palace_reviews upsert failed:', error);
        return;
      }
      const row = data as PalaceReview;
      set((s) => {
        s.reviews[k] = row;
      });
    },

    removeReviewsForObject: async (palaceId, objectId) => {
      const k = key(palaceId, objectId);
      const { error } = await supabase
        .from('palace_reviews')
        .delete()
        .eq('palace_id', palaceId)
        .eq('object_id', objectId);
      if (error) {
        console.warn('palace_reviews delete failed:', error.message);
        return;
      }
      set((s) => {
        delete s.reviews[k];
      });
    },
  })),
);

// Helpers consumed by views. Kept outside the store so they're pure and don't
// pollute the store API.

export function reviewKey(palaceId: string, objectId: string): string {
  return key(palaceId, objectId);
}

export type DueState = 'overdue' | 'today' | 'soon' | 'fresh' | 'unreviewed';

export function dueState(review: PalaceReview | null | undefined, now: Date = new Date()): DueState {
  if (!review) return 'unreviewed';
  const due = new Date(review.next_due);
  const startOfTomorrow = new Date(now);
  startOfTomorrow.setHours(24, 0, 0, 0);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (due < startOfToday) return 'overdue';
  if (due < startOfTomorrow) return 'today';
  if (due.getTime() - now.getTime() < 3 * 86400_000) return 'soon';
  return 'fresh';
}

export function isDue(review: PalaceReview | null | undefined, now: Date = new Date()): boolean {
  const s = dueState(review, now);
  return s === 'overdue' || s === 'today' || s === 'unreviewed';
}
