import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ArrowUp, RotateCcw, Check, AlertCircle, Wrench } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUIStore } from '@/store/uiStore';
import { useTodoStore } from '@/store/todoStore';
import { useChatStore, type ToolCallSummary } from '@/store/chatStore';
import { useChat } from '@/hooks/useChat';

function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="text-[12px] font-mono font-light text-gray-700 leading-relaxed break-words space-y-2 [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-gray-900 [&_em]:italic [&_h1]:text-[14px] [&_h1]:font-semibold [&_h1]:text-gray-900 [&_h1]:mt-2 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mt-2 [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-2 [&_hr]:my-3 [&_hr]:border-gray-200 [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_pre]:bg-gray-50 [&_pre]:border [&_pre]:border-gray-200 [&_pre]:rounded [&_pre]:p-2 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:text-cyan-600 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-gray-200 [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_blockquote]:italic [&_table]:border-collapse [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  list_pages: 'Listed pages',
  get_page: 'Read page',
  create_task: 'Created task',
  update_task: 'Updated task',
  archive_task: 'Archived task',
  delete_task: 'Deleted task',
  reorder_tasks: 'Reordered tasks',
};

function toolDetail(tc: ToolCallSummary): string | null {
  const input = tc.input ?? {};
  if (tc.name === 'create_task' && typeof input.text === 'string') {
    return input.text.length > 50 ? input.text.slice(0, 50) + '…' : input.text;
  }
  if (tc.name === 'update_task' && typeof input.completed === 'boolean') {
    return input.completed ? 'marked complete' : 'marked incomplete';
  }
  if (tc.name === 'reorder_tasks' && Array.isArray(input.ordered_task_ids)) {
    return `${input.ordered_task_ids.length} items`;
  }
  return null;
}

function ToolCallCard({ tc }: { tc: ToolCallSummary }) {
  const label = TOOL_LABELS[tc.name] ?? tc.name;
  const detail = toolDetail(tc);
  const Icon = tc.ok ? Check : AlertCircle;
  const color = tc.ok ? 'text-cyan-600 border-cyan-100 bg-cyan-50/60' : 'text-red-500 border-red-100 bg-red-50/60';
  return (
    <div className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider border rounded px-2 py-1 ${color}`}>
      <Icon className="w-3 h-3" />
      <Wrench className="w-3 h-3 opacity-60" />
      <span>{label}</span>
      {detail && <span className="normal-case tracking-normal text-gray-500 lowercase">· {detail}</span>}
      {!tc.ok && tc.error && <span className="normal-case tracking-normal text-red-400">· {tc.error}</span>}
    </div>
  );
}

export function ChatThreadPanel() {
  const chatPanelOpen = useUIStore((s) => s.chatPanelOpen);
  const closeChatPanel = useUIStore((s) => s.closeChatPanel);
  const activeView = useUIStore((s) => s.activeView);
  const currentTodoId = useTodoStore((s) => s.currentTodoId);

  const activePageId = activeView === 'tasks' ? currentTodoId : null;

  const { messages, isLoading, error, sendMessage } = useChat();
  const { setMessages, setConversationId } = useChatStore();

  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Escape closes panel
  useEffect(() => {
    if (!chatPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeChatPanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatPanelOpen, closeChatPanel]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (chatPanelOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [chatPanelOpen]);

  const handleSubmit = () => {
    if (!draft.trim() || isLoading) return;
    sendMessage(draft.trim(), activePageId);
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleNewChat = async () => {
    setMessages([]);
    setConversationId(null);
    // The next sendMessage call will create a fresh conversation via the edge function
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeChatPanel}
        className={`absolute inset-0 bg-black/20 backdrop-blur-[1px] z-40 transition-opacity duration-200 ${
          chatPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden
      />

      {/* Sliding panel — sits above both bottom bars (h-20 = 5rem) */}
      <div
        className={`absolute left-4 right-4 bottom-[5.5rem] z-40 bg-white border border-gray-200 rounded-lg shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out flex flex-col overflow-hidden ${
          chatPanelOpen ? 'translate-y-0' : 'translate-y-[calc(100%+6rem)]'
        }`}
        style={{ height: '65vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-10 border-b border-gray-100 bg-gradient-to-r from-white to-cyan-50/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 tech-glow" />
            <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-gray-700 font-semibold">
              Assistant
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-gray-700 border-none bg-transparent cursor-pointer p-1 transition-colors"
              title="Start new chat"
            >
              <RotateCcw className="w-3 h-3" />
              new chat
            </button>
            <button
              onClick={closeChatPanel}
              className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-gray-700 border-none bg-transparent cursor-pointer p-1 transition-colors"
              title="Close (Esc)"
            >
              close
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
          {messages.length === 0 && !isLoading && (
            <p className="text-[11px] font-mono font-light text-gray-400 text-center pt-8">
              No messages yet. Ask anything about the current page.
            </p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'user' ? (
                <div className="max-w-[75%] bg-cyan-50 border border-cyan-100 rounded-md px-3 py-2">
                  <p className="text-[12px] font-mono font-light text-gray-700 whitespace-pre-wrap break-words">
                    {msg.text}
                  </p>
                </div>
              ) : (
                <div className="max-w-[85%] space-y-1.5">
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {msg.toolCalls.map((tc, i) => (
                        <ToolCallCard key={i} tc={tc} />
                      ))}
                    </div>
                  )}
                  <AssistantMarkdown text={msg.text} />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 py-1">
                <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <p className="text-[11px] font-mono text-red-400 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                Error: {error}
              </p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2 flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Claude… (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent border border-gray-200 rounded-md outline-none text-[12px] font-mono font-light text-gray-700 placeholder-gray-400 px-3 py-1.5 resize-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-200 transition-colors min-h-[2rem] max-h-24"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={handleSubmit}
            disabled={!draft.trim() || isLoading}
            className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-none cursor-pointer text-white mb-px"
            title="Send (Enter)"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
