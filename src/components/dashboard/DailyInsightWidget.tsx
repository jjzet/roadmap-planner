import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, RefreshCw, Heart } from 'lucide-react';
import { useDailyInsight } from '@/hooks/useDailyInsight';
import { useInsightStore } from '@/store/insightStore';

// Notion-style: just a subtle text colour per category, no heavy backgrounds
const CATEGORY_COLOURS: Record<string, string> = {
  'leadership':             'text-sky-500',
  'communication':          'text-violet-500',
  'design thinking':        'text-teal-500',
  'performance':            'text-green-500',
  'decision making':        'text-amber-500',
  'negotiation':            'text-rose-500',
  'biohacking':             'text-orange-500',
  'systems thinking':       'text-indigo-500',
  'habits':                 'text-emerald-500',
  'creativity':             'text-pink-500',
  'organisational culture': 'text-cyan-500',
};

const DEFAULT_COLOUR = 'text-gray-400';

export function DailyInsightWidget() {
  const { insight, isLoading, isRefreshing, error, refresh } = useDailyInsight();
  const toggleFavourite = useInsightStore((s) => s.toggleFavourite);
  // Subscribe to favourites directly so the heart updates reactively on first click.
  const favourites = useInsightStore((s) => s.favourites);
  const [expanded, setExpanded] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];
  const isFav = favourites.some((f) => f.date === todayDate);

  const categoryColour = insight?.category
    ? (CATEGORY_COLOURS[insight.category.toLowerCase()] ?? DEFAULT_COLOUR)
    : DEFAULT_COLOUR;

  const busy = isLoading || isRefreshing;

  if (error) {
    return (
      <div className="flex items-center gap-2.5 px-1 py-3 mb-4">
        <BookOpen className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
        <p className="text-xs text-gray-400 flex-1">
          {`Could not load insight — ${error}`}
        </p>
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="text-gray-300 hover:text-gray-500 transition-colors border-none bg-transparent cursor-pointer p-0.5 rounded"
          title="Retry"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
      {busy ? (
        /* Loading skeleton — same card shape, no colour */
        <div className="flex items-start gap-3 px-4 py-3.5">
          <div className="w-3.5 h-3.5 rounded bg-gray-100 animate-pulse flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-2 bg-gray-100 rounded-full animate-pulse w-20" />
            <div className="h-3 bg-gray-100 rounded-full animate-pulse w-3/4" />
            <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-1/2" />
          </div>
        </div>
      ) : insight ? (
        <div className="px-4 py-3.5">
          {/* Top row: category · book · author + controls */}
          <div className="flex items-center gap-0 mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
              {insight.category && (
                <span className={`text-[11px] font-medium ${categoryColour} capitalize`}>
                  {insight.category}
                </span>
              )}
              {insight.category && insight.book && (
                <span className="text-gray-200 text-[11px]">·</span>
              )}
              {insight.book && (
                <span className="text-[11px] text-gray-500 font-medium truncate">{insight.book}</span>
              )}
              {insight.author && (
                <span className="text-[11px] text-gray-400 italic truncate">{insight.author}</span>
              )}
            </div>

            {/* Controls — ghost, far right */}
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              {insight && (
                <button
                  onClick={() => toggleFavourite(todayDate, insight)}
                  className={`border-none bg-transparent cursor-pointer p-1 rounded transition-all ${
                    isFav
                      ? 'text-red-400 hover:text-red-500'
                      : 'text-gray-300 hover:text-red-300'
                  }`}
                  title={isFav ? 'Remove from favourites' : 'Save to favourites'}
                >
                  <Heart className={`w-3 h-3 ${isFav ? 'fill-red-400' : ''}`} />
                </button>
              )}
              <button
                onClick={refresh}
                disabled={isRefreshing}
                className="text-gray-300 hover:text-gray-500 transition-colors border-none bg-transparent cursor-pointer p-1 rounded disabled:opacity-40"
                title="Refresh"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-gray-300 hover:text-gray-500 transition-colors border-none bg-transparent cursor-pointer p-1 rounded"
                title={expanded ? 'Show less' : 'Read more'}
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Concept headline */}
          {insight.concept && (
            <p className="text-[13.5px] font-semibold text-gray-800 leading-snug mb-1.5 tracking-tight">
              {insight.concept}
            </p>
          )}

          {/* Lesson — the one-liner takeaway */}
          {insight.lesson && (
            <p className="text-[12.5px] text-gray-500 leading-relaxed">
              {insight.lesson}
            </p>
          )}

          {/* Expanded detail */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              {insight.why_it_matters && (
                <p className="text-[12.5px] text-gray-600 leading-relaxed">
                  {insight.why_it_matters}
                </p>
              )}
              {insight.long_summary && (
                <p className="text-[12px] text-gray-400 leading-relaxed">
                  {insight.long_summary}
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
