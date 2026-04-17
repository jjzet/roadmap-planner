import { Pin, ExternalLink, Calendar } from 'lucide-react';
import type { PinnedTask } from '@/hooks/useDashboardData';
import { useTodoStore } from '@/store/todoStore';
import { useUIStore } from '@/store/uiStore';
import { stripHtml } from '@/lib/utils';

interface Props {
  items: PinnedTask[];
}

function formatDueDate(dateStr: string): { label: string; color: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: 'text-red-500' };
  if (diffDays === 0) return { label: 'Today', color: 'text-orange-500' };
  if (diffDays === 1) return { label: 'Tomorrow', color: 'text-amber-500' };
  if (diffDays <= 7) return { label: `${diffDays}d`, color: 'text-cyan-600' };
  const m = due.toLocaleString('default', { month: 'short' });
  return { label: `${m} ${due.getDate()}`, color: 'text-gray-400' };
}

export function PinnedItemsWidget({ items }: Props) {
  const loadTodo = useTodoStore((s) => s.loadTodo);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const handleNavigate = (pageId: string) => {
    loadTodo(pageId);
    setActiveView('tasks');
  };

  return (
    <div className="bg-white rounded-md border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
        <h3 className="text-[11px] font-mono font-semibold uppercase tracking-[0.15em] text-gray-700">Pinned</h3>
        {items.length > 0 && (
          <span className="text-[10px] font-mono tabular-nums text-gray-400 ml-1">({items.length})</span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs font-mono font-light text-gray-400">No pinned tasks — pin important items to surface them here</p>
      ) : (
        <div className="space-y-1">
          {items.map(({ item, groupName, pageId }) => {
            const dueInfo = item.dueDate ? formatDueDate(item.dueDate) : null;
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded-sm hover:bg-cyan-50/40 group/pin cursor-pointer"
                onClick={() => handleNavigate(pageId)}
              >
                <Pin className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                <span className="flex-1 text-sm font-mono font-light text-gray-700 truncate">{stripHtml(item.text) || 'Untitled'}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex-shrink-0">{groupName}</span>
                {dueInfo && (
                  <span className={`text-[10px] font-mono font-medium tabular-nums flex-shrink-0 flex items-center gap-0.5 ${dueInfo.color}`}>
                    <Calendar className="w-2.5 h-2.5" />
                    {dueInfo.label}
                  </span>
                )}
                {item.link && (
                  <a
                    href={item.link.startsWith('http') ? item.link : `https://${item.link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-500 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    title={item.link}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
