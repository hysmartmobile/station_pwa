import { useState } from 'react';
import { Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowRight, ShieldCheck, TriangleAlert, Mail } from 'lucide-react';
import Brand from '../components/Brand';
import Notice from '../components/Notice';
import { useAuth } from '../features/auth/AuthContext';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const { session, configured } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(location.state?.passwordChanged ? 'Your password has been changed. Sign in with your new password.' : '');
  if (session && mode !== 'reset-request') return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setInfo('');
    try {
      if (!supabase) throw new Error('Password services are not configured. Please contact your administrator.');
      if (mode === 'reset-request') {
        const redirectTo = `${window.location.origin}/reset-password`;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (resetError) throw resetError;
        setInfo('If an account exists for this email, a password-reset link will arrive shortly. Check your inbox and spam folder. The link expires for your security.');
        return;
      }
      if (mode === 'login') {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginError) throw loginError;
        nav('/');
      } else {
        const { data, error: signupError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signupError) throw signupError;
        if (data.session) nav('/');
        else setInfo('Account created. Confirm your email, then sign in.');
      }
    } catch (e) {
      setError(e?.message || 'The request could not be completed. Please try again.');
    } finally { setBusy(false); }
  }

  const isResetRequest = mode === 'reset-request';
  return <main className="auth-layout">
    <section className="auth-aside"><div className="auth-photo-layer" aria-hidden="true"><img src="https://images.pexels.com/photos/20758453/pexels-photo-20758453.jpeg?auto=compress&cs=tinysrgb&w=1800" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /></div><Brand/><div className="hero-copy"><span className="pill">OPERATIONS, MADE CLEAR</span><h1>Every litre.<br/><em>Accounted for.</em></h1><p>Bring branch teams, shifts, fuel records and daily accountability into one operational workspace.</p><ul><li><ShieldCheck/> Role-aware access for your team</li><li><ArrowRight/> Designed for busy station operations</li><li><TriangleAlert/> Surface exceptions before they grow</li></ul></div><small className="aside-foot">HYSMART TECHNOLOGY · FUEL BUSINESS CONTROL</small></section>
    <section className="auth-main"><div className="auth-mobile-photo" aria-hidden="true"><img src="https://images.pexels.com/photos/20758453/pexels-photo-20758453.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="" onError={e => { e.currentTarget.style.display = 'none'; }}/><span>HYSMART STATION · EVERY LITRE ACCOUNTED FOR</span></div><div className="auth-box">
      <div className="eyebrow">YOUR STATION. IN CONTROL.</div>
      <h2>{isResetRequest ? 'Reset your password' : mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
      <p className="muted">{isResetRequest ? 'Enter the email address associated with your account and we’ll send a secure reset link.' : mode === 'login' ? 'Sign in to continue to your workspace.' : 'Create an account to start setting up your workspace.'}</p>
      {!configured && <Notice type="error">Supabase is not configured. Authentication is unavailable until your administrator completes setup.</Notice>}
      {error && <Notice type="error">{error}</Notice>}{info && <Notice type="success">{info}</Notice>}
      <form onSubmit={submit}>
        <label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" disabled={busy}/>
        {!isResetRequest && <><label htmlFor="auth-password">Password</label><input id="auth-password" type="password" minLength={8} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" disabled={busy}/></>}
        <button className="btn btn-primary btn-wide" type="submit" disabled={busy || !configured}>{busy ? 'Please wait…' : isResetRequest ? 'Email reset link' : mode === 'login' ? 'Sign in securely' : 'Create account'} {isResetRequest ? <Mail size={17}/> : <ArrowRight size={17}/>}</button>
      </form>
      {mode === 'login' && <p className="auth-switch"><button type="button" onClick={() => { setMode('reset-request'); setPassword(''); setError(''); setInfo(''); }}>Forgot your password?</button></p>}
      <p className="auth-switch">{isResetRequest ? 'Remembered your password?' : mode === 'login' ? 'New to HySmart Station?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(isResetRequest || mode === 'signup' ? 'login' : 'signup'); setPassword(''); setError(''); setInfo(''); }}>{isResetRequest || mode === 'signup' ? 'Sign in' : 'Create account'}</button></p>
      <div className="security-note"><ShieldCheck size={17}/> Your records are protected by authenticated access policies.</div><Link className="back-link" to="/invite">Have an invitation? Accept it here</Link>
    </div><footer>© {new Date().getFullYear()} HySmart Technology</footer></section>
  </main>;
}
