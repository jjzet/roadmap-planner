import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, ChevronRight, Footprints, Compass, Sparkles, Eye, Flame, Trophy, Lightbulb,
} from 'lucide-react';
import type { MemoryPalaceRecord, PalaceObject, PalaceReview, ReviewQuality } from '@/types';
import { PalaceMap } from './PalaceMap';
import { PixelSprite } from './PixelSprite';
import { usePalaceReviewStore, reviewKey, dueState, isDue } from '@/store/palaceReviewStore';
import { bumpStreak } from './streak';

interface PalaceWalkProps {
  palace: MemoryPalaceRecord;
  onExit: () => void;
  // Start as a review session: queue up everything due, hide answers, and
  // auto-advance through the queue as the user grades each locus.
  startInReview?: boolean;
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

export function PalaceWalk({ palace, onExit, startInReview = false }: PalaceWalkProps) {
  const ordered = useMemo(() => canonicalOrder(palace), [palace]);

  const reviews = usePalaceReviewStore((s) => s.reviews);
  const recordReview = usePalaceReviewStore((s) => s.recordReview);

  // Snapshot "now" once per mount so render stays pure. Good enough for a
  // walk session that lasts seconds-to-minutes, not days.
  const [nowMs] = useState(() => Date.now());

  // Review queue is frozen at mount: everything due, in walk order. Grading
  // moves through this queue; the live `reviews` map keeps the rings honest.
  const [queue] = useState<string[]>(() => {
    if (!startInReview) return [];
    const now = new Date();
    const map = usePalaceReviewStore.getState().reviews;
    return canonicalOrder(palace)
      .filter((o) => isDue(map[reviewKey(palace.id, o.id)] ?? null, now))
      .map((o) => o.id);
  });
  const [gradedIds, setGradedIds] = useState<Set<string>>(() => new Set());
  const [tally, setTally] = useState({ hard: 0, good: 0, easy: 0 });
  const [finished, setFinished] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);
  const reviewing = startInReview && !finished;

