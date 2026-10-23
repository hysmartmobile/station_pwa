import { useEffect, useState } from 'react';
import { Building2, Save, ShieldCheck } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import Notice from '../components/Notice';
import { useAuth } from '../features/auth/AuthContext';
import { apiRequest } from '../lib/api';
import { CURRENCY_LABELS, SUPPORTED_CURRENCIES } from '../lib/currency';

export default function CompanySettingsPage() {
  const { session } = useAuth();
  const [settings, setSettings] = useState(null);
  const [currency, setCurrency] = useState('NGN');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    if (!session) return;
    setLoading(true); setError('');
    try { const data = await apiRequest('/companies/settings', {token:session.access_token}); const value = data.data || data; setSettings(value); setCurrency(value.currency || 'NGN'); }
    catch (e) { setError(e.message || 'Could not load company settings.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [session]);
  async function save(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const data = await apiRequest('/companies/settings/currency', {token:session.access_token,method:'PUT',body:{currency}});
      const value = data.data || data; setSettings(value); setCurrency(value.currency);
      try { localStorage.setItem('hysmart-company-currency', value.currency); } catch {}
      window.dispatchEvent(new Event('hysmart:currency-updated'));
      setNotice(`Company currency saved as ${value.currency}. Financial values are displayed in this currency; no foreign-exchange conversion is performed.`);
    } catch (e) { setError(e.message || 'Could not save company currency.'); }
    finally { setBusy(false); }
  }
  return <><SectionHeader eyebrow="COMPANY CONFIGURATION" title="Company settings" description="Set the base currency used for your company's financial records and reports." action={<button className="btn btn-outline" onClick={load} disabled={loading}>Refresh</button>}/>
    {error && <Notice type="error">{error}</Notice>}{notice && <Notice type="success">{notice}</Notice>}
    <section className="content-card"><div className="card-heading"><Building2/><div><h2>Preferred company currency</h2><p>Choose the currency used for financial amounts across this company workspace.</p></div></div>
      {loading ? <p>Loading company settings…</p> : <form onSubmit={save} className="stack-form"><label htmlFor="company-currency-setting">Base currency</label><select id="company-currency-setting" value={currency} onChange={e=>setCurrency(e.target.value)} disabled={!settings?.canChangeCurrency || busy} required>{SUPPORTED_CURRENCIES.map(code=><option key={code} value={code}>{code} — {CURRENCY_LABELS[code]}</option>)}</select>
      <p className="muted">This setting is company-wide, not personal. HySmart does not convert amounts using exchange rates. The selected currency is locked after the first station is created so existing records cannot be silently relabelled.</p>
      {!settings?.canChangeCurrency && <Notice type="warning">Currency is locked because this company already has at least one station. Contact support before changing currency; a reviewed conversion of historical records would be required.</Notice>}
      <button className="btn btn-primary" type="submit" disabled={busy || !settings?.canChangeCurrency || currency===settings?.currency}><Save size={16}/>{busy?'Saving…':'Save company currency'}</button>
      <div className="security-note"><ShieldCheck size={15}/> Only a company owner or director can change the base currency.</div></form>}
    </section></>;
}
