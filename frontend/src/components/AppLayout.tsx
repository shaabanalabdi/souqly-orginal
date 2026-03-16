import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setDirection } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { chatsService } from '../services/chats.service';
import {
  connectChatSocket,
  disconnectChatSocket,
  onMessageCreated,
  onOfferUpdated,
  onPlatformNotification,
  onThreadCreated,
} from '../services/socket';
import { useChatMetaStore } from '../store/chatMetaStore';
import { useNotificationStore } from '../store/notificationStore';
import { formatDate } from '../utils/format';

const baseLinks = [
  { to: '/', label: 'Browse' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/listings/create', label: 'Post Listing', auth: true },
  { to: '/chats', label: 'Chats', auth: true },
  { to: '/deals', label: 'Deals', auth: true },
  { to: '/preferences', label: 'Preferences', auth: true },
  { to: '/subscriptions', label: 'Subscriptions', auth: true },
  { to: '/business-profile', label: 'Business Profile', auth: true },
  { to: '/craftsman-profile', label: 'Craftsman Profile', auth: true },
  { to: '/reports', label: 'Reports', auth: true },
  { to: '/admin', label: 'Admin', auth: true, admin: true },
] as Array<{ to: string; label: string; auth?: boolean; admin?: boolean }>;

export function AppLayout() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isLoading);
  const unreadCount = useChatMetaStore((state) => state.unreadCount);
  const setUnreadCount = useChatMetaStore((state) => state.setUnreadCount);
  const notifications = useNotificationStore((state) => state.items);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const clearNotifications = useNotificationStore((state) => state.clearNotifications);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const toastSeq = useRef(1);

  const isArabic = i18n.resolvedLanguage?.startsWith('ar') ?? i18n.language === 'ar';
  const isAdminOrModerator =
    user?.staffRole === 'ADMIN'
    || user?.staffRole === 'MODERATOR';
  const unreadNotificationsCount = useMemo(
    () => notifications.reduce((count, item) => count + (item.read ? 0 : 1), 0),
    [notifications],
  );

  const pushToast = useCallback((text: string) => {
    const id = toastSeq.current++;
    setToasts((prev) => [...prev, { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  const loadUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    try {
      const result = await chatsService.unreadCount();
      setUnreadCount(result.unreadCount);
    } catch {
      // ignore background errors in navbar unread polling
    }
  }, [isAuthenticated, setUnreadCount]);

  const toggleLanguage = () => {
    const nextLang = isArabic ? 'en' : 'ar';
    void i18n.changeLanguage(nextLang);
    setDirection(nextLang);
  };

  const handleLogout = async () => {
    await logout();
    clearNotifications();
    setUnreadCount(0);
    navigate('/');
  };

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !user?.id) {
      disconnectChatSocket();
      setUnreadCount(0);
      return;
    }

    connectChatSocket(accessToken);
    void loadUnreadCount();

    const unsubscribeThreadCreated = onThreadCreated(() => {
      addNotification({
        kind: 'thread_created',
        title: 'New conversation',
        body: 'A new chat thread was opened.',
      });
      void loadUnreadCount();
    });

    const unsubscribeMessageCreated = onMessageCreated((payload) => {
      if (payload.message.senderId !== user.id) {
        pushToast(`New message in thread #${payload.threadId}`);
        addNotification({
          kind: 'chat_message',
          title: `Thread #${payload.threadId}`,
          body: payload.message.content || payload.message.imageUrl || 'New message',
          threadId: payload.threadId,
        });
      }
      void loadUnreadCount();
    });

    const unsubscribeOfferUpdated = onOfferUpdated((payload) => {
      if (payload.offer.senderId !== user.id) {
        pushToast(`Offer update in thread #${payload.threadId}`);
        addNotification({
          kind: 'offer_update',
          title: `Offer update in thread #${payload.threadId}`,
          body: `Offer #${payload.offer.id} is now ${payload.offer.status}`,
          threadId: payload.threadId,
        });
      }
      void loadUnreadCount();
    });

    const unsubscribePlatformNotification = onPlatformNotification((payload) => {
      pushToast(payload.title);
      addNotification({
        kind: payload.kind,
        title: payload.title,
        body: payload.body,
        threadId: payload.threadId,
        link: payload.link,
        createdAt: payload.createdAt,
      });
    });

    return () => {
      unsubscribeThreadCreated();
      unsubscribeMessageCreated();
      unsubscribeOfferUpdated();
      unsubscribePlatformNotification();
      disconnectChatSocket();
    };
  }, [
    accessToken,
    addNotification,
    isAuthenticated,
    loadUnreadCount,
    pushToast,
    setUnreadCount,
    user?.id,
  ]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar__inner">
          <Link to="/" className="brand">
            {t('common.appName')}
          </Link>

          <nav className="nav-links">
            {baseLinks.map((link) => {
              if (link.auth && !isAuthenticated) return null;
              if (link.admin && !isAdminOrModerator) return null;

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
                >
                  {link.label}
                  {link.to === '/chats' && unreadCount > 0 ? (
                    <span className="nav-counter">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          <div className="topbar__actions">
            {isAuthenticated ? (
              <button
                type="button"
                className="button button--ghost notification-btn"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                Notifications
                {unreadNotificationsCount > 0 ? (
                  <span className="nav-counter">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            {user ? (
              <span className="badge badge--muted">
                {user.fullName ?? user.email ?? `User #${user.id}`} ({user.accountType} / {user.staffRole})
              </span>
            ) : null}
            <button type="button" className="button button--ghost" onClick={toggleLanguage}>
              {isArabic ? t('common.switchToEnglish') : t('common.switchToArabic')}
            </button>
            {!isAuthenticated ? (
              <>
                <Link to="/login" className="button button--ghost">
                  Login
                </Link>
                <Link to="/register" className="button button--primary">
                  Register
                </Link>
              </>
            ) : (
              <button
                type="button"
                className="button button--danger"
                onClick={handleLogout}
                disabled={isLoading}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container page">
        <Outlet />
      </main>

      {notificationsOpen ? (
        <section className="notification-panel card">
          <div className="card__header">
            <h3>Notifications</h3>
            <div className="button-row">
              <button type="button" className="button button--ghost" onClick={markAllAsRead}>
                Mark all read
              </button>
              <button type="button" className="button button--ghost" onClick={clearNotifications}>
                Clear
              </button>
            </div>
          </div>
          <div className="list">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={notification.read ? 'notification-item' : 'notification-item notification-item--unread'}
                onClick={() => {
                  markAsRead(notification.id);
                  setNotificationsOpen(false);
                  if (notification.threadId) {
                    navigate(`/chats?thread=${notification.threadId}`);
                  } else if (notification.link) {
                    navigate(notification.link);
                  }
                }}
              >
                <div className="row__title">{notification.title}</div>
                <div className="row__meta">{notification.body}</div>
                <div className="row__meta">{formatDate(notification.createdAt)}</div>
              </button>
            ))}
            {notifications.length === 0 ? <p className="muted-text">No notifications yet.</p> : null}
          </div>
        </section>
      ) : null}

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
}
