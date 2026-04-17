import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore } from '@/store/todoStore';
import type { TextBlock, PageBlock } from '@/types';
import { useRef, useEffect, useCallback, useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { SlashCommandMenu } from './SlashCommandMenu';
import { GoalPickerModal } from './GoalPickerModal';

interface Props {
  block: TextBlock;
}

function uuid(): string {
  return crypto.randomUUID();
}

export function TextBlockRow({ block }: Props) {
  const updateTextBlock = useTodoStore((s) => s.updateTextBlock);
  const removeBlock = useTodoStore((s) => s.removeBlock);
  const replaceBlock = useTodoStore((s) => s.replaceBlock);
  const insertBlockAfter = useTodoStore((s) => s.insertBlockAfter);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [block.content, autoResize]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    updateTextBlock(block.id, value);
    autoResize();

    // Check if content starts with "/"
    if (value.startsWith('/')) {
      const query = value.slice(1); // everything after the /
      setSlashQuery(query);
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
      setSlashQuery('');
    }
  };

  const handleSlashSelect = (commandId: string) => {
    setShowSlashMenu(false);
    setSlashQuery('');

    switch (commandId) {
      case 'text': {
        // Clear current block content, insert a new text block after
        updateTextBlock(block.id, '');
        const newBlock: PageBlock = {
          type: 'text',
          data: { id: uuid(), content: '', order: 0 },
        };
        insertBlockAfter(block.id, newBlock);
        break;
      }
      case 'heading1':
      case 'heading2':
      case 'heading3': {
        const level = commandId === 'heading1' ? 1 : commandId === 'heading2' ? 2 : 3;
        const newBlock: PageBlock = {
          type: 'heading',
          data: { id: uuid(), content: '', level, order: 0 },
        };
        replaceBlock(block.id, newBlock);
        break;
      }
      case 'group': {
        const newBlock: PageBlock = {
          type: 'group',
          data: {
            id: uuid(),
            name: 'New Group',
            collapsed: false,
            order: 0,
            items: [],
          },
        };
        replaceBlock(block.id, newBlock);
        break;
      }
      case 'divider': {
        const newBlock: PageBlock = {
          type: 'divider',
          data: { id: uuid(), order: 0 },
        };
        replaceBlock(block.id, newBlock);
        break;
      }
      case 'goal_card': {
        // Show goal picker — block stays alive until a goal is selected
        setShowGoalPicker(true);
        updateTextBlock(block.id, '');
        break;
      }
    }
  };

  const handleSlashClose = () => {
    setShowSlashMenu(false);
    setSlashQuery('');
  };

  const handleGoalSelect = (goalId: string) => {
    setShowGoalPicker(false);
    const newBlock: PageBlock = {
      type: 'goal_card',
      data: { id: uuid(), goalId, order: 0 },
    };
    replaceBlock(block.id, newBlock);
  };

  const handleGoalPickerClose = () => {
    setShowGoalPicker(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-1 group relative">
      <div className="flex items-start gap-2" ref={wrapperRef}>
        <span
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </span>

        <textarea
          ref={textareaRef}
          className="flex-1 text-[12px] font-mono font-light leading-relaxed text-gray-700 bg-transparent border-none outline-none resize-none placeholder:text-gray-300 min-h-[1.5rem]"
          placeholder="Type '/' for commands..."
          value={block.content}
          onChange={handleChange}
          rows={1}
        />

        <button
          onClick={() => removeBlock(block.id)}
          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0 flex-shrink-0 mt-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {showSlashMenu && (
        <div className="ml-6">
          <SlashCommandMenu
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={handleSlashClose}
          />
        </div>
      )}

      {showGoalPicker && (
        <div className="ml-6">
          <GoalPickerModal
            onSelect={handleGoalSelect}
            onClose={handleGoalPickerClose}
          />
        </div>
      )}
    </div>
  );
}
