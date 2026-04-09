import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
} from 'lucide-react';

interface Props {
  content: string;
  onBlur: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function RichTextEditor({
  content,
  onBlur,
  placeholder = "Write something, or type '/' for commands…",
  autoFocus = false,
  className = '',
}: Props) {
  // Latest onBlur ref so the editor effect doesn't need to rebind.
  const onBlurRef = useRef(onBlur);
  useEffect(() => { onBlurRef.current = onBlur; }, [onBlur]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: { HTMLAttributes: { class: 'rte-ul' } },
        orderedList: { HTMLAttributes: { class: 'rte-ol' } },
        codeBlock: { HTMLAttributes: { class: 'rte-pre' } },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: 'text-blue-500 underline underline-offset-2 hover:text-blue-600',
        },
      }),
    ],
    content: content || '',
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none text-[13.5px] leading-relaxed text-gray-700 rte-content',
      },
    },
    onBlur: ({ editor }) => {
      onBlurRef.current(editor.getHTML());
    },
  });

  // Sync external content changes (e.g. store refresh) without clobbering active edits.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content !== current && !editor.isFocused) {
      editor.commands.setContent(content || '', { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `p-1.5 rounded transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center ${
      active ? 'text-blue-500 bg-blue-50' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
    }`;

  const handleLink = () => {
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('Link URL', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className={`rte-root ${className}`}>
      <BubbleMenu
        editor={editor}
        options={{ placement: 'top' }}
      >
        <div className="flex items-center gap-0.5 rounded-lg bg-white border border-gray-200 shadow-lg px-1 py-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={btn(editor.isActive('bold'))}
            title="Bold (⌘B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={btn(editor.isActive('italic'))}
            title="Italic (⌘I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={btn(editor.isActive('strike'))}
            title="Strikethrough"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={btn(editor.isActive('code'))}
            title="Inline code"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleLink}
            className={btn(editor.isActive('link'))}
            title="Link"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-4 bg-gray-200 mx-0.5" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={btn(editor.isActive('heading', { level: 2 }))}
            title="Heading"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={btn(editor.isActive('heading', { level: 3 }))}
            title="Subheading"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={btn(editor.isActive('bulletList'))}
            title="Bullet list"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={btn(editor.isActive('orderedList'))}
            title="Numbered list"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={btn(editor.isActive('blockquote'))}
            title="Quote"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
        </div>
      </BubbleMenu>

      <EditorContent editor={editor} />
    </div>
  );
}
