import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { chatsService } from '../services/chats.service';
import { asHttpError } from '../services/http';
import type { ChatMessage, ThreadSummary } from '../types/domain';
import { formatDate } from '../utils/format';
import { useLocaleSwitch } from '../utils/localeSwitch';

export function ChatPage() {
  const { pick } = useLocaleSwitch();
  const [searchParams, setSearchParams] = useSearchParams();

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const selectedThreadId = Number(searchParams.get('thread') ?? '0') || null;

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  const loadThreads = async () => {
    setLoadingThreads(true);
    try {
      const result = await chatsService.listThreads(1, 30);
      setThreads(result.items);
      if (!selectedThreadId && result.items.length > 0) {
        setSearchParams({ thread: String(result.items[0].id) });
      }
    } catch (error) {
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
      setStatusMessage(asHttpError(error).message);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    void loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedThreadId);
  }, [selectedThreadId]);

  const sendTextMessage = async () => {
    if (!selectedThreadId || !messageText.trim()) return;
    try {
      await chatsService.sendMessage(selectedThreadId, { type: 'TEXT', content: messageText.trim() });
      setMessageText('');
      await loadMessages(selectedThreadId);
      await loadThreads();
    } catch (error) {
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
    } catch (error) {
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
      setStatusMessage(pick('تم إرسال العرض.', 'Offer sent.'));
    } catch (error) {
      setStatusMessage(asHttpError(error).message);
    }
  };

  const requestPhone = async () => {
    if (!selectedThreadId) return;
    try {
      await chatsService.requestPhone(selectedThreadId, pick('أحتاج رقم الهاتف للتواصل.', 'I need phone number to continue.'));
      await loadMessages(selectedThreadId);
      setStatusMessage(pick('تم إرسال طلب الهاتف.', 'Phone request sent.'));
    } catch (error) {
      setStatusMessage(asHttpError(error).message);
    }
  };

  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages],
  );

  return (
    <section className="grid min-h-[70vh] gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-soft lg:grid-cols-[320px_1fr]">
      <aside className="rounded-xl border border-slate-200 bg-surface p-3">
        <header className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-black text-ink">{pick('صندوق المحادثات', 'Inbox')}</h1>
          <button
            type="button"
            onClick={() => void loadThreads()}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold hover:bg-slate-50"
          >
            {pick('تحديث', 'Refresh')}
          </button>
        </header>
        <div className="space-y-2">
          {loadingThreads ? (
            <p className="text-sm text-muted">{pick('جارٍ التحميل...', 'Loading...')}</p>
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
                <button
                  type="button"
                  onClick={() => void sendOffer()}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                >
                  {pick('إرسال عرض', 'Send Offer')}
                </button>
                <button
                  type="button"
                  onClick={() => void requestPhone()}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                >
                  {pick('طلب الهاتف', 'Request Phone')}
                </button>
                <button
                  type="button"
                  onClick={() => void sendImageMessage()}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                >
                  {pick('إرسال صورة', 'Send Image')}
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
              {loadingMessages ? <p className="text-sm text-muted">{pick('جارٍ تحميل الرسائل...', 'Loading messages...')}</p> : null}
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
            </div>

            <footer className="space-y-2 border-t border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder={pick('اكتب رسالتك...', 'Write your message...')}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-primary focus:ring-2"
                />
                <button
                  type="button"
                  onClick={() => void sendTextMessage()}
                  className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-blue-900"
                >
                  {pick('إرسال', 'Send')}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder={pick('رابط الصورة', 'Image URL')}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                />
                <input
                  type="number"
                  value={offerAmount}
                  onChange={(event) => setOfferAmount(event.target.value)}
                  placeholder={pick('قيمة العرض', 'Offer amount')}
                  className="h-10 w-36 rounded-xl border border-slate-200 px-3 text-sm"
                />
              </div>
              {statusMessage ? <p className="text-xs text-emerald-700">{statusMessage}</p> : null}
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
