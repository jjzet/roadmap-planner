import { useState } from 'react';
import { useDailyInsight } from '@/hooks/useDailyInsight';
import { useInsightStore } from '@/store/insightStore';
import { useUIStore } from '@/store/uiStore';
import { Plus, Heart } from 'lucide-react';

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/** The daily insight as a quote band. Click to unfold the story behind it. */
export function InsightBand() {
  const { insight, isLoading } = useDailyInsight();
  const toggleFavourite = useInsightStore((s) => s.toggleFavourite);
  const isFavourited = useInsightStore((s) => s.isFavourited);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="py-6" style={{ borderBottom: '1px solid var(--ink-14)' }}>
        <span className="o-kicker">Daily insight</span>
        <span className="o-dot text-[11px] ml-4" style={{ color: 'var(--ink-28)' }}>PRINTING…</span>
      </div>
    );
  }
  if (!insight) return null;

  const fav = isFavourited(todayKey());
  const source = [insight.author || insight.book || insight.source, insight.source_type === 'research' ? 'RESEARCH' : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="py-6 cursor-pointer select-text"
      style={{ borderBottom: '1px solid var(--ink-14)' }}
      onClick={() => setOpen((v) => !v)}
    >
      <div className="grid gap-7 items-start" style={{ gridTemplateColumns: '136px 1fr auto' }}>
        <span className="o-kicker pt-1">Daily insight</span>
        <p
          className="m-0 text-[20px] leading-[1.35] font-medium max-w-[660px]"
          style={{ color: 'var(--ink)', letterSpacing: '-0.012em' }}
        >
          “{insight.lesson}”
        </p>
        <div className="flex flex-col items-end gap-2">
          <span
            className="flex items-center justify-center w-[26px] h-[26px] rounded-lg transition-transform"
            style={{
              border: `1.5px solid ${open ? 'var(--blue)' : 'var(--ink-28)'}`,
              color: open ? 'var(--blue)' : 'var(--ink-65)',
              transform: open ? 'rotate(45deg)' : 'none',
            }}
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            <Plus className="w-3.5 h-3.5" />
          </span>
          {source && (
            <span className="o-dot text-[10.5px] whitespace-nowrap" style={{ color: 'var(--ink-45)' }}>
              {source}
            </span>
          )}
        </div>
      </div>

      {/* Unfolded story */}
      <div
        className="grid gap-7 overflow-hidden transition-all duration-300"
        style={{
          gridTemplateColumns: '136px 1fr auto',
          maxHeight: open ? 560 : 0,
          opacity: open ? 1 : 0,
          paddingTop: open ? 18 : 0,
        }}
      >
        <span />
        <div className="max-w-[660px]" onClick={(e) => e.stopPropagation()}>
          {insight.why_it_matters && (
            <>
              <p className="o-dot m-0 mb-1.5 text-[10.5px]" style={{ color: 'var(--ink-45)' }}>Why it matters</p>
              <p className="m-0 mb-3.5 text-[14.5px] leading-[1.55]" style={{ color: 'var(--ink-65)' }}>
                {insight.why_it_matters}
              </p>
            </>
          )}
          {insight.long_summary && (
            <p className="m-0 text-[14.5px] leading-[1.55]" style={{ color: 'var(--ink-65)' }}>
              {insight.long_summary}
            </p>
          )}
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={(e) => { e.stopPropagation(); toggleFavourite(todayKey(), insight); }}
              className="flex items-center gap-1.5 border-none bg-transparent cursor-pointer p-0 text-[12.5px] font-semibold transition-colors"
              style={{ color: fav ? 'var(--blue)' : 'var(--ink-45)' }}
            >
              <Heart className="w-3.5 h-3.5" fill={fav ? 'currentColor' : 'none'} />
              {fav ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveView('insights'); }}
              className="border-none bg-transparent cursor-pointer p-0 text-[12.5px] font-semibold transition-colors hover:opacity-70"
              style={{ color: 'var(--blue)' }}
            >
              Collection →
            </button>
          </div>
        </div>
        <span />
      </div>
    </div>
  );
}
