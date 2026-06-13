import { useState } from 'react';
import { useTodoStore } from '@/store/todoStore';
import { useUIStore } from '@/store/uiStore';
import { Plus, Trash2, FileText } from 'lucide-react';

/** The page index — replaces the old sidebar tree. */
export function PagesView() {
  const todoList = useTodoStore((s) => s.todoList);
  const loadTodo = useTodoStore((s) => s.loadTodo);
  const createTodo = useTodoStore((s) => s.createTodo);
  const createSubPage = useTodoStore((s) => s.createSubPage);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const roots = todoList
    .filter((t) => !t.parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const childrenOf = (id: string) =>
    todoList.filter((t) => t.parentId === id).sort((a, b) => a.orderIndex - b.orderIndex);

  const open = (id: string) => {
    loadTodo(id);
    setActiveView('tasks');
  };

  const handleCreate = async () => {
    if (newName.trim()) {
      await createTodo(newName.trim());
      setNewName('');
      setCreating(false);
      setActiveView('tasks');
    }
  };

  const handleDelete = async (id: string, name: string, hasChildren: boolean) => {
    const msg = hasChildren
      ? `Delete page "${name}" and all its sub-pages? This cannot be undone.`
      : `Delete page "${name}"? This cannot be undone.`;
    if (window.confirm(msg)) await deleteTodo(id);
  };

  return (
    <div className="o-scroll flex-1 overflow-y-auto">
      <div className="max-w-[1180px] mx-auto px-10 pt-9 pb-44 w-full">
        {/* Topline */}
        <div className="flex items-center justify-between pb-3" style={{ borderBottom: '2px solid var(--ink)' }}>
          <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span className="o-dot text-[12.5px]" style={{ color: 'var(--ink-65)' }}>
            {roots.length} PAGES
          </span>
        </div>

        <div className="flex items-end justify-between pt-7 pb-9">
          <h1 className="o-display m-0" style={{ fontSize: 'clamp(44px, 7vw, 84px)', color: 'var(--ink)' }}>
            Pages
          </h1>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 mb-2 text-[14px] font-bold border-none cursor-pointer rounded-xl px-5 py-3"
            style={{ background: 'var(--blue)', color: 'var(--on-blue)' }}
          >
            <Plus className="w-4 h-4" />
            New page
          </button>
        </div>

        {creating && (
          <input
            className="o-head w-full text-[18px] px-1 py-2 mb-8 outline-none bg-transparent"
            style={{ borderBottom: '2px solid var(--ink)', color: 'var(--ink)' }}
            placeholder="PAGE NAME…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setCreating(false); setNewName(''); }
            }}
            onBlur={() => { if (!newName.trim()) setCreating(false); }}
            autoFocus
          />
        )}

        {/* Page tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roots.map((page, i) => {
            const subs = childrenOf(page.id);
            return (
              <div
                key={page.id}
                className="group relative rounded-[18px] p-5 cursor-pointer transition-transform hover:scale-[1.015]"
                style={{ background: 'var(--paper-raise)', border: '1px solid var(--ink-14)' }}
                onClick={() => open(page.id)}
              >
                <div className="flex items-start justify-between">
                  <span
                    className="o-dot text-[12px] rounded-[6px] px-1.5 pt-1 pb-0.5"
                    style={{ background: 'var(--sand)', color: 'var(--on-sand)', fontWeight: 900 }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); createSubPage(page.id, prompt('Sub-page name:')?.trim() || '').then(() => setActiveView('tasks')); }}
                      className="border-none bg-transparent cursor-pointer p-1 text-o-ink-28 hover:text-o-blue"
                      title="Add sub-page"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(page.id, page.name, subs.length > 0); }}
                      className="border-none bg-transparent cursor-pointer p-1 text-o-ink-28 hover:text-o-blue"
                      title="Delete page"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h2
                  className="m-0 mt-5 text-[21px] leading-[1.1] uppercase"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 830, fontStretch: '110%', letterSpacing: '-0.01em', color: 'var(--ink)' }}
                >
                  {page.name}
                </h2>

                {subs.length > 0 && (
                  <div className="mt-4 flex flex-col gap-1">
                    {subs.map((s) => (
                      <button
                        key={s.id}
                        onClick={(e) => { e.stopPropagation(); open(s.id); }}
                        className="flex items-center gap-2 text-left border-none bg-transparent cursor-pointer px-0 py-0.5 text-[13px] font-semibold text-o-ink-65 hover:text-o-blue transition-colors"
                      >
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {roots.length === 0 && !creating && (
          <p className="text-[15px]" style={{ color: 'var(--ink-45)' }}>
            No pages yet — create your first one.
          </p>
        )}
      </div>
    </div>
  );
}
