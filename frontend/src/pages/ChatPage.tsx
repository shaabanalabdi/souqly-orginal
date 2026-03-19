import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { chatsService } from '../services/chats.service';
import { asHttpError } from '../services/http';
import {
  connectChatSocket,
  emitTypingUpdated,
  joinThreadRoom,
  leaveThreadRoom,
  onChatSocketError,
  onMessageCreated,
  onOfferUpdated,
  onThreadCreated,
  onTypingUpdated,
} from '../services/socket';
import { useAuthStore } from '../store/authStore';
import type { ChatMessage, ContactRequestState, ThreadSummary } from '../types/domain';
import { formatDate } from '../utils/format';
import { useLocaleSwitch } from '../utils/localeSwitch';
import { Button, EmptyStatePanel, ErrorStatePanel, Input, LoadingState } from '../components/ui';

export function ChatPage() {
  const { pick } = useLocaleSwitch();
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState<'success' | 'error' | 'info'>('info');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingVisible, setTypingVisible] = useState(false);
  const [phoneRequestState, setPhoneRequestState] = useState<ContactRequestState | null>(null);

  const selectedThreadId = Number(searchParams.get('thread') ?? '0') || null;

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  const isBuyerInThread = Boolean(selectedThread && currentUser?.id === selectedThread.buyerId);
  const isSellerInThread = Boolean(selectedThread && currentUser?.id === selectedThread.sellerId);

  const loadThreads = async () => {
    setLoadingThreads(true);
    try {
      const result = await chatsService.listThreads(1, 30);
      setThreads(result.items);
      if (!selectedThreadId && result.items.length > 0) {
        setSearchParams({ thread: String(result.items[0].id) });
      }
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(asHttpError(error).message);
    } finally {
      setLoadingThreads(false);
    }
  };

  const loadMessages = async (threadId: number) => {
    setLoadingMessages(true);
    try {
      const result = await chatsService.listMessages(threadId, 1, 200);
      setMessages(result.items);
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(asHttpError(error).message);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadPhoneRequestState = async (threadId: number) => {
    try {
      const result = await chatsService.getPhoneRequestState(threadId);
      setPhoneRequestState(result);
    } catch {
      setPhoneRequestState(null);
    }
  };

  useEffect(() => {
    void loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      setPhoneRequestState(null);
      return;
    }

    void loadMessages(selectedThreadId);
    void loadPhoneRequestState(selectedThreadId);
  }, [selectedThreadId]);

  useEffect(() => {
    if (!accessToken) return;

    connectChatSocket(accessToken);

    const offThreadCreated = onThreadCreated((payload) => {
      setThreads((prev) => {
        const exists = prev.some((thread) => thread.id === payload.thread.id);
        if (exists) {
          return prev.map((thread) => (thread.id === payload.thread.id ? payload.thread : thread));
        }
        return [payload.thread, ...prev];
      });
    });

    const offMessageCreated = onMessageCreated((payload) => {
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === payload.threadId
            ? {
                ...thread,
                lastMessageAt: payload.message.createdAt,
                lastMessage: {
                  senderId: payload.message.senderId,
                  type: payload.message.type,
                  content: payload.message.content,
                  createdAt: payload.message.createdAt,
                },
              }
            : thread,
        ),
      );

      if (payload.threadId === selectedThreadId) {
        setMessages((prev) => {
          const exists = prev.some((message) => message.id === payload.message.id);
          if (exists) return prev;
          return [...prev, payload.message];
        });

        if (payload.message.type === 'PHONE_REQUEST' || payload.message.type === 'SYSTEM') {
          void loadPhoneRequestState(payload.threadId);
        }
      }
    });

    const offOfferUpdated = onOfferUpdated((payload) => {
      if (payload.threadId === selectedThreadId) {
        setStatusTone('info');
        setStatusMessage(pick('تم تحديث حالة العرض.', 'Offer status was updated.'));
      }
    });

    const offTypingUpdated = onTypingUpdated((payload) => {
      if (payload.threadId !== selectedThreadId) return;
      if (payload.userId !== selectedThread?.otherUserId) return;
      setTypingVisible(payload.isTyping);
    });

    const offSocketError = onChatSocketError((payload) => {
      setStatusTone('error');
      setStatusMessage(payload.code ? `Socket: ${payload.code}` : pick('تعذر تحديث المحادثة لحظيا.', 'Realtime sync failed.'));
    });

    return () => {
      offThreadCreated();
      offMessageCreated();
      offOfferUpdated();
      offTypingUpdated();
      offSocketError();
    };
  }, [accessToken, pick, selectedThread, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId) return;
    joinThreadRoom(selectedThreadId);
    return () => {
      emitTypingUpdated(selectedThreadId, false);
      leaveThreadRoom(selectedThreadId);
    };
  }, [selectedThreadId]);

  useEffect(() => {
    if (!accessToken || !selectedThreadId) return;

    const hasDraft = messageText.trim().length > 0;
    if (!hasDraft) {
      emitTypingUpdated(selectedThreadId, false);
      return;
    }

    emitTypingUpdated(selectedThreadId, true);
    const timer = window.setTimeout(() => {
      emitTypingUpdated(selectedThreadId, false);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [accessToken, messageText, selectedThreadId]);

  const sendTextMessage = async () => {
    if (!selectedThreadId || !messageText.trim()) return;
    try {
      await chatsService.sendMessage(selectedThreadId, { type: 'TEXT', content: messageText.trim() });
      setMessageText('');
      await loadMessages(selectedThreadId);
      await loadThreads();
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(asHttpError(error).message);
    }
  };

  const sendImageMessage = async () => {
    if (!selectedThreadId || !imageUrl.trim()) return;
    try {
      await chatsService.sendMessage(selectedThreadId, { type: 'IMAGE', imageUrl: imageUrl.trim() });
      setImageUrl('');
      await loadMessages(selectedThreadId);
      await loadThreads();
      setStatusTone('success');
      setStatusMessage(pick('تم إرسال الصورة.', 'Image sent.'));
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(asHttpError(error).message);
    }
  };

  const sendOffer = async () => {
    if (!selectedThreadId) return;
    const parsedAmount = Number(offerAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    try {
      await chatsService.createOffer(selectedThreadId, { amount: parsedAmount, quantity: 1 });
      setOfferAmount('');
      await loadMessages(selectedThreadId);
      setStatusTone('success');
      setStatusMessage(pick('تم إرسال العرض.', 'Offer sent.'));
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(asHttpError(error).message);
    }
  };

  const requestPhone = async () => {
    if (!selectedThreadId) return;
    try {
      await chatsService.requestPhone(
        selectedThreadId,
        pick('أحتاج رقم الهاتف لمتابعة التواصل.', 'I need the phone number to continue.'),
      );
      await loadMessages(selectedThreadId);
      await loadPhoneRequestState(selectedThreadId);
      setStatusTone('success');
      setStatusMessage(pick('تم إرسال طلب الهاتف.', 'Phone request sent.'));
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(asHttpError(error).message);
    }
  };

  const respondPhoneRequest = async (action: 'approve' | 'reject') => {
    if (!selectedThreadId) return;
    try {
      await chatsService.respondPhoneRequest(selectedThreadId, { action });
      await loadMessages(selectedThreadId);
      await loadPhoneRequestState(selectedThreadId);
      setStatusTone('success');
      setStatusMessage(
        action === 'approve'
          ? pick('تمت الموافقة على طلب الهاتف.', 'Phone request approved.')
          : pick('تم رفض طلب الهاتف.', 'Phone request rejected.'),
      );
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(asHttpError(error).message);
    }
  };

  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages],
  );

  const phoneRequestSummary = phoneRequestState?.status === 'PENDING'
    ? pick('طلب الهاتف قيد المراجعة.', 'Phone request is pending review.')
    : phoneRequestState?.status === 'APPROVED'
      ? pick('تمت الموافقة على إظهار بيانات التواصل.', 'Contact access has been approved.')
      : phoneRequestState?.status === 'REJECTED'
        ? pick('تم رفض طلب إظهار بيانات التواصل.', 'Contact access was rejected.')
        : '';

  return (
    <section className="grid min-h-[70vh] gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-soft lg:grid-cols-[320px_1fr]">
      <aside className="rounded-xl border border-slate-200 bg-surface p-3">
        <header className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-black text-ink">{pick('صندوق المحادثات', 'Inbox')}</h1>
          <Button variant="ghost" size="sm" onClick={() => void loadThreads()}>
            {pick('تحديث', 'Refresh')}
          </Button>
        </header>
        <div className="space-y-2">
          {loadingThreads ? (
            <LoadingState text={pick('جار تحميل المحادثات...', 'Loading inbox...')} />
          ) : threads.length === 0 ? (
            <EmptyStatePanel
              title={pick('لا توجد محادثات بعد', 'No conversations yet')}
              description={pick('عند بدء التراسل ستظهر المحادثات هنا.', 'Conversations will appear here once messaging starts.')}
            />
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setSearchParams({ thread: String(thread.id) })}
                className={`flex w-full items-center gap-3 rounded-xl p-2 text-start transition ${
                  thread.id === selectedThreadId ? 'bg-primary/10' : 'hover:bg-white'
                }`}
              >
                <div className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {thread.otherUserId}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{thread.listing.title}</p>
                  <p className="truncate text-xs text-muted">
                    {thread.lastMessage?.content || pick('لا توجد رسائل', 'No messages')}
                  </p>
                </div>
                {thread.unreadCount > 0 ? (
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                    {thread.unreadCount}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-h-[560px] flex-col rounded-xl border border-slate-200">
        {selectedThread ? (
          <>
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-ink">{selectedThread.listing.title}</p>
                <p className="text-xs text-muted">
                  #{selectedThread.id} • {selectedThread.lastMessageAt ? formatDate(selectedThread.lastMessageAt) : pick('بدون رسائل', 'No messages')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => void sendOffer()}>
                  {pick('إرسال عرض', 'Send Offer')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void requestPhone()}
                  disabled={!isBuyerInThread || phoneRequestState?.status === 'PENDING' || phoneRequestState?.status === 'APPROVED'}
                >
                  {pick('طلب الهاتف', 'Request Phone')}
                </Button>
                {isSellerInThread && phoneRequestState?.status === 'PENDING' ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => void respondPhoneRequest('approve')}>
                      {pick('موافقة', 'Approve')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void respondPhoneRequest('reject')}>
                      {pick('رفض', 'Reject')}
                    </Button>
                  </>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => void sendImageMessage()}>
                  {pick('إرسال صورة', 'Send Image')}
                </Button>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
              {loadingMessages ? <LoadingState text={pick('جار تحميل الرسائل...', 'Loading messages...')} /> : null}
              {phoneRequestSummary ? <p className="text-xs text-muted">{phoneRequestSummary}</p> : null}
              {orderedMessages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow ${
                    message.senderId === selectedThread.otherUserId
                      ? 'me-auto rounded-bl-md bg-white text-ink'
                      : 'ms-auto rounded-br-md bg-primary text-white'
                  }`}
                >
                  <p>{message.content || message.imageUrl || pick('رسالة بدون نص', 'Message without content')}</p>
                  <p className={`mt-1 text-[11px] ${message.senderId === selectedThread.otherUserId ? 'text-muted' : 'text-blue-100'}`}>
                    {formatDate(message.createdAt)}
                  </p>
                </article>
              ))}

              {typingVisible ? (
                <p className="text-xs text-muted">{pick('جار الكتابة...', 'Typing...')}</p>
              ) : null}
            </div>

            <footer className="space-y-2 border-t border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder={pick('اكتب رسالتك...', 'Write your message...')}
                  className="w-full"
                />
                <Button onClick={() => void sendTextMessage()} size="md" disabled={!messageText.trim()}>
                  {pick('إرسال', 'Send')}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="url"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder={pick('رابط الصورة', 'Image URL')}
                  className="h-10 w-full"
                />
                <Input
                  type="number"
                  value={offerAmount}
                  onChange={(event) => setOfferAmount(event.target.value)}
                  placeholder={pick('قيمة العرض', 'Offer amount')}
                  className="h-10 w-36"
                />
              </div>
              {statusMessage ? (
                statusTone === 'error' ? (
                  <ErrorStatePanel
                    title={pick('فشل في تنفيذ الإجراء', 'Action failed')}
                    message={statusMessage}
                  />
                ) : (
                  <p className="text-xs text-emerald-700">{statusMessage}</p>
                )
              ) : null}
            </footer>
          </>
        ) : (
          <div className="m-auto w-full max-w-md p-4">
            <EmptyState
              title={pick('لا توجد محادثة محددة', 'No Conversation Selected')}
              description={pick('اختر محادثة من القائمة لبدء التواصل.', 'Pick a conversation from inbox to start chatting.')}
            />
          </div>
        )}
      </section>
    </section>
  );
}