  // Start the avatar on the first due locus (review), else the first object
  // in canonical order, else the centre of the first room / the map.
  const start = useMemo(() => {
    const firstDue = queue.length ? ordered.find((o) => o.id === queue[0]) : null;
    const target = firstDue ?? ordered[0];
    if (target) return { x: target.x, y: target.y };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `start` is captured on mount only. Parent passes a `key` that changes when
  // the user switches palaces, which remounts this component and resets `pos`.
  const [pos, setPos] = useState(start);

  // The recall gate: a locus's content stays hidden until the user reveals it.
  const [revealedId, setRevealedId] = useState<string | null>(null);

  const standingOn = palace.data.objects.find((o) => o.x === pos.x && o.y === pos.y) ?? null;
  const standingRoom = palace.data.rooms.find(
    (r) => pos.x >= r.x && pos.x < r.x + r.width && pos.y >= r.y && pos.y < r.y + r.height,
  );
  const revealed = standingOn != null && standingOn.id === revealedId;
  const currentReview = standingOn ? reviews[reviewKey(palace.id, standingOn.id)] ?? null : null;

  // Loci that are due now (or unreviewed). Drives the dashed amber rings on
  // the map so the user knows what to walk to without scanning the panel.
  const dueObjectIds = useMemo(() => {
    const now = new Date(nowMs);
    const set = new Set<string>();
    for (const o of palace.data.objects) {
      const r = reviews[reviewKey(palace.id, o.id)] ?? null;
      if (isDue(r, now) && !gradedIds.has(o.id)) set.add(o.id);
    }
    return set;
  }, [palace.id, palace.data.objects, reviews, nowMs, gradedIds]);

  const goNext = () => {
    if (!ordered.length) return;
    const i = standingOn ? ordered.findIndex((o) => o.id === standingOn.id) : -1;
    const next = ordered[(i + 1) % ordered.length];
    setPos({ x: next.x, y: next.y });
    setRevealedId(null);
  };

  const goNextDue = () => {
    if (dueObjectIds.size === 0) return;
    const startIdx = standingOn ? ordered.findIndex((o) => o.id === standingOn.id) : -1;
    for (let step = 1; step <= ordered.length; step++) {
      const cand = ordered[(startIdx + step + ordered.length) % ordered.length];
      if (dueObjectIds.has(cand.id)) {
        setPos({ x: cand.x, y: cand.y });
        setRevealedId(null);
        return;
      }
    }
  };

  const handleReveal = () => {
    if (standingOn) setRevealedId(standingOn.id);
  };

  const handleReview = (q: ReviewQuality) => {
    if (!standingOn || !revealed) return;
    void recordReview(palace.id, standingOn.id, q);
    setTally((t) => ({ ...t, [q]: t[q] + 1 }));
    const nextGraded = new Set(gradedIds);
    nextGraded.add(standingOn.id);
    setGradedIds(nextGraded);
    setRevealedId(null);

    if (!startInReview || finished) return;
    // Advance to the next ungraded locus in the session queue, or finish.
    const next = queue.find((id) => !nextGraded.has(id) && id !== standingOn.id);
    const nextObj = next ? ordered.find((o) => o.id === next) : null;
    if (nextObj) {
      setPos({ x: nextObj.x, y: nextObj.y });
    } else {
      setFinished(true);
      setStreak(bumpStreak());
    }
  };

  // Keep handlers fresh for the window key listener without re-binding it.
  const keysRef = useRef({ handleReveal, handleReview, goNextDue, onExit, revealed, standingOn });
  keysRef.current = { handleReveal, handleReview, goNextDue, onExit, revealed, standingOn };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't hijack keys while user is typing in an input.
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const k = keysRef.current;

      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': dy = -1; break;
        case 'ArrowDown': case 's': case 'S': dy = 1; break;
        case 'ArrowLeft': case 'a': case 'A': dx = -1; break;
        case 'ArrowRight': case 'd': case 'D': dx = 1; break;
        case ' ':
        case 'Enter':
          if (k.standingOn && !k.revealed) {
            e.preventDefault();
            k.handleReveal();
          }
          return;
        case '1':
          if (k.revealed) { e.preventDefault(); k.handleReview('hard'); }
          return;
        case '2':
          if (k.revealed) { e.preventDefault(); k.handleReview('good'); }
          return;
        case '3':
          if (k.revealed) { e.preventDefault(); k.handleReview('easy'); }
          return;
        case 'n': case 'N':
          e.preventDefault();
          k.goNextDue();
          return;
        case 'Escape':
          e.preventDefault();
          k.onExit();
          return;
        default:
          return;
      }
      e.preventDefault();
      setRevealedId(null);
      setPos((p) => ({
        x: Math.max(0, Math.min(palace.data.width - 1, p.x + dx)),
        y: Math.max(0, Math.min(palace.data.height - 1, p.y + dy)),
      }));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [palace.data.width, palace.data.height]);

  const gradedCount = queue.filter((id) => gradedIds.has(id)).length;

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
              <Footprints className="w-3 h-3" /> {reviewing ? 'Reviewing' : 'Walking'}
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
            <span className="text-gray-400">arrows · space reveal · 1/2/3 grade · esc exit</span>
          </div>
        </div>

        <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-md shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 h-9 border-b border-gray-100 bg-gradient-to-r from-white to-cyan-50/30">
            <div className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-cyan-600" />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-700 font-semibold">
                {startInReview ? 'Review session' : 'Walk-through'}
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

