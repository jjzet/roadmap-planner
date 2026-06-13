import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTodoStore } from '@/store/todoStore';
import { useUIStore } from '@/store/uiStore';
import { stripHtml } from '@/lib/utils';
import type { TodoData, TodoGroup, TodoItem } from '@/types';
import { ArrowUpRight } from 'lucide-react';

function domainOf(link: string): string {
  try {
    const url = new URL(link.startsWith('http') ? link : `https://${link}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return link.slice(0, 28);
  }
}

interface Section {
  name: string;
  color?: string;
  items: TodoItem[];
}

function buildSections(group: TodoGroup): Section[] {
  const active = group.items.filter((i) => !i.archived);
  const subGroups = group.subGroups ?? [];
  const sections: Section[] = [];

  const loose = active.filter((i) => !i.subGroupId || !subGroups.some((sg) => sg.id === i.subGroupId));
  if (loose.length > 0) sections.push({ name: '', items: loose.sort((a, b) => a.order - b.order) });

  for (const sg of [...subGroups].sort((a, b) => a.order - b.order)) {
    const items = active.filter((i) => i.subGroupId === sg.id).sort((a, b) => a.order - b.order);
    if (items.length > 0) sections.push({ name: sg.name, color: sg.color, items });
  }
  return sections;
}

/**
 * The Library — every reference the LINKS page holds, rendered as an index
 * rather than a checklist. Read-only here; edits happen on the page itself.
 */
export function LibraryView() {
  const todoList = useTodoStore((s) => s.todoList);
  const loadTodo = useTodoStore((s) => s.loadTodo);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const linksPage = todoList.find((t) => /links|library/i.test(t.name));
  const [groups, setGroups] = useState<TodoGroup[] | null>(null);

  useEffect(() => {
    if (!linksPage) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('todo_lists')
        .select('data')
        .eq('id', linksPage.id)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const todoData = data.data as TodoData;
      const blockGroups = (todoData.blocks || [])
        .filter((b): b is Extract<typeof b, { type: 'group' }> => b.type === 'group')
        .map((b) => b.data);
      setGroups([...blockGroups, ...(todoData.groups || [])]);
    })();
    return () => { cancelled = true; };
  }, [linksPage]);

  const refCount = groups?.reduce((n, g) => n + g.items.filter((i) => !i.archived).length, 0) ?? 0;

  return (
    <div className="o-scroll flex-1 overflow-y-auto">
      <div className="max-w-[1180px] mx-auto px-10 pt-9 pb-44 w-full">
        {/* Topline */}
        <div className="flex items-center justify-between pb-3" style={{ borderBottom: '2px solid var(--ink)' }}>
          <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span className="o-dot text-[12.5px]" style={{ color: 'var(--ink-65)' }}>
            {refCount} REFERENCES
          </span>
        </div>

        <div className="flex items-end justify-between pt-7 pb-7">
          <h1 className="o-display m-0" style={{ fontSize: 'clamp(44px, 7vw, 84px)', color: 'var(--ink)' }}>
            Library
          </h1>
          {linksPage && (
            <button
              onClick={() => { loadTodo(linksPage.id); setActiveView('tasks'); }}
              className="mb-2 text-[13px] font-bold border-none bg-transparent cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: 'var(--blue)' }}
            >
              Edit as page →
            </button>
          )}
        </div>

        {!linksPage ? (
          <p className="text-[15px]" style={{ color: 'var(--ink-45)' }}>
            No links page found — create a page named “LINKS” and it appears here as your library.
          </p>
        ) : !groups ? (
          <span className="o-dot text-[12px]" style={{ color: 'var(--ink-45)' }}>OPENING THE STACKS…</span>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="mb-10">
              {buildSections(group).map((section, si) => (
                <div key={si} className="mb-7">
                  {section.name && (
                    <div
                      className="flex items-center gap-2.5 pb-2 mb-1"
                      style={{ borderBottom: '2px solid var(--ink)' }}
                    >
                      {section.color && (
                        <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: section.color }} />
                      )}
                      <h2 className="o-head m-0 text-[14px]" style={{ color: 'var(--ink)' }}>
                        {section.name}
                      </h2>
                      <span className="o-dot ml-auto text-[11px]" style={{ color: 'var(--ink-45)' }}>
                        {section.items.length}
                      </span>
                    </div>
                  )}
                  {section.items.map((item) => {
                    const text = stripHtml(item.text) || 'Untitled';
                    const href = item.link
                      ? (item.link.startsWith('http') ? item.link : `https://${item.link}`)
                      : undefined;
                    const row = (
                      <div
                        className="group flex items-center gap-4 py-[11px] px-1 transition-colors hover:bg-o-ink-04 rounded-lg"
                        style={{ borderBottom: '1px solid var(--ink-07)' }}
                      >
                        <span className="flex-1 min-w-0 truncate text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                          {text}
                        </span>
                        {href && (
                          <span className="o-dot flex items-center gap-1 text-[10.5px] flex-shrink-0" style={{ color: 'var(--ink-45)' }}>
                            {domainOf(item.link)}
                            <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </span>
                        )}
                      </div>
                    );
                    return href ? (
                      <a key={item.id} href={href} target="_blank" rel="noopener noreferrer" className="block no-underline">
                        {row}
                      </a>
                    ) : (
                      <div key={item.id}>{row}</div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
