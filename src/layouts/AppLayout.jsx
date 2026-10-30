
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Activity,
  Building2,
  Users,
  ClipboardCheck,
  Fuel,
  Receipt,
  LogOut,
  Menu,
  X,
  Scale,
  ShieldCheck,
  Moon,
  Sun,
  FileSpreadsheet,
  BellRing,
  Check,
  MessageSquare,
  Banknote,
  ArrowLeftRight,
  Cable,
  LifeBuoy,
  KeyRound,
  BookOpen,
  Crown,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api';
import Brand from '../components/Brand';
import { useAuth } from '../features/auth/AuthContext';

const links = [
  ['/', 'Overview', Activity],
  ['/stations', 'Stations & branches', Building2],
  ['/team', 'People & invites', Users],
  ['/attendance', 'Attendance', ClipboardCheck],
  ['/inventory', 'Fuel inventory', Fuel],
  ['/advanced-operations', 'POS & integrations', Cable],
  ['/sales', 'Sales & reconciliation', Receipt],
  ['/controls', 'Tank & cash controls', Scale],
  ['/governance', 'Audit & disputes', ShieldCheck],
  ['/reports', 'Financial reports', FileSpreadsheet],
  ['/payroll', 'Payroll & branch expenses', Banknote],
  ['/accountability', 'Money handovers', ArrowLeftRight],
  ['/alerts', 'Operational alerts', BellRing],
  ['/messages', 'Staff messages', MessageSquare],
  ['/company-settings', 'Company settings', Building2],
  ['/support', 'Support & FAQs', LifeBuoy],
  ['/account-security', 'Account security', KeyRound],
];

const managerRoutes = new Set([
  '/',
  '/stations',
  '/team',
  '/attendance',
  '/inventory',
  '/advanced-operations',
  '/sales',
  '/controls',
  '/governance',
  '/payroll',
  '/accountability',
  '/alerts',
  '/messages',
  '/support',
  '/account-security',
]);

const attendantRoutes = new Set([
  '/',
  '/attendance',
  '/sales',
  '/controls',
  '/advanced-operations',
  '/accountability',
  '/support',
  '/account-security',
]);

const generalRoutes = new Set([
  '/',
  '/stations',
  '/support',
  '/account-security',
]);

