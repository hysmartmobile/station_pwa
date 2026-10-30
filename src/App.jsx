
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LockKeyhole, ShieldCheck, ShieldAlert } from 'lucide-react';

import { useAuth } from './features/auth/AuthContext';
import AppLayout from './layouts/AppLayout';

import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AccountSecurityPage from './pages/AccountSecurityPage';
import InvitePage from './pages/InvitePage';
import OverviewPage from './pages/OverviewPage';
import StationsPage from './pages/StationsPage';
import TeamPage from './pages/TeamPage';
import AttendancePage from './pages/AttendancePage';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import ControlsPage from './pages/ControlsPage';
import CompanySetupPage from './pages/CompanySetupPage';
import GettingStartedPage from './pages/GettingStartedPage';
import UserGuidePage from './pages/UserGuidePage';
import GovernancePage from './pages/GovernancePage';
import BillingPage from './pages/BillingPage';
import ReportsPage from './pages/ReportsPage';
import PayrollPage from './pages/PayrollPage';
import AccountabilityPage from './pages/AccountabilityPage';
import AlertsPage from './pages/AlertsPage';
import MessagesPage from './pages/MessagesPage';
import Notice from './components/Notice';
import InstallAppButton from './components/InstallAppButton';
import AdvancedOperationsPage from './pages/AdvancedOperationsPage';
import CompanySettingsPage from './pages/CompanySettingsPage';
import SupportPage from './pages/SupportPage';
import CreatorDashboardPage from './pages/CreatorDashboardPage';

import { apiRequest } from './lib/api';

/**
 * Authentication guard.
 * Protects application routes without granting any additional permissions.
 */
function Protected() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen" role="status">
        Loading secure workspace…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

/**
 * Creator Administrator guard.
 *
 * This API check runs only when the dedicated /creator route is opened.
 * Company owners, directors, managers and attendants do not need
 * Creator Administrator access to use their ordinary dashboards.
 *
 * Backend authorization remains mandatory.
 */
function CreatorProtected() {
  const { session, loading: authLoading } = useAuth();

  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let alive = true;

    if (authLoading) {
      return () => {
        alive = false;
      };
    }

    if (!session?.access_token) {
      setStatus('unauthenticated');

      return () => {
        alive = false;
      };
    }

    setStatus('checking');

    apiRequest('/creator/access', {
      token: session.access_token,
    })
      .then((result) => {
        if (!alive) return;

        // Support either the unwrapped API response or { data: {...} }.
        const access = result?.data ?? result;

        setStatus(
          access?.isCreatorAdmin === true
            ? 'authorized'
            : 'denied'
        );
      })
      .catch(() => {
        if (alive) {
          // A 403, unavailable endpoint, or failed access check must
          // never grant access to the creator dashboard.
          setStatus('denied');
        }
      });

    return () => {
      alive = false;
    };
  }, [session?.access_token, authLoading]);

  if (authLoading || status === 'checking') {
    return (
      <div className="loading-screen" role="status">
        Verifying Creator Administrator access…
      </div>
    );
  }

  if (!session || status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (status !== 'authorized') {
    return (
      <main className="page-content">
        <section
          className="upgrade-modal"
          role="alert"
          aria-labelledby="creator-access-denied-title"
        >
          <span className="upgrade-icon">
            <ShieldAlert size={24} />
          </span>

          <h1 id="creator-access-denied-title">
            Creator Administrator access required
          </h1>

          <p>
            This area is reserved for authorized HySmart Station
            platform administrators. Your company account can continue
            using its normal company workspace.
          </p>

          <button
            type="button"
            className="btn btn-primary btn-wide"
            onClick={() => {
              window.location.assign('/');
            }}
          >
            Return to company workspace
          </button>
        </section>
      </main>
    );
  }

  return <CreatorDashboardPage />;
}

function NotFound() {
  return (
    <main className="not-found">
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <a href="/">Return to overview</a>
    </main>
  );
}

export default function App() {
  const { configured, session, signOut } = useAuth();
  const navigate = useNavigate();

  const [trialExpired, setTrialExpired] = useState(false);

  // Retain the existing trial-expiry event handling.
  useEffect(() => {
    const onExpired = () => setTrialExpired(true);

    window.addEventListener('hysmart:trial-expired', onExpired);

    return () => {
      window.removeEventListener('hysmart:trial-expired', onExpired);
    };
  }, []);

  // Retain the existing server-side trial status check.
  useEffect(() => {
    if (!session?.access_token) {
      setTrialExpired(false);
      return undefined;
    }

    let alive = true;

    apiRequest('/me', {
      token: session.access_token,
    })
      .then((profile) => {
        if (alive && profile?.access?.trialExpired) {
          setTrialExpired(true);
        }
      })
      .catch(() => {
        // A temporary profile request failure must not lock the user out.
      });

    return () => {
      alive = false;
    };
  }, [session?.access_token]);

  function goToBilling() {
    setTrialExpired(false);
    navigate('/billing');
  }

  async function exitWorkspace() {
    setTrialExpired(false);

    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <>
      <InstallAppButton />

      {!configured && (
        <div className="config-banner">
          <Notice type="error">
            Supabase configuration missing. Authentication and protected
            data requests are disabled until environment variables are set.
          </Notice>
        </div>
      )}

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/invite" element={<InvitePage />} />

        {/* Authenticated routes */}
        <Route element={<Protected />}>
          <Route path="/setup" element={<CompanySetupPage />} />
          <Route path="/getting-started" element={<GettingStartedPage />} />
          <Route path="/billing" element={<BillingPage />} />

          {/* Dedicated platform administrator route */}
          <Route
            path="/creator"
            element={<CreatorProtected />}
          />

          {/* Normal company operational workspace */}
          <Route path="/" element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="stations" element={<StationsPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route
              path="advanced-operations"
              element={<AdvancedOperationsPage />}
            />
            <Route path="sales" element={<SalesPage />} />
            <Route path="controls" element={<ControlsPage />} />
            <Route path="governance" element={<GovernancePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route
              path="accountability"
              element={<AccountabilityPage />}
            />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route
              path="company-settings"
              element={<CompanySettingsPage />}
            />
            <Route path="support" element={<SupportPage />} />
            <Route
              path="account-security"
              element={<AccountSecurityPage />}
            />

            <Route path="user-guide" element={<UserGuidePage />} />
            <Route
              path="user-guide/attendant"
              element={<UserGuidePage />}
            />
            <Route
              path="user-guide/manager"
              element={<UserGuidePage />}
            />
            <Route
              path="user-guide/owner"
              element={<UserGuidePage />}
            />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>

      {trialExpired && (
        <div className="modal-backdrop trial-lock-backdrop">
          <section
            className="upgrade-modal trial-lock-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trial-lock-title"
          >
            <span className="upgrade-icon">
              <LockKeyhole size={24} />
            </span>

            <span className="eyebrow">
              WORKSPACE ACCESS PAUSED
            </span>

            <h2 id="trial-lock-title">
              Your free trial has ended
            </h2>

            <p>
              Your operational workspace is locked until the company
              owner activates a paid plan. Your existing records are
              preserved. Upgrade to restore access to station operations.
            </p>

            <div className="billing-footnote">
              <ShieldCheck size={17} />
              <span>
                Starter: ₦30,000/month for one branch. Multi-Branch:
                ₦120,000/month for up to five branches.
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-wide"
              onClick={goToBilling}
            >
              View plans and restore access
            </button>

            <button
              type="button"
              className="text-btn"
              onClick={exitWorkspace}
            >
              Sign out
            </button>
          </section>
        </div>
      )}
    </>
  );
}
