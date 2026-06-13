import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useTodoStore } from '@/store/todoStore';
import { TodoGroupBlock } from './TodoGroupBlock';
import { TextBlockRow } from './TextBlockRow';
import { DividerBlockRow } from './DividerBlockRow';
import { HeadingBlockRow } from './HeadingBlockRow';
import { GoalCardBlock } from './GoalCardBlock';
import { useState } from 'react';
import { Plus, Type, ListChecks, Minus, Heading2 } from 'lucide-react';

export function TodoListContent() {
  const blocks = useTodoStore((s) => s.todo.blocks);
  const addGroupBlock = useTodoStore((s) => s.addGroupBlock);
  const addTextBlock = useTodoStore((s) => s.addTextBlock);
  const addDividerBlock = useTodoStore((s) => s.addDividerBlock);
  const addHeadingBlock = useTodoStore((s) => s.addHeadingBlock);
  const reorderBlocks = useTodoStore((s) => s.reorderBlocks);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderBlocks(active.id as string, over.id as string);
    }
  };

  const handleAddGroup = () => {
    if (newGroupName.trim()) {
      addGroupBlock(newGroupName.trim());
      setNewGroupName('');
      setShowAddGroup(false);
    }
  };

  const handleAddText = () => {
    addTextBlock();
    setShowAddMenu(false);
  };

  const handleAddHeading = () => {
    addHeadingBlock(2);
    setShowAddMenu(false);
  };

  const handleAddDivider = () => {
    addDividerBlock();
    setShowAddMenu(false);
  };

  const handleShowAddGroup = () => {
    setShowAddGroup(true);
    setShowAddMenu(false);
  };

  // Ordinals: groups number sequentially down the page (01, 02, …)
  let groupOrdinal = 0;

  const menuItemClass =
    'flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-o-ink hover:bg-o-ink-04 border-none bg-transparent cursor-pointer text-left';

  return (
    <div className="w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.data.id)}
          strategy={verticalListSortingStrategy}
        >
          {blocks.map((block) => {
            switch (block.type) {
              case 'group':
                groupOrdinal += 1;
                return <TodoGroupBlock key={block.data.id} group={block.data} ordinal={groupOrdinal} />;
              case 'text':
                return <TextBlockRow key={block.data.id} block={block.data} />;
              case 'divider':
                return <DividerBlockRow key={block.data.id} block={block.data} />;
              case 'heading':
                return <HeadingBlockRow key={block.data.id} block={block.data} />;
              case 'goal_card':
                return <GoalCardBlock key={block.data.id} block={block.data} />;
              default:
                return null;
            }
          })}
        </SortableContext>
      </DndContext>

      {/* Empty state */}
      {blocks.length === 0 && !showAddGroup && (
        <div className="py-16">
          <p className="text-[15px] mb-5" style={{ color: 'var(--ink-45)' }}>
            This page is empty. Add a group or a text block to get started.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddGroup(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-none cursor-pointer text-sm font-bold"
              style={{ background: 'var(--blue)', color: 'var(--on-blue)' }}
            >
              <ListChecks className="w-4 h-4" />
              Group
            </button>
            <button
              onClick={handleAddText}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-none cursor-pointer text-sm font-semibold"
              style={{ background: 'var(--ink-07)', color: 'var(--ink)' }}
            >
              <Type className="w-4 h-4" />
              Text
            </button>
          </div>
        </div>
      )}

      {/* Add group input */}
      {showAddGroup && (
        <div className="mt-4">
          <input
            className="o-head w-full text-[16px] px-1 py-2 outline-none bg-transparent"
            style={{ borderBottom: '2px solid var(--ink)', color: 'var(--ink)' }}
            placeholder="GROUP NAME…"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddGroup();
              if (e.key === 'Escape') { setShowAddGroup(false); setNewGroupName(''); }
            }}
            onBlur={() => {
              if (!newGroupName.trim()) { setShowAddGroup(false); }
            }}
            autoFocus
          />
        </div>
      )}

      {/* Add block buttons */}
      {blocks.length > 0 && !showAddGroup && (
        <div className="mt-4 relative pb-2">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-o-ink-28 hover:text-o-blue cursor-pointer border-none bg-transparent px-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add block
          </button>

          {showAddMenu && (
            <div
              className="absolute left-0 bottom-full mb-1 rounded-xl py-1.5 z-10 min-w-[170px]"
              style={{ background: 'var(--paper-raise)', border: '1px solid var(--ink-14)', boxShadow: '0 16px 40px -12px rgba(0,0,0,.25)' }}
            >
              <button onClick={handleShowAddGroup} className={menuItemClass}>
                <ListChecks className="w-4 h-4 text-o-ink-45" />
                Task Group
              </button>
              <button onClick={handleAddHeading} className={menuItemClass}>
                <Heading2 className="w-4 h-4 text-o-ink-45" />
                Heading
              </button>
              <button onClick={handleAddText} className={menuItemClass}>
                <Type className="w-4 h-4 text-o-ink-45" />
                Text
              </button>
              <button onClick={handleAddDivider} className={menuItemClass}>
                <Minus className="w-4 h-4 text-o-ink-45" />
                Divider
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
