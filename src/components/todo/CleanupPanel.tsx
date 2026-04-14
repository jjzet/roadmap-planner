import { useState, useEffect, useMemo } from 'react';
import {
  Archive,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  GitBranch,
  Pencil,
  Tag,
  X,
  ArrowRight,
} from 'lucide-react';
import type { CleanupSuggestion, SuggestionType } from '@/hooks/useListCleanup';

interface Props {
  suggestions: CleanupSuggestion[];
  isAnalysing: boolean;
  error: string | null;
  isDone: boolean;
  onApply: (selectedIds: Set<string>) => Promise<void>;
  onDismiss: () => void;
}

const TYPE_META: Record<SuggestionType, { label: string; Icon: React.ElementType; colour: string }> = {
  archive:        { label: 'Archive',    Icon: Archive,   colour: 'text-gray-400' },
  set_dev_status: { label: 'Dev status', Icon: GitBranch, colour: 'text-cyan-500' },
  set_due_date:   { label: 'Due dates',  Icon: Calendar,  colour: 'text-amber-400' },
  add_tags:       { label: 'Tags',       Icon: Tag,       colour: 'text-violet-400' },
  rename:         { label: 'Rename',     Icon: Pencil,    colour: 'text-teal-400' },
  flag_stale:     { label: 'Review',     Icon: Clock,     colour: 'text-rose-400' },
};

const DEV_STATUS_LABELS: Record<string, string> = {
  dev: 'dev', test: 'test', pr: 'PR', merged: 'merged',
};

