import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useDailyInsight } from '@/hooks/useDailyInsight';

const CATEGORY_STYLES: Record<string, { pill: string; icon: string }> = {
  'leadership':             { pill: 'bg-blue-50 text-blue-700 border-blue-100',     icon: 'text-blue-400' },
  'communication':          { pill: 'bg-purple-50 text-purple-700 border-purple-100', icon: 'text-purple-400' },
  'design thinking':        { pill: 'bg-teal-50 text-teal-700 border-teal-100',     icon: 'text-teal-400' },
  'performance':            { pill: 'bg-green-50 text-green-700 border-green-100',  icon: 'text-green-400' },
  'decision making':        { pill: 'bg-amber-50 text-amber-700 border-amber-100',  icon: 'text-amber-400' },
  'negotiation':            { pill: 'bg-rose-50 text-rose-700 border-rose-100',     icon: 'text-rose-400' },
  'biohacking':             { pill: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'text-orange-400' },
  'systems thinking':       { pill: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: 'text-indigo-400' },
  'habits':                 { pill: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'text-emerald-400' },
  'creativity':             { pill: 'bg-pink-50 text-pink-700 border-pink-100',     icon: 'text-pink-400' },
  'organisational culture': { pill: 'bg-cyan-50 text-cyan-700 border-cyan-100',     icon: 'text-cyan-400' },
};

const DEFAULT_STYLE = { pill: 'bg-gray-50 text-gray-600 border-gray-100', icon: 'text-gray-400' };

export function DailyInsightWidget() {
  const { insight, isLoading, error } = useDailyInsight();
  const [expanded, setExpanded] = useState(false);

  // Silent fail — never break surrounding layout
  if (error) return null;

  const style = insight
    ? (CATEGORY_STYLES[insight.category.toLowerCase()] ?? DEFAULT_STYLE)
    : DEFAULT_STYLE;

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden mb-6">
      {isLoading ? (
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-24" />
            <div className="h-3 bg-gray-100 rounded-full animate-pulse w-2/3" />
            <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-1/2" />
          </div>
        </div>
      ) : insight ? (
        <div>
          <div className="flex items-start gap-4 px-5 py-4">
            {/* Book icon */}
            <div className={`flex-shrink-0 mt-0.5 w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center ${style.icon}`}>
              <BookOpen className="w-4 h-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Meta row */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.pill}`}>
                  {insight.category}
                </span>
                <span className="text-xs font-medium text-gray-600 truncate">{insight.book}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">{insight.author}</span>
              </div>

              {/* Concept — headline */}
              <p className="text-sm font-semibold text-gray-800 leading-snug mb-1.5">
                {insight.concept}
              </p>

              {/* Lesson — always visible */}
              <p className="text-sm text-gray-500 leading-relaxed">
                {insight.lesson}
              </p>

              {/* Expanded content */}
              {expanded && (
                <div className="mt-3 pt-3 border-t border-gray-50 space-y-2.5">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {insight.why_it_matters}
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {insight.long_summary}
                  </p>
                </div>
              )}
            </div>

            {/* Right controls */}
            <div className="flex-shrink-0 flex flex-col items-end gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[10px] text-gray-300">
                <Sparkles className="w-3 h-3" />
                Daily insight
              </span>
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
