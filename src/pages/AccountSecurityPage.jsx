import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import Notice from '../components/Notice';
import { useAuth } from '../features/auth/AuthContext';
import { supabase } from '../lib/supabase';

export default function AccountSecurityPage() {
  const { user, session } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(e) {
    e.preventDefault(); setError(''); setNotice('');
    if (!supabase || !session || !user?.email) { setError('Your account session is unavailable. Sign in again and retry.'); return; }
    if (next.length < 8) { setError('Use at least 8 characters for your new password.'); return; }
    if (next !== confirm) { setError('The new passwords do not match.'); return; }
    if (current === next) { setError('Your new password must be different from your current password.'); return; }
    setBusy(true);
    try {
      // Re-authenticate first so a stale or unattended session alone cannot change credentials.
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (verifyError) throw new Error('Current password is incorrect. Please check it and try again.');
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;
      setCurrent(''); setNext(''); setConfirm('');
      setNotice('Password changed successfully. Use your new password the next time you sign in.');
    } catch (e) { setError(e?.message || 'Could not change your password. Please try again.'); }
    finally { setBusy(false); }
  }
  return <><SectionHeader eyebrow="PERSONAL ACCOUNT" title="Account security" description="Change your sign-in password and keep your HySmart account secure."/><section className="content-card account-security-card"><div className="card-heading"><KeyRound/><div><h2>Change password</h2><p>Confirm your current password before choosing a new one.</p></div></div>{error && <Notice type="error">{error}</Notice>}{notice && <Notice type="success">{notice}</Notice>}<form onSubmit={submit} className="stack-form">
    <label htmlFor="current-password">Current password</label><input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} disabled={busy}/>
    <label htmlFor="account-new-password">New password</label><input id="account-new-password" type="password" autoComplete="new-password" minLength={8} required value={next} onChange={e => setNext(e.target.value)} disabled={busy}/><small className="field-hint">At least 8 characters; a unique passphrase is recommended.</small>
    <label htmlFor="account-confirm-password">Confirm new password</label><input id="account-confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy}/>
    <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Changing password…' : 'Change password'}</button><div className="security-note"><ShieldCheck size={16}/> Your current password is verified before the update is allowed.</div>
  </form></section></>;
}
