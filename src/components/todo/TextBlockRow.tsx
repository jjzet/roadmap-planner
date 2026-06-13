import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore } from '@/store/todoStore';
import type { TextBlock, PageBlock } from '@/types';
import { useCallback, useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { SlashCommandMenu } from './SlashCommandMenu';
import { GoalPickerModal } from './GoalPickerModal';
import { RichTextEditor } from '@/components/editor/RichTextEditor';

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

  const handleChange = useCallback((_html: string, text: string) => {
    const trimmed = text.trim();
    if (trimmed.startsWith('/')) {
      setSlashQuery(trimmed.slice(1));
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
      setSlashQuery('');
    }
  }, []);

  const handleBlur = useCallback((html: string) => {
    // Don't save if content is a slash command stub — it'll be replaced
    if (!showSlashMenu) {
      updateTextBlock(block.id, html);
    }
  }, [block.id, showSlashMenu, updateTextBlock]);

  const handleSlashSelect = (commandId: string) => {
    setShowSlashMenu(false);
    setSlashQuery('');

    switch (commandId) {
      case 'text': {
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
      <span
        className="absolute -left-6 top-1 text-o-ink-14 hover:text-o-ink-45 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </span>

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <RichTextEditor
            content={block.content}
            onBlur={handleBlur}
            onChange={handleChange}
            placeholder="Type '/' for commands…"
          />
        </div>

        <button
          onClick={() => removeBlock(block.id)}
          className="text-o-ink-28 hover:text-o-blue opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0 flex-shrink-0 mt-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {showSlashMenu && (
        // onMouseDown prevents editor blur when clicking menu items
        <div onMouseDown={(e) => e.preventDefault()}>
          <SlashCommandMenu
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={handleSlashClose}
          />
        </div>
      )}

      {showGoalPicker && (
        <div>
          <GoalPickerModal
            onSelect={handleGoalSelect}
            onClose={handleGoalPickerClose}
          />
        </div>
      )}
    </div>
  );
}
