import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useDailyInsight } from '@/hooks/useDailyInsight';

interface CategoryStyle {
  pill: string;
  icon: string;
  accent: string;   // top strip colour
  gradient: string; // subtle card background gradient
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  'leadership':             { pill: 'bg-blue-50 text-blue-700 border-blue-100',      icon: 'text-blue-500',   accent: 'bg-blue-400',   gradient: 'from-blue-50/30 to-white' },
  'communication':          { pill: 'bg-violet-50 text-violet-700 border-violet-100', icon: 'text-violet-500', accent: 'bg-violet-400', gradient: 'from-violet-50/30 to-white' },
  'design thinking':        { pill: 'bg-teal-50 text-teal-700 border-teal-100',       icon: 'text-teal-500',   accent: 'bg-teal-400',   gradient: 'from-teal-50/30 to-white' },
  'performance':            { pill: 'bg-green-50 text-green-700 border-green-100',    icon: 'text-green-500',  accent: 'bg-green-400',  gradient: 'from-green-50/30 to-white' },
  'decision making':        { pill: 'bg-amber-50 text-amber-700 border-amber-100',    icon: 'text-amber-500',  accent: 'bg-amber-400',  gradient: 'from-amber-50/30 to-white' },
  'negotiation':            { pill: 'bg-rose-50 text-rose-700 border-rose-100',       icon: 'text-rose-500',   accent: 'bg-rose-400',   gradient: 'from-rose-50/30 to-white' },
  'biohacking':             { pill: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'text-orange-500', accent: 'bg-orange-400', gradient: 'from-orange-50/30 to-white' },
  'systems thinking':       { pill: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: 'text-indigo-500', accent: 'bg-indigo-400', gradient: 'from-indigo-50/30 to-white' },
  'habits':                 { pill: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'text-emerald-500', accent: 'bg-emerald-400', gradient: 'from-emerald-50/30 to-white' },
  'creativity':             { pill: 'bg-pink-50 text-pink-700 border-pink-100',       icon: 'text-pink-500',   accent: 'bg-pink-400',   gradient: 'from-pink-50/30 to-white' },
  'organisational culture': { pill: 'bg-cyan-50 text-cyan-700 border-cyan-100',       icon: 'text-cyan-500',   accent: 'bg-cyan-400',   gradient: 'from-cyan-50/30 to-white' },
};

const DEFAULT_STYLE: CategoryStyle = {
  pill: 'bg-gray-50 text-gray-600 border-gray-100',
  icon: 'text-gray-400',
  accent: 'bg-gray-200',
  gradient: 'from-gray-50/20 to-white',
};

export function DailyInsightWidget() {
  const { insight, isLoading, isRefreshing, error, refresh } = useDailyInsight();
  const [expanded, setExpanded] = useState(false);

  if (error) return null;

  const style = insight?.category
    ? (CATEGORY_STYLES[insight.category.toLowerCase()] ?? DEFAULT_STYLE)
    : DEFAULT_STYLE;

  const busy = isLoading || isRefreshing;

  return (
    <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
      {/* Category accent strip — the visual anchor */}
      <div className={`h-1 w-full ${busy ? 'bg-gray-100 animate-pulse' : style.accent}`} />

      {busy ? (
        /* Loading skeleton */
        <div className="flex items-center gap-4 px-5 py-4 bg-white">
          <div className="w-9 h-9 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-28" />
            <div className="h-3.5 bg-gray-100 rounded-full animate-pulse w-3/4" />
            <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-1/2" />
          </div>
        </div>
      ) : insight ? (
        <div className={`bg-gradient-to-br ${style.gradient}`}>
          <div className="flex items-start gap-4 px-5 py-4">

            {/* Book icon */}
            <div className={`flex-shrink-0 mt-0.5 w-9 h-9 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center ${style.icon}`}>
              <BookOpen className="w-4 h-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Meta: category pill + book + author */}
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                {insight.category && (
                  <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.pill}`}>
                    {insight.category}
                  </span>
                )}
                {insight.book && <span className="text-xs font-semibold text-gray-700 truncate">{insight.book}</span>}
                {insight.book && insight.author && <span className="text-xs text-gray-300">·</span>}
                {insight.author && <span className="text-xs text-gray-400 italic">{insight.author}</span>}
              </div>

              {/* Concept — larger, bolder headline */}
              {insight.concept && (
                <p className="text-[15px] font-bold text-gray-800 leading-snug mb-2 tracking-tight">
                  {insight.concept}
                </p>
              )}

              {/* Lesson — the key actionable line */}
              {insight.lesson && (
                <p className="text-sm text-gray-600 leading-relaxed">
                  {insight.lesson}
                </p>
              )}

              {/* Expanded detail */}
              {expanded && (
                <div className="mt-4 pt-4 border-t border-gray-100/80 space-y-3">
                  {insight.why_it_matters && (
                    <p className="text-sm text-gray-700 leading-relaxed font-medium">
                      {insight.why_it_matters}
                    </p>
                  )}
                  {insight.long_summary && (
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {insight.long_summary}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right controls */}
            <div className="flex-shrink-0 flex flex-col items-end gap-2 mt-0.5">
              <button
                onClick={refresh}
                disabled={isRefreshing}
                className="text-gray-300 hover:text-gray-500 transition-colors border-none bg-transparent cursor-pointer p-0.5 rounded disabled:opacity-40"
                title="Refresh — get a new insight"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-gray-300 hover:text-gray-500 transition-colors border-none bg-transparent cursor-pointer p-0.5 rounded"
                title={expanded ? 'Show less' : 'Read more'}
              >
                {expanded
                  ? <ChevronUp className="w-4 h-4" />
                  : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
