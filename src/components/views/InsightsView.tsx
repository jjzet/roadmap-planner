import { useState } from 'react';
import { Heart, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { useInsightStore } from '@/store/insightStore';
import type { DailyInsight } from '@/types';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
}

function InsightCard({ insight, date, isFav, onToggleFav }: {
  insight: DailyInsight;
  date: string;
  isFav: boolean;
  onToggleFav: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-[16px] overflow-hidden group/card transition-transform hover:scale-[1.008]"
      style={{ background: 'var(--paper-raise)', border: '1px solid var(--ink-14)' }}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {insight.category && (
              <span
                className="o-dot text-[9.5px] px-2 pt-1 pb-0.5 rounded-[6px]"
                style={{ background: 'var(--lavender-soft)', color: 'var(--ink)' }}
              >
                {insight.category}
              </span>
            )}
            <span className="o-dot text-[10px]" style={{ color: 'var(--ink-45)' }}>{formatDate(date)}</span>
          </div>
          <button
            onClick={onToggleFav}
            className={`flex-shrink-0 border-none bg-transparent cursor-pointer p-0.5 rounded transition-all ${
              isFav ? '' : 'opacity-0 group-hover/card:opacity-100'
            }`}
            style={{ color: isFav ? 'var(--blue)' : 'var(--ink-28)' }}
            title={isFav ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Heart className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Concept */}
        {insight.concept && (
          <p className="m-0 mb-1.5 text-[15px] font-bold leading-snug" style={{ color: 'var(--ink)' }}>
            {insight.concept}
          </p>
        )}

        {/* Lesson */}
        {insight.lesson && (
          <p className="m-0 text-[13px] font-medium leading-relaxed" style={{ color: 'var(--ink-65)' }}>
            {insight.lesson}
          </p>
        )}

        {/* Source */}
        {(insight.book || insight.source) && (
          <div className="flex items-center gap-1.5 mt-3">
            <BookOpen className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--ink-28)' }} />
            <span className="o-dot text-[9.5px] truncate" style={{ color: 'var(--ink-45)' }}>
              {insight.book ?? insight.source}{insight.book && insight.author ? ` · ${insight.author}` : ''}
            </span>
          </div>
        )}

        {/* Expanded */}
        {expanded && (
          <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--ink-07)' }}>
            {insight.why_it_matters && (
              <p className="m-0 text-[13px] font-medium leading-relaxed" style={{ color: 'var(--ink-65)' }}>{insight.why_it_matters}</p>
            )}
            {insight.long_summary && (
              <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-45)' }}>{insight.long_summary}</p>
            )}
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-center py-1.5 transition-colors border-none bg-transparent cursor-pointer hover:bg-o-ink-04"
        style={{ color: 'var(--ink-28)', borderTop: '1px solid var(--ink-07)' }}
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export function InsightsView() {
  const favourites = useInsightStore((s) => s.favourites);
  const allInsights = useInsightStore((s) => s.allInsights);
  const isLoading = useInsightStore((s) => s.isLoading);
  const toggleFavourite = useInsightStore((s) => s.toggleFavourite);
  const isFavourited = useInsightStore((s) => s.isFavourited);

  const hasFavourites = favourites.length > 0;
  const validInsights = allInsights.filter(
    (i) => i.insight_data && typeof i.insight_data === 'object' && i.insight_data.concept
  );

  return (
    <div className="o-scroll flex-1 overflow-y-auto">
      <div className="max-w-[1180px] mx-auto px-10 pt-9 pb-44 w-full">
        {/* Topline */}
        <div className="flex items-center justify-between pb-3" style={{ borderBottom: '2px solid var(--ink)' }}>
          <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span className="o-dot text-[12.5px]" style={{ color: 'var(--ink-65)' }}>
            {validInsights.length} COLLECTED
          </span>
        </div>

        <h1 className="o-display m-0 pt-7 pb-2" style={{ fontSize: 'clamp(44px, 7vw, 84px)', color: 'var(--ink)' }}>
          Insights
        </h1>
        <p className="m-0 mb-9 text-[14px] font-medium" style={{ color: 'var(--ink-45)' }}>
          One a day. Save the ones worth keeping.
        </p>

        {/* Favourites */}
        {hasFavourites && (
          <div className="mb-12">
            <div
              className="o-dot flex items-center gap-2 text-[11px] pb-2 mb-4"
              style={{ color: 'var(--ink-45)', borderBottom: '1px solid var(--ink-14)' }}
            >
              <Heart className="w-3 h-3" fill="var(--blue)" style={{ color: 'var(--blue)' }} />
              SAVED
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {favourites.map((f) => (
                <InsightCard
                  key={f.id}
                  insight={f.insight_data}
                  date={f.date}
                  isFav={true}
                  onToggleFav={() => toggleFavourite(f.date, f.insight_data)}
                />
              ))}
            </div>
          </div>
        )}

        {/* History */}
        <div>
          <div
            className="o-dot text-[11px] pb-2 mb-4"
            style={{ color: 'var(--ink-45)', borderBottom: '1px solid var(--ink-14)' }}
          >
            HISTORY
          </div>

          {isLoading ? (
            <p className="o-dot text-[12px]" style={{ color: 'var(--ink-45)' }}>LOADING…</p>
          ) : validInsights.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--ink-14)' }} />
              <p className="text-sm font-medium m-0" style={{ color: 'var(--ink-45)' }}>No insights generated yet.</p>
              <p className="text-xs m-0 mt-1" style={{ color: 'var(--ink-28)' }}>They appear here as they print each day.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {validInsights.map((item) => (
                <InsightCard
                  key={item.date}
                  insight={item.insight_data}
                  date={item.date}
                  isFav={isFavourited(item.date)}
                  onToggleFav={() => toggleFavourite(item.date, item.insight_data)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
