import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  created_at: string;
}

interface ChatState {
  conversationId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  historyLoaded: boolean;

  setConversationId: (id: string | null) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  appendMessage: (msg: ChatMessage) => void;
  replaceMessage: (tempId: string, msg: ChatMessage) => void;
  removeMessage: (id: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setHistoryLoaded: (v: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversationId: null,
  messages: [],
  isLoading: false,
  error: null,
  historyLoaded: false,

  setConversationId: (id) => set({ conversationId: id }),
  setMessages: (msgs) => set({ messages: msgs }),
  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  replaceMessage: (tempId, msg) =>
    set((s) => ({ messages: s.messages.map((m) => (m.id === tempId ? msg : m)) })),
  removeMessage: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),
  setHistoryLoaded: (v) => set({ historyLoaded: v }),
}));
