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
import { useState } from 'react';
import { Plus, Type, ListChecks } from 'lucide-react';

export function TodoListContent() {
  const blocks = useTodoStore((s) => s.todo.blocks);
  const addGroupBlock = useTodoStore((s) => s.addGroupBlock);
  const addTextBlock = useTodoStore((s) => s.addTextBlock);
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

  const handleShowAddGroup = () => {
    setShowAddGroup(true);
    setShowAddMenu(false);
  };

  return (
    <div className="max-w-3xl px-8 py-6">
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
            if (block.type === 'group') {
              return <TodoGroupBlock key={block.data.id} group={block.data} />;
            }
            return <TextBlockRow key={block.data.id} block={block.data} />;
          })}
        </SortableContext>
      </DndContext>

      {/* Empty state */}
      {blocks.length === 0 && !showAddGroup && (
        <div className="py-16">
          <p className="text-gray-400 text-sm mb-4">
            This page is empty. Add a text block or group to get started.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddText}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border-none cursor-pointer text-sm"
            >
              <Type className="w-4 h-4" />
              Text
            </button>
            <button
              onClick={() => setShowAddGroup(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 border-none cursor-pointer text-sm"
            >
              <ListChecks className="w-4 h-4" />
              Group
            </button>
          </div>
        </div>
      )}

      {/* Add group input */}
      {showAddGroup && (
        <div className="mt-4">
          <input
            className="w-full text-sm font-semibold border-b-2 border-gray-300 px-1 py-2 outline-none focus:border-blue-400 bg-transparent"
            placeholder="Group name..."
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
        <div className="mt-6 relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-500 cursor-pointer border-none bg-transparent px-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add block
          </button>

          {showAddMenu && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
              <button
                onClick={handleAddText}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-none bg-transparent cursor-pointer text-left"
              >
                <Type className="w-4 h-4 text-gray-400" />
                Text
              </button>
              <button
                onClick={handleShowAddGroup}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-none bg-transparent cursor-pointer text-left"
              >
                <ListChecks className="w-4 h-4 text-gray-400" />
                Group
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
