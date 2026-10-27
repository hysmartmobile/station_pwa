import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, UserRoundCheck, Building2, Clock3, RefreshCw } from 'lucide-react';
import Brand from '../components/Brand';
import Notice from '../components/Notice';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';

const roleLabel = role => role === 'STATION_MANAGER' ? 'Branch Manager' : role === 'ATTENDANT' ? 'Petrol Attendant' : 'Team Member';

export default function InvitePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState('');
  const [name, setName] = useState(session?.user?.user_metadata?.full_name || '');
  const [email, setEmail] = useState(session?.user?.email || '');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState(session ? 'accept' : 'signup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPreview(null); setPreviewError(''); setPreviewLoading(true);
    if (!token) {
      setPreviewError('This invitation link is incomplete. Ask the inviter for a fresh link.');
      setPreviewLoading(false);
      return () => { cancelled = true; };
    }
    apiRequest(`/invitations/preview?token=${encodeURIComponent(token)}`)
      .then(data => {
        if (cancelled) return;
        setPreview(data);
        setEmail(data.email || '');
        if (session?.user?.email && session.user.email.toLowerCase() === (data.email || '').toLowerCase()) setMode('accept');
        else if (session) setMode('wrong-account');
        else setMode('signup');
      })
      .catch(e => { if (!cancelled) setPreviewError(e.message || 'This invitation is invalid, expired, or already used. Ask for a fresh link.'); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [token, session?.user?.id, session?.user?.email]);

  async function accept(accessToken) {
    const result = await apiRequest('/invitations/accept', { method: 'POST', token: accessToken, body: { token } });
    setAccepted(true);
    setInfo('Your invitation has been verified and your branch access is active. Opening your workspace…');
    window.setTimeout(() => navigate(result.role === 'ATTENDANT' ? '/attendance' : '/', { replace: true }), 500);
  }

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setInfo('');
    try {
      if (!preview || previewError) throw new Error('This invitation cannot be used. Ask the inviter for a fresh link.');
      if (!supabase) throw new Error('Sign-up is temporarily unavailable. Please contact your company owner.');
      if (mode === 'wrong-account') throw new Error(`You are signed in as ${session?.user?.email || 'a different account'}. Sign out and continue with ${preview.email}.`);
      if (mode === 'accept' && session?.access_token) {
        if ((session.user?.email || '').toLowerCase() !== preview.email.toLowerCase()) throw new Error(`This invitation is for ${preview.email}. Sign in with that email address.`);
        await accept(session.access_token); return;
      }
      const cleanEmail = preview.email.toLowerCase();
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: cleanEmail, password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/invite?token=${encodeURIComponent(token)}` }
        });
        if (authError) throw authError;
        if (data.session?.access_token) await accept(data.session.access_token);
        else setInfo(`Account created. Check ${cleanEmail} for the confirmation email. After confirming, return through this invitation link to finish joining ${preview.stationName}.`);
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (authError) throw authError;
        if (!data.session?.access_token) throw new Error('Sign-in succeeded but no active session was returned. Please try again.');
        await accept(data.session.access_token);
      }
    } catch (e) { setError(e.message || 'Could not complete this invitation.'); }
    finally { setBusy(false); }
  }

  async function useCorrectAccount() {
    setError('');
    try { await supabase?.auth.signOut(); setPassword(''); setMode('signup'); setInfo(`Please register or sign in using ${preview?.email}.`); }
    catch (e) { setError(e.message || 'Could not switch accounts.'); }
  }

  return <main className="simple-page invite-page onboarding-page">
    <Brand />
    <div className="onboarding-photo invite-photo">
      <img src="https://images.pexels.com/photos/20758453/pexels-photo-20758453.jpeg?auto=compress&cs=tinysrgb&w=1400" alt="Petrol station forecourt" onError={e => { e.currentTarget.style.display = 'none'; }} />
      <div><span className="pill">WELCOME TO YOUR STATION TEAM</span><h2>Every shift starts with a connected team.</h2><p>One secure invitation connects you to the right branch and role.</p></div>
    </div>
    <section className="form-card invite-card">
      <div className="invite-hero-icon"><UserRoundCheck size={25}/></div>
      <div className="eyebrow">A TEAM INVITATION FOR YOU</div>
      <h1>{accepted ? 'You’re all set' : 'Join your station team'}</h1>
      <p className="muted">Your invitation determines your company, branch and role. You cannot change these details during registration.</p>
      {previewLoading && <div className="invite-preview-state"><RefreshCw size={18} className="spin-icon"/> Checking your invitation…</div>}
      {!previewLoading && previewError && <Notice type="error">{previewError} <Link to="/login">Return to sign in</Link></Notice>}
      {preview && !previewLoading && <div className="invite-preview-card">
        <div className="invite-preview-row"><span className="invite-preview-icon"><Building2 size={18}/></span><div><small>COMPANY</small><b>{preview.companyName}</b></div></div>
        <div className="invite-preview-row"><span className="invite-preview-icon"><Building2 size={18}/></span><div><small>ASSIGNED BRANCH</small><b>{preview.stationName}</b></div></div>
        <div className="invite-preview-row"><span className="invite-preview-icon"><ShieldCheck size={18}/></span><div><small>INVITED ROLE</small><b>{roleLabel(preview.role)}</b></div></div>
        <div className="invite-preview-row"><span className="invite-preview-icon"><Clock3 size={18}/></span><div><small>INVITATION EXPIRES</small><b>{new Date(preview.expiresAt).toLocaleString()}</b></div></div>
      </div>}
      {error && <Notice type="error">{error}</Notice>}
      {info && <Notice type={accepted ? 'success' : 'info'}>{info}</Notice>}
      {accepted ? <div className="invite-accepted"><CheckCircle2 size={30}/><b>Access confirmed</b><span>Your dashboard is ready.</span></div> : preview && !previewLoading && <form onSubmit={submit}>
        {mode === 'signup' && <><label htmlFor="invite-name">Full name</label><input id="invite-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required maxLength={120}/></>}
        <label htmlFor="invite-email">Invited email address</label><input id="invite-email" type="email" autoComplete="email" value={preview.email} readOnly aria-readonly="true" />
        {mode !== 'accept' && mode !== 'wrong-account' && <><label htmlFor="invite-password">{mode === 'signup' ? 'Create password' : 'Password'}</label><input id="invite-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required/></>}
        {mode !== 'wrong-account' && <button className="btn btn-primary btn-wide" disabled={busy || previewLoading}>{busy ? 'Securing your access…' : mode === 'accept' ? 'Accept invitation' : mode === 'signup' ? 'Create account & join' : 'Sign in & join'} <ArrowRight size={17}/></button>}
        {mode === 'wrong-account' && <><Notice type="error">You are signed in with a different email. This invitation can only be accepted by {preview.email}.</Notice><button type="button" className="btn btn-primary btn-wide" onClick={useCorrectAccount}>Sign out and use invited email</button></>}
      </form>}
      {!accepted && preview && !previewLoading && mode !== 'wrong-account' && <p className="auth-switch">{mode === 'signup' ? 'Already have an account?' : 'New to HySmart Station?'} <button type="button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setPassword(''); setError(''); setInfo(''); }}>{mode === 'signup' ? 'Sign in' : 'Create account'}</button></p>}
      <div className="invite-security"><ShieldCheck size={16}/><span>Invitation links expire after 72 hours, are single-use, and only work for the invited email address. Your access is activated after email confirmation and server validation.</span></div>
      <Link className="back-link" to="/login">Back to sign in</Link>
    </section>
    <footer className="simple-footer">Sent securely by HySmart Station</footer>
  </main>;
}