function readTheme() {
  try {
    return localStorage.getItem('hysmart-theme') === 'dark'
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

function isCreatorPath(pathname) {
  return (
    pathname === '/creator' ||
    pathname.startsWith('/creator/')
  );
}

export default function AppLayout() {
  const { user, session, signOut } = useAuth();
  const location = useLocation();
  const nav = useNavigate();

  const [open, setOpen] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [theme, setTheme] = useState(readTheme);
  const [workspace, setWorkspace] = useState(null);

  const [isCreatorAdmin, setIsCreatorAdmin] = useState(false);
  const [creatorAccessChecked, setCreatorAccessChecked] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationError, setNotificationError] = useState('');

  const [directMessageEmailEnabled, setDirectMessageEmailEnabled] =
    useState(false);
  const [savingEmailPreference, setSavingEmailPreference] = useState(false);
  const [emailPreferenceNotice, setEmailPreferenceNotice] = useState('');

  const creatorRoute = isCreatorPath(location.pathname);

  useEffect(() => {
    const onOnline = () => setNetworkOnline(true);
    const onOffline = () => setNetworkOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Load the signed-in user's company and branch workspace.
  useEffect(() => {
    if (!session?.access_token) {
      setWorkspace(null);
      return;
    }

    let alive = true;

    apiRequest('/me', { token: session.access_token })
      .then((data) => {
        if (!alive) return;

        setWorkspace(data);

        const currency =
          data?.companies?.[0]?.companies?.currency ||
          data?.stations?.[0]?.company_currency ||
          'NGN';

        try {
          localStorage.setItem('hysmart-company-currency', currency);
        } catch {
          // Storage may be unavailable; workspace remains usable.
        }
      })
      .catch(() => {
        if (alive) setWorkspace(null);
      });

    return () => {
      alive = false;
    };
  }, [session]);

  // IMPORTANT:
  // Only check App Creator Administrator access when a user visits
  // the dedicated /creator area. Ordinary company users no longer
  // receive an unnecessary GET /api/creator/access request.
  //
  // The backend remains responsible for enforcing authorization.
  useEffect(() => {
    let alive = true;

    if (!session?.access_token || !creatorRoute) {
      setIsCreatorAdmin(false);
      setCreatorAccessChecked(false);
      return () => {
        alive = false;
      };
    }

    setIsCreatorAdmin(false);
    setCreatorAccessChecked(false);

    apiRequest('/creator/access', {
      token: session.access_token,
    })
      .then((data) => {
        if (!alive) return;

        setIsCreatorAdmin(data?.isCreatorAdmin === true);
        setCreatorAccessChecked(true);
      })
      .catch(() => {
        if (!alive) return;

        setIsCreatorAdmin(false);
        setCreatorAccessChecked(true);
      });

    return () => {
      alive = false;
    };
  }, [session, creatorRoute]);

  // Keep currency in sync with changes elsewhere in the application.
  useEffect(() => {
    if (!session?.access_token) return undefined;

    let alive = true;

    const refreshCurrency = () => {
      apiRequest('/me', { token: session.access_token })
        .then((data) => {
          if (!alive) return;

          setWorkspace(data);

          const currency =
            data?.companies?.[0]?.companies?.currency ||
            data?.stations?.[0]?.company_currency ||
            'NGN';

          try {
            localStorage.setItem('hysmart-company-currency', currency);
          } catch {
            // Do not interrupt the application if storage is unavailable.
          }
        })
        .catch(() => {
          // Preserve the current workspace if a refresh fails.
        });
    };

    window.addEventListener('hysmart:currency-updated', refreshCurrency);

    return () => {
      alive = false;
      window.removeEventListener(
        'hysmart:currency-updated',
        refreshCurrency
      );
    };
  }, [session]);

  // Load the user's optional direct-message email preference.
  useEffect(() => {
    if (!session?.access_token) {
      setDirectMessageEmailEnabled(false);
      return undefined;
    }

    let alive = true;

    apiRequest('/notifications/direct-message-email-preference', {
      token: session.access_token,
    })
      .then((data) => {
        if (alive) {
          setDirectMessageEmailEnabled(Boolean(data.enabled));
        }
      })
      .catch(() => {
        // Preference loading must not prevent dashboard access.
      });

    return () => {
      alive = false;
    };
  }, [session]);

  async function updateDirectMessageEmailPreference(enabled) {
    if (!session?.access_token) return;

    setSavingEmailPreference(true);
    setEmailPreferenceNotice('');

    try {
      const data = await apiRequest(
        '/notifications/direct-message-email-preference',
        {
          token: session.access_token,
          method: 'PUT',
          body: { enabled },
        }
      );

      setDirectMessageEmailEnabled(Boolean(data.enabled));
      setEmailPreferenceNotice(
        enabled
          ? 'Email copies enabled.'
          : 'Email copies disabled; in-app messages remain on.'
      );
    } catch (error) {
      setEmailPreferenceNotice(
        error.message || 'Could not save email preference.'
      );
    } finally {
      setSavingEmailPreference(false);
    }
  }

  // Refresh notifications periodically and on application events.
  useEffect(() => {
    if (!session?.access_token) {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationError('');
      return undefined;
    }

    let alive = true;

    const loadInbox = async () => {
      try {
        const data = await apiRequest('/notifications/inbox', {
          token: session.access_token,
        });

        if (!alive) return;

        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setNotificationError('');
      } catch (error) {
        if (alive) {
          setNotificationError(
            error.message || 'Notifications are unavailable.'
          );
        }
      }
    };

    loadInbox();

    const timer = window.setInterval(loadInbox, 30000);
    const refresh = () => loadInbox();

    window.addEventListener('hysmart:notifications-refresh', refresh);

    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener(
        'hysmart:notifications-refresh',
        refresh
      );
    };
  }, [session]);

  // Apply the selected theme.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem('hysmart-theme', theme);
    } catch {
      // Theme still applies for the current session.
    }
  }, [theme]);

  const isOwner = Boolean(
    workspace?.companies?.some((company) =>
      ['COMPANY_OWNER', 'COMPANY_ADMIN', 'COMPANY_DIRECTOR'].includes(
        company.role
      )
    )
  );

  const activeStationRoles = (workspace?.stationMemberships || [])
    .filter((member) => member.status === 'active')
    .map((member) => member.role);

  const stationRole = activeStationRoles.includes('STATION_MANAGER')
    ? 'STATION_MANAGER'
    : activeStationRoles.includes('ATTENDANT')
      ? 'ATTENDANT'
      : null;

  const visibleLinks = useMemo(() => {
    let base;

    if (isOwner) {
      base = [
        ...links,
        ['/user-guide/owner', 'Owner user guide', BookOpen],
      ];
    } else if (stationRole === 'STATION_MANAGER') {
      base = [
        ...links.filter(([to]) => managerRoutes.has(to)),
        ['/user-guide/manager', 'Manager user guide', BookOpen],
      ];
    } else if (stationRole === 'ATTENDANT') {
      base = [
        ...links.filter(([to]) => attendantRoutes.has(to)),
        ['/user-guide/attendant', 'Attendant user manual', BookOpen],
      ];
    } else {
      base = [
        ...links.filter(([to]) => generalRoutes.has(to)),
        ['/user-guide', 'User guide', BookOpen],
      ];
    }

    return isCreatorAdmin
      ? [['/creator', 'Creator Administrator', Crown], ...base]
      : base;
  }, [isOwner, stationRole, isCreatorAdmin]);

  async function logout() {
    await signOut();
    nav('/login', { replace: true });
  }

  async function openNotification(item) {
    try {
      if (!item.read_at) {
        await apiRequest(`/notifications/inbox/${item.id}/read`, {
          token: session.access_token,
          method: 'PATCH',
        });

        setNotifications((rows) =>
          rows.map((row) =>
            row.id === item.id
              ? { ...row, read_at: new Date().toISOString() }
              : row
          )
        );

        setUnreadCount((count) => Math.max(0, count - 1));
      }
    } catch (error) {
      setNotificationError(
        error.message || 'Unable to mark notification as read.'
      );
    }

    setNotificationsOpen(false);
    nav(item.action_path || '/alerts');
  }

  async function acknowledgeNotification(item) {
    try {
      const result = await apiRequest(
        `/notifications/inbox/${item.id}/acknowledge`,
        {
          token: session.access_token,
          method: 'POST',
        }
      );

      setNotifications((rows) =>
        rows.map((row) =>
          row.id === item.id
            ? {
                ...row,
                acknowledged_at:
                  result.acknowledgedAt || new Date().toISOString(),
              }
            : row
        )
      );

      setNotificationError('');
    } catch (error) {
      setNotificationError(
        error.message || 'Unable to acknowledge this message.'
      );
    }
  }

  async function markAllRead() {
    const unread = notifications.filter((item) => !item.read_at);
    const markedAt = new Date().toISOString();
    const successfulIds = new Set();
    const failures = [];

    for (const item of unread) {
      try {
        await apiRequest(`/notifications/inbox/${item.id}/read`, {
          token: session.access_token,
          method: 'PATCH',
        });

        successfulIds.add(item.id);
      } catch (error) {
        failures.push(error);
      }
    }

    setNotifications((rows) =>
      rows.map((row) =>
        successfulIds.has(row.id)
          ? { ...row, read_at: row.read_at || markedAt }
          : row
      )
    );

    setUnreadCount((count) =>
      Math.max(0, count - successfulIds.size)
    );

    if (failures.length) {
      setNotificationError(
        `Marked ${successfulIds.size} of ${unread.length} notifications as read. ${
          failures[0].message ||
          'Some notifications could not be updated.'
        }`
      );
    } else {
      setNotificationError('');
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <Brand />

        <div className="side-caption">WORKSPACE</div>

        <nav>
          {visibleLinks.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="theme-toggle"
            onClick={() =>
              setTheme((current) =>
                current === 'dark' ? 'light' : 'dark'
              )
            }
            aria-label={`Switch to ${
              theme === 'dark' ? 'light' : 'dark'
            } theme`}
          >
            <span>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              {theme === 'dark'
                ? 'Light appearance'
                : 'Dark appearance'}
            </span>

            <span
              className={`toggle-track ${
                theme === 'dark' ? 'toggle-on' : ''
              }`}
            >
              <i />
            </span>
          </button>

          <div className="user-chip">
            <span className="avatar">
              {(user?.email || 'U')[0].toUpperCase()}
            </span>

            <span className="user-meta">
              <b>{user?.user_metadata?.full_name || 'Workspace user'}</b>
              <small>{user?.email || user?.phone || 'Signed in'}</small>
            </span>
          </div>

          <button className="nav-logout" onClick={logout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-area">
        {!networkOnline && <div role="status" aria-live="polite" style={{ margin: '12px 20px 0', padding: '11px 14px', border: '1px solid #e3c98c', borderRadius: 10, background: '#fff8e7', color: '#72551a', fontSize: 12, lineHeight: 1.5 }}><strong>You are offline.</strong> The app shell may remain available, but server data and most operations require internet. Only meter readings in Sales & Reconciliation can be queued locally; they remain pending until the server accepts them.</div>}
        <div className="notification-center-anchor">
          <button
            className="notification-center-trigger"
            onClick={() =>
              setNotificationsOpen((current) => !current)
            }
            aria-label={`Notifications, ${unreadCount} unread`}
            aria-expanded={notificationsOpen}
          >
            <BellRing size={20} />
            {unreadCount > 0 && (
              <span className="notification-count">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <section
              className="notification-popover"
              aria-label="Notification centre"
            >
              <div className="notification-popover-heading">
                <div>
                  <b>Notifications</b>
                  <small>{unreadCount} unread</small>
                </div>

                <div className="notification-popover-actions">
                  <button
                    onClick={markAllRead}
                    disabled={!unreadCount}
                    title="Mark all as read"
                    aria-label="Mark all as read"
                  >
                    <Check size={16} />
                  </button>

                  <button
                    onClick={() => setNotificationsOpen(false)}
                    title="Close notifications"
                    aria-label="Close notifications"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {notificationError && (
                <p className="notification-error" role="status">
                  {notificationError}
                </p>
              )}

              {notifications.length ? (
                <div className="notification-list">
                  {notifications.map((item) => (
                    <article
                      key={item.id}
                      className={`notification-item ${
                        item.read_at ? '' : 'notification-unread'
                      }`}
                    >
                      <span
                        className={`notification-severity severity-${
                          item.severity || 'info'
                        }`}
                      />

                      <div className="notification-item-copy">
                        <button
                          className="notification-open-message"
                          onClick={() => openNotification(item)}
                        >
                          <b>{item.title}</b>
                          <span>{item.message}</span>
                        </button>

                        <small>
                          {new Date(item.created_at).toLocaleString()}
                        </small>

                        {item.requires_acknowledgement && (
                          <div className="notification-ack-row">
                            {item.acknowledged_at ? (
                              <span className="status-pill status-success">
                                Acknowledged
                              </span>
                            ) : (
                              <button
                                className="btn btn-primary notification-ack-btn"
                                onClick={() =>
                                  acknowledgeNotification(item)
                                }
                              >
                                Acknowledge instruction
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {!item.read_at && (
                        <i className="notification-unread-dot" />
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="notification-empty">
                  <BellRing size={22} />
                  <b>You're all caught up</b>
                  <span>
                    New operational messages will appear here.
                  </span>
                </div>
              )}

              <div className="notification-email-setting">
                <label>
                  <input
                    type="checkbox"
                    checked={directMessageEmailEnabled}
                    disabled={savingEmailPreference}
                    onChange={(event) =>
                      updateDirectMessageEmailPreference(
                        event.target.checked
                      )
                    }
                  />

                  <span>
                    <b>Email copies of staff messages</b>
                    <small>
                      Optional; messages always appear here.
                    </small>
                  </span>
                </label>

                {emailPreferenceNotice && (
                  <small role="status">{emailPreferenceNotice}</small>
                )}
              </div>

              <button
                className="notification-view-all"
                onClick={() => {
                  setNotificationsOpen(false);
                  nav('/alerts');
                }}
              >
                View operational alerts
              </button>
            </section>
          )}
        </div>

        <header className="mobile-top">
          <button
            className="icon-btn"
            onClick={() => setOpen((current) => !current)}
            aria-label="Toggle menu"
          >
            {open ? <X /> : <Menu />}
          </button>

          <Brand />

          <button
            className="icon-btn"
            onClick={() =>
              setTheme((current) =>
                current === 'dark' ? 'light' : 'dark'
              )
            }
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>
        </header>

        <div className="page-content">
          {creatorRoute &&
          !creatorAccessChecked &&
          session?.access_token ? (
            <div className="page-loading" role="status">
              Checking Creator Administrator access…
            </div>
          ) : creatorRoute && !isCreatorAdmin ? (
            <section className="page-content">
              <div className="notification-error" role="alert">
                You do not have permission to access the App Creator
                Administrator console.
              </div>
              <button
                className="btn btn-primary"
                onClick={() => nav('/', { replace: true })}
              >
                Return to company workspace
              </button>
            </section>
          ) : (
            <Outlet />
          )}
        </div>

        <footer className="app-footer">
          HySmart Station <span>•</span> Keep every shift accountable.
        </footer>
      </main>

      {open && (
        <button
          className="scrim"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
