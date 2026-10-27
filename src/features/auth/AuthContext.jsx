import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(() => { try { return sessionStorage.getItem('hysmart-password-recovery') === 'true'; } catch { return false; } });

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let alive = true;
    let authEventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;
      if (!alive) return;
      if (_event === 'PASSWORD_RECOVERY') { setRecoveryMode(true); try { sessionStorage.setItem('hysmart-password-recovery', 'true'); } catch {} }
      if (_event === 'SIGNED_OUT') { setRecoveryMode(false); try { sessionStorage.removeItem('hysmart-password-recovery'); } catch {} }
      setSession(nextSession || null);
      setLoading(false);
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!alive || authEventReceived) return;
        if (error) {
          setSession(null);
        } else {
          setSession(data?.session || null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive || authEventReceived) return;
        setSession(null);
        setLoading(false);
      });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    try {
      if (supabase) await supabase.auth.signOut();
    } finally {
      setSession(null);
      setRecoveryMode(false);
      try { sessionStorage.removeItem('hysmart-password-recovery'); } catch {}
    }
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user || null, loading, signOut, recoveryMode, configured: !!supabase }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
