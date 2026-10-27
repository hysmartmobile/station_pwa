import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import Brand from '../components/Brand';
import Notice from '../components/Notice';
import { useAuth } from '../features/auth/AuthContext';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage() {
  const { session, loading, configured, signOut, recoveryMode } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');


  async function submit(e) {
    e.preventDefault(); setError(''); setNotice('');
    if (password.length < 8) { setError('Use at least 8 characters for your new password.'); return; }
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    if (!session || !recoveryMode) { setError('This reset link is invalid or has expired. Request a new reset link and open the newest email.'); return; }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setNotice('Your password has been changed. For your security, sign in again with your new password.');
      setPassword(''); setConfirm('');
      await signOut();
      nav('/login', { replace: true, state: { passwordChanged: true } });
    } catch (e) {
      setError(e?.message || 'Could not update the password. Request a fresh reset link and try again.');
    } finally { setBusy(false); }
  }

  return <main className="simple-page"><div className="reset-brand"><Brand/></div><section className="form-card password-form-card"><span className="password-form-icon"><KeyRound size={23}/></span><div className="eyebrow">ACCOUNT SECURITY</div><h1>Set a new password</h1><p className="muted">Choose a strong password you have not used for another account.</p>
    {!configured && <Notice type="error">Password services are not configured. Please contact your administrator.</Notice>}
    {error && <Notice type="error">{error}</Notice>}{notice && <Notice type="success">{notice}</Notice>}
    {loading ? <p role="status">Checking your secure reset link…</p> : (!session || !recoveryMode) ? <><Notice type="warning">No valid reset session was found. Reset links are single-use and may expire.</Notice><Link className="btn btn-primary btn-wide password-link-button" to="/login">Request another reset link</Link></> : <form onSubmit={submit}>
      <label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" disabled={busy}/><small className="field-hint">Use at least 8 characters. A longer, unique passphrase is recommended.</small>
      <label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Enter the new password again" disabled={busy}/>
      <button className="btn btn-primary btn-wide" type="submit" disabled={busy || !configured}>{busy ? 'Updating password…' : 'Save new password'}</button>
    </form>}
    <div className="security-note"><ShieldCheck size={17}/> Password updates are handled securely by Supabase Authentication.</div><Link className="back-link" to="/login"><ArrowLeft size={14}/> Back to sign in</Link>
  </section></main>;
}