function SuggestionRow({
  suggestion,
  checked,
  onToggle,
}: {
  suggestion: CleanupSuggestion;
  checked: boolean;
  onToggle: () => void;
}) {
  const renderDiff = () => {
    if (suggestion.type === 'rename' && suggestion.newText) {
      return (
        <div className="flex items-start gap-1.5 mt-1 flex-wrap">
          <span className="text-[11px] text-gray-400 line-through leading-relaxed">
            {suggestion.displayBefore ?? suggestion.itemText}
          </span>
          <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0 mt-0.5" />
          <span className="text-[11px] text-gray-600 leading-relaxed">{suggestion.newText}</span>
        </div>
      );
    }

    if (suggestion.type === 'set_dev_status' && suggestion.newDevStatus) {
      return (
        <div className="flex items-center gap-1.5 mt-1">
          {suggestion.displayBefore && (
            <>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 line-through">
                {DEV_STATUS_LABELS[suggestion.displayBefore] ?? suggestion.displayBefore}
              </span>
              <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
            </>
          )}
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-sm bg-cyan-50 text-cyan-600">
            {DEV_STATUS_LABELS[suggestion.newDevStatus] ?? suggestion.newDevStatus}
          </span>
        </div>
      );
    }

    if (suggestion.type === 'set_due_date' && suggestion.newDueDate) {
      const formatted = (() => {
        try {
          return new Date(suggestion.newDueDate).toLocaleDateString('en-AU', {
            weekday: 'short', day: 'numeric', month: 'short',
          });
        } catch {
          return suggestion.newDueDate;
        }
      })();
      return (
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[11px] text-gray-400">No date</span>
          <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
          <span className="text-[11px] text-amber-600 font-medium">{formatted}</span>
        </div>
      );
    }

    if (suggestion.type === 'add_tags' && suggestion.newTags?.length) {
      return (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {suggestion.newTags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-600">
              {tag}
            </span>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <label className="flex items-start gap-3 py-2.5 cursor-pointer">
      <div className="flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-3.5 h-3.5 rounded border-gray-300 text-gray-600 cursor-pointer accent-gray-600"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] text-gray-700 leading-snug truncate">{suggestion.itemText}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{suggestion.reason}</p>
        {renderDiff()}
      </div>
      <span className="text-[10px] text-gray-300 flex-shrink-0 mt-0.5 font-medium uppercase tracking-wide">
        {suggestion.groupName}
      </span>
    </label>
  );
}

export function CleanupPanel({ suggestions, isAnalysing, error, isDone, onApply, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);

  // Sync selection when suggestions arrive — useEffect, not useMemo
  useEffect(() => {
    setSelected(new Set(suggestions.map((s) => s.id)));
    if (suggestions.length > 0) setExpanded(false); // start collapsed on new results
  }, [suggestions]);

  const grouped = useMemo(() => {
    const map = new Map<SuggestionType, CleanupSuggestion[]>();
    for (const s of suggestions) {
      if (!map.has(s.type)) map.set(s.type, []);
      map.get(s.type)!.push(s);
    }
    return map;
  }, [suggestions]);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (ids: string[]) => {
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleApply = async () => {
    if (selected.size === 0) return;
    setIsApplying(true);
    try {
      await onApply(selected);
    } finally {
      setIsApplying(false);
    }
  };

  // ── Loading ──
  if (isAnalysing) {
    return (
      <div className="rounded-md border border-gray-200 bg-white mb-5 px-4 py-3.5 flex items-center gap-2.5">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="text-[12px] text-gray-400">Reviewing your list…</span>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="rounded-md border border-gray-200 bg-white mb-5 px-4 py-3.5 flex items-start gap-3">
        <p className="text-[12px] text-gray-400 flex-1 leading-relaxed">{error}</p>
        <button onClick={onDismiss} className="text-gray-300 hover:text-gray-500 transition-colors border-none bg-transparent cursor-pointer p-0.5">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // ── Empty ──
  if (isDone && suggestions.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-white mb-5 px-4 py-3.5 flex items-center gap-3">
        <p className="text-[12px] text-gray-500 flex-1">Your list looks clean — no suggestions.</p>
        <button onClick={onDismiss} className="text-gray-300 hover:text-gray-500 transition-colors border-none bg-transparent cursor-pointer p-0.5">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (!isDone) return null;

  // ── Collapsed summary row ──
  const summaryLine = (
    <div
      className="flex items-center gap-2.5 px-4 py-3 cursor-pointer select-none"
      onClick={() => setExpanded((v) => !v)}
    >
      <span className="text-[12.5px] font-medium text-gray-600 flex-1">
        Review
        <span className="ml-2 text-[12px] font-normal text-gray-400">
          {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
          {selected.size < suggestions.length && selected.size > 0
            ? ` · ${selected.size} selected`
            : ''}
        </span>
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="text-gray-300 hover:text-gray-500 transition-colors border-none bg-transparent cursor-pointer p-0.5 rounded"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {expanded
        ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
    </div>
  );

  return (
    <div className="rounded-md border border-gray-200 bg-white mb-5 overflow-hidden">
      {summaryLine}

      {expanded && (
        <>
          <div className="border-t border-gray-100 divide-y divide-gray-50">
            {Array.from(grouped.entries()).map(([type, items]) => {
              const meta = TYPE_META[type];
              const ids = items.map((s) => s.id);
              const allChecked = ids.every((id) => selected.has(id));

              return (
                <div key={type} className="px-4 py-1">
                  <div className="flex items-center gap-2 py-2">
                    <meta.Icon className={`w-3 h-3 flex-shrink-0 ${meta.colour}`} />
                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide flex-1">
                      {meta.label}
                      <span className="ml-1.5 font-normal normal-case tracking-normal text-gray-300">
                        {items.length}
                      </span>
                    </span>
                    <button
                      onClick={() => toggleGroup(ids)}
                      className="text-[11px] text-gray-300 hover:text-gray-500 transition-colors border-none bg-transparent cursor-pointer"
                    >
                      {allChecked ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50/80">
                    {items.map((s) => (
                      <SuggestionRow
                        key={s.id}
                        suggestion={s}
                        checked={selected.has(s.id)}
                        onToggle={() => toggleOne(s.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={onDismiss}
              className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors border-none bg-transparent cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={handleApply}
              disabled={selected.size === 0 || isApplying}
              className="text-[12px] font-medium px-3.5 py-1.5 rounded-md bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-none cursor-pointer"
            >
              {isApplying
                ? 'Applying…'
                : `Apply ${selected.size} change${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
