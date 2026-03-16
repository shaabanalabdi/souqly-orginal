import { create } from 'zustand';

interface ChatMetaState {
  unreadCount: number;
  setUnreadCount: (unreadCount: number) => void;
}

export const useChatMetaStore = create<ChatMetaState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => {
    set({ unreadCount: Math.max(0, unreadCount) });
  },
}));
