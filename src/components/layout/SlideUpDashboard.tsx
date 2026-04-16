import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useDashboardDataContext } from '@/hooks/DashboardDataContext';
import { useUIStore } from '@/store/uiStore';
import { CompletionTrendChart } from '@/components/dashboard/CompletionTrendChart';
import { VelocityWidget } from '@/components/dashboard/VelocityWidget';
import { GroupHealthWidget } from '@/components/dashboard/GroupHealthWidget';
import { PinnedItemsWidget } from '@/components/dashboard/PinnedItemsWidget';
import type { TimeRange } from '@/hooks/useDashboardData';

export function SlideUpDashboard() {
  const { data } = useDashboardDataContext();
  const dashboardPanelOpen = useUIStore((s) => s.dashboardPanelOpen);
  const closeDashboardPanel = useUIStore((s) => s.closeDashboardPanel);
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');

  // Escape closes
  useEffect(() => {
    if (!dashboardPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDashboardPanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dashboardPanelOpen, closeDashboardPanel]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeDashboardPanel}
        className={`absolute inset-0 bg-black/20 backdrop-blur-[1px] z-40 transition-opacity duration-200 ${
          dashboardPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden
      />

      {/* Sliding panel — sits above the bottom strip (h-10 = 2.5rem) */}
      <div
        className={`absolute left-0 right-0 bottom-10 z-40 bg-white border-t border-gray-200 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out ${
          dashboardPanelOpen ? 'translate-y-0' : 'translate-y-[calc(100%+2.5rem)]'
        }`}
        style={{ height: '65vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-10 border-b border-gray-100 bg-gradient-to-r from-white to-cyan-50/30">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 tech-glow" />
            <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-gray-700 font-semibold">
              Dashboard
            </h2>
          </div>
          <button
            onClick={closeDashboardPanel}
            className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-gray-700 border-none bg-transparent cursor-pointer p-1"
            title="Close (Esc)"
          >
            close
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 py-4" style={{ height: 'calc(65vh - 2.5rem)' }}>
          {!data ? (
            <div className="text-center text-sm font-mono font-light text-gray-400 py-12">Loading dashboard…</div>
          ) : (
            <div className="space-y-4 max-w-6xl mx-auto">
              {/* Row 1: Trend (2/3) + Velocity (1/3) */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <CompletionTrendChart
                    data={data.trends[timeRange]}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                  />
                </div>
                <VelocityWidget velocity={data.velocity[timeRange]} />
              </div>
              {/* Row 2: Group Health + Pinned Items */}
              <div className="grid grid-cols-2 gap-4">
                <GroupHealthWidget groups={data.groupHealth} />
                <PinnedItemsWidget items={data.pinnedItems} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
