import { io, type Socket } from 'socket.io-client';
import type { ChatMessage, Offer, ThreadSummary } from '../types/domain';

const SOCKET_EVENTS = {
  THREAD_CREATED: 'chat:thread:created',
  MESSAGE_CREATED: 'chat:message:created',
  OFFER_UPDATED: 'chat:offer:updated',
  TYPING_UPDATED: 'chat:typing',
  PLATFORM_NOTIFICATION: 'platform:notification',
  THREAD_JOIN: 'thread:join',
  THREAD_LEAVE: 'thread:leave',
  CHAT_ERROR: 'chat:error',
} as const;

export interface SocketThreadCreatedPayload {
  thread: ThreadSummary;
  participants: number[];
}

export interface SocketMessageCreatedPayload {
  threadId: number;
  message: ChatMessage;
}

export interface SocketOfferUpdatedPayload {
  threadId: number;
  offer: Offer;
  kind: 'created' | 'responded';
}

export interface SocketTypingPayload {
  threadId: number;
  userId: number;
  isTyping: boolean;
}

export interface SocketPlatformNotificationPayload {
  kind: 'deal_update' | 'report_update' | 'moderation' | 'report_queue' | 'system';
  title: string;
  body: string;
  link?: string;
  threadId?: number;
  createdAt: string;
}

let socket: Socket | null = null;
let currentToken: string | null = null;

function resolveSocketUrl(): string {
  const explicitUrl = import.meta.env.VITE_SOCKET_URL;
  if (explicitUrl && explicitUrl.length > 0) {
    return explicitUrl;
  }

  const { protocol, hostname, port } = window.location;
  if (port === '3000') {
    return `${protocol}//${hostname}:5000`;
  }

  // Same-origin by default; works with Nginx and Vite proxy.
  return window.location.origin;
}

export function connectChatSocket(accessToken: string): Socket {
  if (socket && currentToken === accessToken) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = accessToken;
  socket = io(resolveSocketUrl(), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: {
      token: accessToken,
    },
  });

  return socket;
}

export function disconnectChatSocket(): void {
  if (!socket) return;
  socket.disconnect();
  socket = null;
  currentToken = null;
}

export function joinThreadRoom(threadId: number): void {
  socket?.emit(SOCKET_EVENTS.THREAD_JOIN, { threadId });
}

export function leaveThreadRoom(threadId: number): void {
  socket?.emit(SOCKET_EVENTS.THREAD_LEAVE, { threadId });
}

export function emitTypingUpdated(threadId: number, isTyping: boolean): void {
  socket?.emit(SOCKET_EVENTS.TYPING_UPDATED, { threadId, isTyping });
}

export function onThreadCreated(handler: (payload: SocketThreadCreatedPayload) => void): () => void {
  socket?.on(SOCKET_EVENTS.THREAD_CREATED, handler);
  return () => socket?.off(SOCKET_EVENTS.THREAD_CREATED, handler);
}

export function onMessageCreated(handler: (payload: SocketMessageCreatedPayload) => void): () => void {
  socket?.on(SOCKET_EVENTS.MESSAGE_CREATED, handler);
  return () => socket?.off(SOCKET_EVENTS.MESSAGE_CREATED, handler);
}

export function onOfferUpdated(handler: (payload: SocketOfferUpdatedPayload) => void): () => void {
  socket?.on(SOCKET_EVENTS.OFFER_UPDATED, handler);
  return () => socket?.off(SOCKET_EVENTS.OFFER_UPDATED, handler);
}

export function onTypingUpdated(handler: (payload: SocketTypingPayload) => void): () => void {
  socket?.on(SOCKET_EVENTS.TYPING_UPDATED, handler);
  return () => socket?.off(SOCKET_EVENTS.TYPING_UPDATED, handler);
}

export function onPlatformNotification(
  handler: (payload: SocketPlatformNotificationPayload) => void,
): () => void {
  socket?.on(SOCKET_EVENTS.PLATFORM_NOTIFICATION, handler);
  return () => socket?.off(SOCKET_EVENTS.PLATFORM_NOTIFICATION, handler);
}

export function onChatSocketError(handler: (payload: { code?: string }) => void): () => void {
  socket?.on(SOCKET_EVENTS.CHAT_ERROR, handler);
  return () => socket?.off(SOCKET_EVENTS.CHAT_ERROR, handler);
}

export { SOCKET_EVENTS };
