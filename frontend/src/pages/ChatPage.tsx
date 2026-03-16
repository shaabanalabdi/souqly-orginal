import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { chatsService } from '../services/chats.service';
import { asHttpError } from '../services/http';
import {
  connectChatSocket,
  joinThreadRoom,
  leaveThreadRoom,
  onChatSocketError,
  onMessageCreated,
  onOfferUpdated,
  onThreadCreated,
} from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useChatMetaStore } from '../store/chatMetaStore';
import { useNotificationStore } from '../store/notificationStore';
import type { ChatMessage, ThreadSummary } from '../types/domain';
import { parseOfferSystemMessage } from '../utils/chat';
import { formatDate } from '../utils/format';

type OfferAction = 'accept' | 'reject' | 'counter';

function upsertMessage(messages: ChatMessage[], nextMessage: ChatMessage): ChatMessage[] {
  const index = messages.findIndex((message) => message.id === nextMessage.id);
  if (index >= 0) {
    const cloned = [...messages];
    cloned[index] = nextMessage;
    return cloned;
  }

  return [...messages, nextMessage];
}

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserId = useAuthStore((state) => state.user?.id ?? 0);
  const accessToken = useAuthStore((state) => state.accessToken);
  const setUnreadCount = useChatMetaStore((state) => state.setUnreadCount);
  const markThreadAsRead = useNotificationStore((state) => state.markThreadAsRead);

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerQuantity, setOfferQuantity] = useState('1');
  const [offerMessage, setOfferMessage] = useState('');
  const [phoneMessage, setPhoneMessage] = useState('');
  const [offerIdToRespond, setOfferIdToRespond] = useState('');
  const [offerAction, setOfferAction] = useState<OfferAction>('accept');
  const [counterAmount, setCounterAmount] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedThreadId = useMemo(() => {
    const raw = searchParams.get('thread');
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [searchParams]);

  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages],
  );
  const selectedThreadIdRef = useRef<number | null>(selectedThreadId);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    setError(null);
    try {
      const result = await chatsService.listThreads();
      setThreads(result.items);
      setUnreadCount(result.items.reduce((count, thread) => count + thread.unreadCount, 0));

      if (!selectedThreadId && result.items.length > 0) {
        setSearchParams({ thread: String(result.items[0].id) });
      }
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoadingThreads(false);
    }
  }, [selectedThreadId, setSearchParams, setUnreadCount]);

  const loadMessages = useCallback(async (threadId: number) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const result = await chatsService.listMessages(threadId, 1, 100);
      setMessages(result.items);
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    void (async () => {
      await loadMessages(selectedThreadId);
      await loadThreads();
    })();
    markThreadAsRead(selectedThreadId);
  }, [selectedThreadId, loadMessages, loadThreads, markThreadAsRead]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    connectChatSocket(accessToken);

    const unsubscribeThreadCreated = onThreadCreated(() => {
      void loadThreads();
    });

    const unsubscribeMessageCreated = onMessageCreated((payload) => {
      void loadThreads();

      if (selectedThreadIdRef.current && payload.threadId === selectedThreadIdRef.current) {
        setMessages((prev) => upsertMessage(prev, payload.message));
      }
    });

    const unsubscribeOfferUpdated = onOfferUpdated((payload) => {
      void loadThreads();
      if (selectedThreadIdRef.current && payload.threadId === selectedThreadIdRef.current) {
        void loadMessages(selectedThreadIdRef.current);
      }
    });

    const unsubscribeSocketError = onChatSocketError((payload) => {
      if (payload.code) {
        setStatusMessage(`Socket warning: ${payload.code}`);
      }
    });

    return () => {
      unsubscribeThreadCreated();
      unsubscribeMessageCreated();
      unsubscribeOfferUpdated();
      unsubscribeSocketError();
    };
  }, [accessToken, loadMessages, loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) {
      return;
    }

    joinThreadRoom(selectedThreadId);
    return () => {
      leaveThreadRoom(selectedThreadId);
    };
  }, [selectedThreadId]);

  const sendTextMessage = async () => {
    if (!selectedThreadId || !messageText.trim()) return;
    setStatusMessage(null);
    try {
      await chatsService.sendMessage(selectedThreadId, { type: 'TEXT', content: messageText.trim() });
      setMessageText('');
      await loadMessages(selectedThreadId);
      await loadThreads();
    } catch (err) {
      setStatusMessage(asHttpError(err).message);
    }
  };

  const sendImageMessage = async () => {
    if (!selectedThreadId || !imageUrl.trim()) return;
    setStatusMessage(null);
    try {
      await chatsService.sendMessage(selectedThreadId, { type: 'IMAGE', imageUrl: imageUrl.trim() });
      setImageUrl('');
      await loadMessages(selectedThreadId);
      await loadThreads();
    } catch (err) {
      setStatusMessage(asHttpError(err).message);
    }
  };

  const sendOffer = async () => {
    if (!selectedThreadId) return;
    const amount = Number(offerAmount);
    const quantity = Number(offerQuantity);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(quantity) || quantity <= 0) return;

    setStatusMessage(null);
    try {
      const offer = await chatsService.createOffer(selectedThreadId, {
        amount,
        quantity,
        message: offerMessage || undefined,
      });
      setOfferIdToRespond(String(offer.id));
      setOfferAmount('');
      setOfferQuantity('1');
      setOfferMessage('');
      await loadMessages(selectedThreadId);
      await loadThreads();
      setStatusMessage(`Offer #${offer.id} created.`);
    } catch (err) {
      setStatusMessage(asHttpError(err).message);
    }
  };

  const requestPhone = async () => {
    if (!selectedThreadId) return;
    setStatusMessage(null);
    try {
      await chatsService.requestPhone(selectedThreadId, phoneMessage || undefined);
      setPhoneMessage('');
      await loadMessages(selectedThreadId);
      await loadThreads();
    } catch (err) {
      setStatusMessage(asHttpError(err).message);
    }
  };

  const respondToOffer = async () => {
    const offerId = Number(offerIdToRespond);
    if (!Number.isFinite(offerId) || offerId <= 0) return;

    setStatusMessage(null);
    try {
      await chatsService.respondOffer(offerId, {
        action: offerAction,
        counterAmount: offerAction === 'counter' ? Number(counterAmount) || undefined : undefined,
      });
      setCounterAmount('');
      if (selectedThreadId) {
        await loadMessages(selectedThreadId);
        await loadThreads();
      }
      setStatusMessage(`Offer #${offerId} updated.`);
    } catch (err) {
      setStatusMessage(asHttpError(err).message);
    }
  };

  return (
    <div className="stack">
      <h1 className="page-title">Chats</h1>
      <p className="page-subtitle">Threads, messages, offers, and phone requests in realtime.</p>

      {error ? <p className="error-text">{error}</p> : null}
      {statusMessage ? <p className="muted-text">{statusMessage}</p> : null}

      <section className="split">
        <aside className="split__aside card">
          <div className="card__header">
            <h2>Threads</h2>
            <button type="button" className="button button--ghost" onClick={() => void loadThreads()} disabled={loadingThreads}>
              Refresh
            </button>
          </div>

          <div className="list">
            {threads.map((thread) => (
              <button
                type="button"
                key={thread.id}
                className={selectedThreadId === thread.id ? 'thread-item thread-item--active' : 'thread-item'}
                onClick={() => setSearchParams({ thread: String(thread.id) })}
              >
                <div className="row__title">
                  {thread.listing.title}
                  {thread.unreadCount > 0 ? <span className="thread-counter">{thread.unreadCount}</span> : null}
                </div>
                <div className="row__meta">
                  Last: {thread.lastMessage?.content ?? 'No message yet'} - {formatDate(thread.lastMessageAt)}
                </div>
              </button>
            ))}
            {!loadingThreads && threads.length === 0 ? <p className="muted-text">No threads yet.</p> : null}
          </div>
        </aside>

        <section className="split__main card">
          <div className="card__header">
            <h2>Messages</h2>
            <span className="muted-text">{selectedThreadId ? `Thread #${selectedThreadId}` : 'No thread selected'}</span>
          </div>

          <div className="messages">
            {loadingMessages ? <p className="muted-text">Loading messages...</p> : null}
            {orderedMessages.map((message) => {
              const isOwn = message.senderId === currentUserId;
              const offerMessage = message.type === 'OFFER' ? parseOfferSystemMessage(message.content) : null;

              return (
                <article key={message.id} className={isOwn ? 'message message--own' : 'message'}>
                  <div className="row__meta">
                    #{message.id} - {message.type} - {formatDate(message.createdAt)}
                  </div>
                  {offerMessage ? (
                    <div>
                      Offer #{offerMessage.offerId}: amount {offerMessage.amount} x {offerMessage.quantity} ({offerMessage.status})
                    </div>
                  ) : (
                    <div>{message.content || message.imageUrl || '-'}</div>
                  )}
                </article>
              );
            })}
            {!loadingMessages && orderedMessages.length === 0 ? <p className="muted-text">No messages yet.</p> : null}
          </div>

          <div className="grid grid--2" style={{ marginTop: '0.8rem' }}>
            <div className="card">
              <h3>Send Message</h3>
              <div className="stack">
                <label className="field">
                  <span className="label">Text message</span>
                  <input className="input" value={messageText} onChange={(event) => setMessageText(event.target.value)} />
                </label>
                <div className="button-row">
                  <button type="button" className="button button--primary" onClick={sendTextMessage} disabled={!selectedThreadId}>
                    Send text
                  </button>
                </div>

                <label className="field">
                  <span className="label">Image URL</span>
                  <input className="input" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
                </label>
                <div className="button-row">
                  <button type="button" className="button button--secondary" onClick={sendImageMessage} disabled={!selectedThreadId}>
                    Send image
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>Negotiation Tools</h3>
              <div className="stack">
                <label className="field">
                  <span className="label">Offer amount</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={offerAmount}
                    onChange={(event) => setOfferAmount(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">Offer quantity</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={offerQuantity}
                    onChange={(event) => setOfferQuantity(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">Offer message</span>
                  <input
                    className="input"
                    value={offerMessage}
                    onChange={(event) => setOfferMessage(event.target.value)}
                  />
                </label>
                <div className="button-row">
                  <button type="button" className="button button--warning" onClick={sendOffer} disabled={!selectedThreadId}>
                    Send offer
                  </button>
                </div>

                <label className="field">
                  <span className="label">Phone request note</span>
                  <input
                    className="input"
                    value={phoneMessage}
                    onChange={(event) => setPhoneMessage(event.target.value)}
                  />
                </label>
                <div className="button-row">
                  <button type="button" className="button button--secondary" onClick={requestPhone} disabled={!selectedThreadId}>
                    Request phone
                  </button>
                </div>

                <hr />

                <label className="field">
                  <span className="label">Offer ID</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={offerIdToRespond}
                    onChange={(event) => setOfferIdToRespond(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">Action</span>
                  <select
                    className="select"
                    value={offerAction}
                    onChange={(event) => setOfferAction(event.target.value as OfferAction)}
                  >
                    <option value="accept">accept</option>
                    <option value="reject">reject</option>
                    <option value="counter">counter</option>
                  </select>
                </label>
                {offerAction === 'counter' ? (
                  <label className="field">
                    <span className="label">Counter amount</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={counterAmount}
                      onChange={(event) => setCounterAmount(event.target.value)}
                    />
                  </label>
                ) : null}
                <div className="button-row">
                  <button type="button" className="button button--danger" onClick={respondToOffer}>
                    Respond offer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
