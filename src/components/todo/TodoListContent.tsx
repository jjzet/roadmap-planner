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
import { useState } from 'react';
import { Plus } from 'lucide-react';

export function TodoListContent() {
  const groups = useTodoStore((s) => s.todo.groups);
  const addGroup = useTodoStore((s) => s.addGroup);
  const reorderGroups = useTodoStore((s) => s.reorderGroups);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderGroups(active.id as string, over.id as string);
    }
  };

  const handleAddGroup = () => {
    if (newGroupName.trim()) {
      addGroup(newGroupName.trim());
      setNewGroupName('');
      setShowAddGroup(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={groups.map((g) => g.id)}
          strategy={verticalListSortingStrategy}
        >
          {groups.map((group) => (
            <TodoGroupBlock key={group.id} group={group} />
          ))}
        </SortableContext>
      </DndContext>

      {/* Empty state */}
      {groups.length === 0 && !showAddGroup && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm mb-4">No groups yet. Create your first group to start tracking tasks.</p>
          <button
            onClick={() => setShowAddGroup(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 border-none cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Group
          </button>
        </div>
      )}

      {/* Add group */}
      {showAddGroup ? (
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
      ) : (
        groups.length > 0 && (
          <button
            onClick={() => setShowAddGroup(true)}
            className="mt-6 flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-500 cursor-pointer border-none bg-transparent px-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Group
          </button>
        )
      )}
    </div>
  );
}
