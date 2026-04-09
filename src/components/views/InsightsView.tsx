import { useState } from 'react';
import { Heart, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { useInsightStore } from '@/store/insightStore';
import type { DailyInsight } from '@/types';

const CATEGORY_BG: Record<string, string> = {
  'leadership': 'bg-blue-50 text-blue-600 border-blue-100',
  'communication': 'bg-violet-50 text-violet-600 border-violet-100',
  'design thinking': 'bg-teal-50 text-teal-600 border-teal-100',
  'performance': 'bg-green-50 text-green-600 border-green-100',
  'decision making': 'bg-amber-50 text-amber-600 border-amber-100',
  'negotiation': 'bg-rose-50 text-rose-600 border-rose-100',
  'biohacking': 'bg-orange-50 text-orange-600 border-orange-100',
  'systems thinking': 'bg-indigo-50 text-indigo-600 border-indigo-100',
  'habits': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'creativity': 'bg-pink-50 text-pink-600 border-pink-100',
  'organisational culture': 'bg-cyan-50 text-cyan-600 border-cyan-100',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' });
}

function InsightCard({ insight, date, isFav, onToggleFav }: {
  insight: DailyInsight;
  date: string;
  isFav: boolean;
  onToggleFav: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const catPill = insight.category
    ? (CATEGORY_BG[insight.category.toLowerCase()] ?? 'bg-gray-50 text-gray-500 border-gray-100')
    : 'bg-gray-50 text-gray-500 border-gray-100';

  return (
    <div className="bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200 overflow-hidden group/card">
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {insight.category && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${catPill}`}>
                {insight.category}
              </span>
            )}
            <span className="text-[11px] text-gray-400">{formatDate(date)}</span>
          </div>
          <button
            onClick={onToggleFav}
            className={`flex-shrink-0 border-none bg-transparent cursor-pointer p-0.5 rounded transition-all ${
              isFav
                ? 'text-red-400 hover:text-red-500'
                : 'text-gray-200 hover:text-red-300 opacity-0 group-hover/card:opacity-100'
            }`}
            title={isFav ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-red-400' : ''}`} />
          </button>
        </div>

        {/* Concept */}
        {insight.concept && (
          <p className="text-[13.5px] font-semibold text-gray-800 leading-snug mb-1.5 tracking-tight">
            {insight.concept}
          </p>
        )}

        {/* Lesson */}
        {insight.lesson && (
          <p className="text-[12.5px] text-gray-500 leading-relaxed">
            {insight.lesson}
          </p>
        )}

        {/* Book / Author */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <BookOpen className="w-3 h-3 text-gray-300 flex-shrink-0" />
          {insight.book && (
            <span className="text-[11px] text-gray-400 font-medium truncate">{insight.book}</span>
          )}
          {insight.author && (
            <span className="text-[11px] text-gray-300 italic truncate">{insight.author}</span>
          )}
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            {insight.why_it_matters && (
              <p className="text-[12.5px] text-gray-600 leading-relaxed">{insight.why_it_matters}</p>
            )}
            {insight.long_summary && (
              <p className="text-[12px] text-gray-400 leading-relaxed">{insight.long_summary}</p>
            )}
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-center py-1.5 text-gray-300 hover:text-gray-400 hover:bg-gray-50/50 transition-colors border-none bg-transparent cursor-pointer border-t border-gray-50"
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
  // Filter out insights with empty data
  const validInsights = allInsights.filter(
    (i) => i.insight_data && typeof i.insight_data === 'object' && i.insight_data.concept
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Insights</h1>
          <p className="text-sm text-gray-400 mt-1">Your daily book insights — favourite the ones worth revisiting.</p>
        </div>

        {/* Favourites section */}
        {hasFavourites && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400" />
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Favourites</h2>
            </div>
            <div className="flex flex-col gap-3">
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

        {/* History section */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">History</h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="h-3 bg-gray-100 rounded-full animate-pulse w-24 mb-2" />
                  <div className="h-4 bg-gray-100 rounded-full animate-pulse w-3/4 mb-1.5" />
                  <div className="h-3 bg-gray-100 rounded-full animate-pulse w-1/2" />
                </div>
              ))}
            </div>
          ) : validInsights.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No insights generated yet.</p>
              <p className="text-xs text-gray-300 mt-1">Insights appear here as they're generated each day.</p>
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
