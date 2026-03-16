import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type NotificationKind =
  | 'chat_message'
  | 'offer_update'
  | 'thread_created'
  | 'deal_update'
  | 'report_update'
  | 'moderation'
  | 'report_queue'
  | 'system';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  threadId?: number;
  link?: string;
  createdAt: string;
  read: boolean;
}

interface NotificationPayload {
  kind: NotificationKind;
  title: string;
  body: string;
  threadId?: number;
  link?: string;
  createdAt?: string;
}

interface NotificationState {
  items: NotificationItem[];
  addNotification: (payload: NotificationPayload) => void;
  markAsRead: (id: string) => void;
  markThreadAsRead: (threadId: number) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

function createNotificationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      items: [],
      addNotification: (payload) => {
        const nextItem: NotificationItem = {
          id: createNotificationId(),
          kind: payload.kind,
          title: payload.title,
          body: payload.body,
          threadId: payload.threadId,
          link: payload.link,
          createdAt: payload.createdAt ?? new Date().toISOString(),
          read: false,
        };

        set((state) => ({
          items: [nextItem, ...state.items].slice(0, 100),
        }));
      },
      markAsRead: (id) => {
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, read: true } : item)),
        }));
      },
      markThreadAsRead: (threadId) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.threadId === threadId && !item.read
              ? {
                  ...item,
                  read: true,
                }
              : item,
          ),
        }));
      },
      markAllAsRead: () => {
        set((state) => ({
          items: state.items.map((item) =>
            item.read
              ? item
              : {
                  ...item,
                  read: true,
                },
          ),
        }));
      },
      clearNotifications: () => {
        set({ items: [] });
      },
    }),
    {
      name: 'souqly_notifications',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
