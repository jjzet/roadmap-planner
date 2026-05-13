import { useEffect, useMemo, useState } from 'react';
import { X, ChevronRight, Footprints, Compass, Sparkles } from 'lucide-react';
import type { MemoryPalaceRecord, PalaceObject, ReviewQuality } from '@/types';
import { PalaceMap } from './PalaceMap';
import { PixelSprite } from './PixelSprite';
import { usePalaceReviewStore, reviewKey, dueState, isDue } from '@/store/palaceReviewStore';

interface PalaceWalkProps {
  palace: MemoryPalaceRecord;
  onExit: () => void;
}

// Canonical walk path — Method of Loci is sequential. Sort objects by their
// owning room's array order (rooms hold the canonical order of the palace),
// then within a room by (y, x) so the walk runs row-by-row through each room.
// Roomless objects come last in tile order.
function canonicalOrder(palace: MemoryPalaceRecord): PalaceObject[] {
  const roomIndex = new Map(palace.data.rooms.map((r, i) => [r.id, i]));
  return [...palace.data.objects].sort((a, b) => {
    const ai = a.roomId ? (roomIndex.get(a.roomId) ?? 9999) : 9999;
    const bi = b.roomId ? (roomIndex.get(b.roomId) ?? 9999) : 9999;
    if (ai !== bi) return ai - bi;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
}

export function PalaceWalk({ palace, onExit }: PalaceWalkProps) {
  const ordered = useMemo(() => canonicalOrder(palace), [palace]);

  // Start the avatar on the first object in canonical order — or, if the
  // palace is empty, on the centre of the first room, or on the map centre.
  const start = useMemo(() => {
    if (ordered[0]) return { x: ordered[0].x, y: ordered[0].y };
    const r = palace.data.rooms[0];
    if (r) {
      return {
        x: r.x + Math.floor(r.width / 2),
        y: r.y + Math.floor(r.height / 2),
      };
    }
    return {
      x: Math.floor(palace.data.width / 2),
      y: Math.floor(palace.data.height / 2),
    };
  }, [ordered, palace.data.rooms, palace.data.width, palace.data.height]);

  // `start` is captured on mount only. Parent passes a `key` that changes when
  // the user switches palaces, which remounts this component and resets `pos`.
  const [pos, setPos] = useState(start);

  // Keyboard movement — clamp to map bounds. Esc exits walk mode.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't hijack arrow keys while user is typing in an input.
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          dy = -1; break;
        case 'ArrowDown':
        case 's':
        case 'S':
          dy = 1; break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          dx = -1; break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          dx = 1; break;
        case 'Escape':
          e.preventDefault();
          onExit();
          return;
        default:
          return;
      }
      e.preventDefault();
      setPos((p) => ({
        x: Math.max(0, Math.min(palace.data.width - 1, p.x + dx)),
        y: Math.max(0, Math.min(palace.data.height - 1, p.y + dy)),
      }));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [palace.data.width, palace.data.height, onExit]);

  const standingOn = palace.data.objects.find((o) => o.x === pos.x && o.y === pos.y) ?? null;
  const standingRoom = palace.data.rooms.find(
    (r) => pos.x >= r.x && pos.x < r.x + r.width && pos.y >= r.y && pos.y < r.y + r.height,
  );

  const reviews = usePalaceReviewStore((s) => s.reviews);
  const recordReview = usePalaceReviewStore((s) => s.recordReview);
  const currentReview = standingOn ? reviews[reviewKey(palace.id, standingOn.id)] ?? null : null;

  // Snapshot "now" once per mount so render stays pure. Good enough for a
  // walk session that lasts seconds-to-minutes, not days.
  const [nowMs] = useState(() => Date.now());

  // Loci that are due now (or unreviewed). Drives the dashed amber rings on
  // the map so the user knows what to walk to without scanning the panel.
  const dueObjectIds = useMemo(() => {
    const now = new Date(nowMs);
    const set = new Set<string>();
    for (const o of palace.data.objects) {
      const r = reviews[reviewKey(palace.id, o.id)] ?? null;
      if (isDue(r, now)) set.add(o.id);
    }
    return set;
  }, [palace.id, palace.data.objects, reviews, nowMs]);

  const goNext = () => {
    if (!ordered.length) return;
    // Find the next object in canonical order after the current position. If
    // the avatar isn't currently on any object, snap to the first one.
    const i = standingOn ? ordered.findIndex((o) => o.id === standingOn.id) : -1;
    const next = ordered[(i + 1) % ordered.length];
    setPos({ x: next.x, y: next.y });
  };

  const goNextDue = () => {
    if (dueObjectIds.size === 0) return;
    // Walk the canonical order starting just after the current locus, return
    // to the first due item we find. Wraps around.
    const startIdx = standingOn ? ordered.findIndex((o) => o.id === standingOn.id) : -1;
    for (let step = 1; step <= ordered.length; step++) {
      const cand = ordered[(startIdx + step + ordered.length) % ordered.length];
      if (dueObjectIds.has(cand.id)) {
        setPos({ x: cand.x, y: cand.y });
        return;
      }
    }
  };

  const handleReview = (q: ReviewQuality) => {
    if (!standingOn) return;
    void recordReview(palace.id, standingOn.id, q);
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-100/60">
      <div className="flex items-start gap-4 p-6 min-w-max">
        <div>
          <PalaceMap
            data={palace.data}
            theme={palace.theme}
            selectedObjectId={null}
            onSelectObject={() => {}}
            walkAvatar={pos}
            dueObjectIds={dueObjectIds}
          />
          <div className="mt-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-gray-500">
            <span className="flex items-center gap-1">
              <Footprints className="w-3 h-3" /> Walking
            </span>
            <span>
              ({pos.x}, {pos.y})
            </span>
            {standingRoom && (
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-sm"
                  style={{ background: standingRoom.color }}
                />
                {standingRoom.name}
              </span>
            )}
            <span className="text-gray-400">arrows / wasd · esc to exit</span>
          </div>
        </div>

        <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-md shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 h-9 border-b border-gray-100 bg-gradient-to-r from-white to-cyan-50/30">
            <div className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-cyan-600" />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-700 font-semibold">
                Walk-through
              </span>
            </div>
            <button
              onClick={onExit}
              className="text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer p-1"
              title="Exit walk mode (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {standingOn ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <PixelSprite icon={standingOn.icon} color={standingOn.color} size={20} />
                  <p className="text-[13px] font-mono text-gray-800 font-semibold truncate">
                    {standingOn.name}
                  </p>
                </div>
                <DueBadge review={currentReview} nowMs={nowMs} />
                <p className="mt-2 text-[12px] font-mono font-light text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {standingOn.content || (
                    <span className="text-gray-400 italic">No memory recorded yet.</span>
                  )}
                </p>
                {standingOn.link && (
                  <a
                    href={standingOn.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-[11px] font-mono text-cyan-600 hover:text-cyan-700 underline truncate max-w-full"
                  >
                    {standingOn.link}
                  </a>
                )}
                <div className="mt-4">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1.5">
                    How well did you recall it?
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <ReviewButton label="Hard"  tone="rose"   onClick={() => handleReview('hard')} />
                    <ReviewButton label="OK"    tone="cyan"   onClick={() => handleReview('good')} />
                    <ReviewButton label="Easy"  tone="emerald" onClick={() => handleReview('easy')} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-[11px] font-mono font-light text-gray-400 leading-relaxed">
                  {ordered.length === 0
                    ? 'No memories placed yet. Exit walk mode to add some.'
                    : 'Walk to a memory tile to reveal it. Tap Next to jump along the canonical path.'}
                </p>
              </div>
            )}
          </div>

          {ordered.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-2 flex flex-col gap-1.5">
              <button
                onClick={goNext}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-cyan-700 hover:text-cyan-900 bg-white border border-cyan-200 hover:border-cyan-400 hover:bg-cyan-50/40 rounded py-1.5 cursor-pointer transition-colors"
                title="Jump to next memory in canonical order"
              >
                Next memory
                <ChevronRight className="w-3 h-3" />
              </button>
              {dueObjectIds.size > 0 && (
                <button
                  onClick={goNextDue}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-amber-700 hover:text-amber-900 bg-white border border-amber-200 hover:border-amber-400 hover:bg-amber-50/40 rounded py-1.5 cursor-pointer transition-colors"
                  title="Jump to the next memory that's due for review"
                >
                  <Sparkles className="w-3 h-3" />
                  Next due ({dueObjectIds.size})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DueBadge({
  review, nowMs,
}: {
  review: import('@/types').PalaceReview | null;
  nowMs: number;
}) {
  const state = dueState(review, new Date(nowMs));
  const STYLES: Record<typeof state, { label: string; cls: string }> = {
    overdue:    { label: 'Overdue',    cls: 'text-rose-700 bg-rose-50 border-rose-200' },
    today:      { label: 'Due today',  cls: 'text-amber-700 bg-amber-50 border-amber-200' },
    soon:       { label: 'Due soon',   cls: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
    fresh:      { label: 'Fresh',      cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    unreviewed: { label: 'Unreviewed', cls: 'text-gray-600 bg-gray-50 border-gray-200' },
  };
  const s = STYLES[state];
  let suffix = '';
  if (review) {
    const days = Math.round((new Date(review.next_due).getTime() - nowMs) / 86400_000);
    if (state === 'fresh' || state === 'soon') suffix = ` · ${days}d`;
    else if (state === 'overdue') suffix = ` · ${Math.abs(days)}d ago`;
  }
  return (
    <span
      className={`inline-block text-[9px] font-mono uppercase tracking-[0.18em] border rounded-full px-2 py-0.5 ${s.cls}`}
    >
      {s.label}{suffix}
    </span>
  );
}

function ReviewButton({
  label, tone, onClick,
}: {
  label: string;
  tone: 'rose' | 'cyan' | 'emerald';
  onClick: () => void;
}) {
  const TONES = {
    rose:    'text-rose-700 border-rose-200 hover:border-rose-400 hover:bg-rose-50/40',
    cyan:    'text-cyan-700 border-cyan-200 hover:border-cyan-400 hover:bg-cyan-50/40',
    emerald: 'text-emerald-700 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/40',
  } as const;
  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-mono uppercase tracking-wider bg-white border rounded py-1.5 cursor-pointer transition-colors ${TONES[tone]}`}
    >
      {label}
    </button>
  );
}