          {startInReview && queue.length > 0 && !finished && (
            <div className="px-3 pt-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                <span>Progress</span>
                <span>{gradedCount}/{queue.length}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all"
                  style={{ width: `${queue.length ? (gradedCount / queue.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {finished ? (
              <SessionSummary tally={tally} streak={streak} />
            ) : standingOn ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <PixelSprite icon={standingOn.icon} color={standingOn.color} size={20} />
                  <p className="text-[13px] font-mono text-gray-800 font-semibold truncate">
                    {standingOn.name}
                  </p>
                </div>
                <DueBadge review={currentReview} nowMs={nowMs} />

                {standingOn.imagery && (
                  <div className="mt-2.5 flex gap-1.5 bg-amber-50/70 border border-amber-100 rounded px-2 py-1.5">
                    <Lightbulb className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] font-mono font-light text-amber-900 leading-relaxed italic">
                      {standingOn.imagery}
                    </p>
                  </div>
                )}

                {revealed ? (
                  <>
                    <p className="mt-2.5 text-[12px] font-mono font-light text-gray-700 whitespace-pre-wrap leading-relaxed">
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
                        <ReviewButton label="Hard" hotkey="1" tone="rose" onClick={() => handleReview('hard')} />
                        <ReviewButton label="OK" hotkey="2" tone="cyan" onClick={() => handleReview('good')} />
                        <ReviewButton label="Easy" hotkey="3" tone="emerald" onClick={() => handleReview('easy')} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-4">
                    <p className="text-[11px] font-mono font-light text-gray-500 leading-relaxed">
                      Stand here a moment. What's stored at this locus? Say it
                      out loud, then check yourself.
                    </p>
                    <button
                      onClick={handleReveal}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white bg-cyan-600 hover:bg-cyan-700 border border-cyan-600 rounded py-2 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Reveal (space)
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-[11px] font-mono font-light text-gray-400 leading-relaxed">
                  {ordered.length === 0
                    ? 'No memories placed yet. Exit walk mode to add some.'
                    : 'Walk to a memory tile, recall what lives there, then reveal to check yourself.'}
                </p>
              </div>
            )}
          </div>

          {!finished && ordered.length > 0 && (
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
                  title="Jump to the next memory that's due for review (N)"
                >
                  <Sparkles className="w-3 h-3" />
                  Next due ({dueObjectIds.size})
                </button>
              )}
            </div>
          )}

          {finished && (
            <div className="border-t border-gray-100 px-3 py-2">
              <button
                onClick={onExit}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white bg-cyan-600 hover:bg-cyan-700 border border-cyan-600 rounded py-2 cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionSummary({
  tally, streak,
}: {
  tally: { hard: number; good: number; easy: number };
  streak: number | null;
}) {
  const total = tally.hard + tally.good + tally.easy;
  const solid = tally.good + tally.easy;
  const pct = total ? Math.round((solid / total) * 100) : 0;
  return (
    <div className="text-center py-2">
      <Trophy className="w-8 h-8 text-amber-400 mx-auto" />
      <p className="mt-2 text-[13px] font-mono font-semibold text-gray-800">
        Walk complete
      </p>
      <p className="mt-1 text-[24px] font-mono font-light text-cyan-700">{pct}%</p>
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
        recalled · {solid}/{total} loci
      </p>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] font-mono uppercase tracking-wider">
        <div className="border border-rose-100 bg-rose-50/50 rounded py-1.5 text-rose-700">
          {tally.hard}<br />hard
        </div>
        <div className="border border-cyan-100 bg-cyan-50/50 rounded py-1.5 text-cyan-700">
          {tally.good}<br />ok
        </div>
        <div className="border border-emerald-100 bg-emerald-50/50 rounded py-1.5 text-emerald-700">
          {tally.easy}<br />easy
        </div>
      </div>
      {streak != null && (
        <p className="mt-3 flex items-center justify-center gap-1 text-[11px] font-mono text-amber-700">
          <Flame className="w-3.5 h-3.5 text-amber-500" />
          {streak}-day review streak
        </p>
      )}
      <p className="mt-2 text-[10px] font-mono font-light text-gray-400 leading-relaxed">
        Anything marked hard comes back tomorrow. The rest spaces out further
        each time you recall it.
      </p>
    </div>
  );
}

function DueBadge({
  review, nowMs,
}: {
  review: PalaceReview | null;
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
  label, hotkey, tone, onClick,
}: {
  label: string;
  hotkey: string;
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
      title={`Press ${hotkey}`}
    >
      {label}
      <span className="block text-[8px] text-gray-300">{hotkey}</span>
    </button>
  );
}
