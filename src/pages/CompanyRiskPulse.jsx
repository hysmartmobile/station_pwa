import { formatMoney } from '../lib/currency';
import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import Notice from '../components/Notice';
import StatCard from '../components/StatCard';
import { useAuth } from '../features/auth/AuthContext';
import { apiRequest } from '../lib/api';

const money = value => formatMoney(value);
const qty = value => new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(Number(value || 0));
const dateString = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

/** Owner-only exception overview. The API independently enforces company-owner scope. */
export default function CompanyRiskPulse() {
  const { session, user } = useAuth();
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate()-6); return dateString(d); });
  const [to, setTo] = useState(() => dateString(new Date()));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    if (!session) return;
    if (!from || !to || from > to || (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`))/86400000 > 366) {
      setError('Choose a valid date range of no more than 367 calendar days.'); return;
    }
    setLoading(true); setError('');
    try {
      const data = await apiRequest(`/companies/financial-report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { token: session.access_token });
      setReport(data);
    } catch (e) { setReport(null); setError(e.message || 'Unable to load company risk overview.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* initial owner risk summary */ }, [session]);
  const branches = report?.branches || [];
  const exceptions = branches.map(b => ({ ...b, collectionGap: Number(b.expectedSales || 0) - Number(b.netCollections || 0) }))
    .filter(b => Number(b.stockDiscrepancies || 0) > 0 || Math.abs(b.collectionGap) >= 0.01)
    .sort((a,b) => Number(b.stockDiscrepancies || 0) - Number(a.stockDiscrepancies || 0) || Math.abs(b.collectionGap)-Math.abs(a.collectionGap));
  const totals = report?.totals || {};
  return <section className="content-card company-risk-pulse">
    <div className="card-heading"><AlertTriangle/><div><h2>Company risk pulse</h2><p>Branch-level stock discrepancies and sales-versus-collection differences for the selected period.</p></div><button className="btn btn-outline" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''}/>{loading ? 'Checking…' : 'Refresh'}</button></div>
    <div className="report-filter-row"><label>From date<input type="date" value={from} max={to || undefined} onChange={e=>setFrom(e.target.value)}/></label><label>To date<input type="date" value={to} min={from || undefined} onChange={e=>setTo(e.target.value)}/></label><button className="btn btn-primary" onClick={load} disabled={loading}><ShieldCheck size={16}/> Check branches</button></div>
    {error && <Notice type="error">{error}</Notice>}
    {report?.warnings?.map(w => <Notice type="warning" key={w}>{w}</Notice>)}
    <div className="stat-grid company-stat-grid">
      <StatCard label="Branches with exceptions" value={report ? exceptions.length : '—'} detail="Stock discrepancies or period-level collection differences" icon={AlertTriangle}/>
      <StatCard label="Stock checks with variance" value={report ? qty(totals.stockDiscrepancies) : '—'} detail="Variance threshold: 0.01 in native unit" icon={ShieldCheck}/>
      <StatCard label="Expected sales" value={report ? money(totals.expectedSales) : '—'} detail="Approved meter-derived amounts" icon={Wallet}/>
      <StatCard label="Net collections" value={report ? money(totals.netCollections) : '—'} detail="Recorded collections less reversals" icon={Wallet}/>
    </div>
    {!report && loading ? <p className="loading-line">Loading company-wide exception data…</p> : !report ? <p className="loading-line">Company risk data is not available.</p> : exceptions.length === 0 ? <p className="loading-line">No stock discrepancies or sales-versus-collection differences were found in this period.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Branch</th><th>Stock checks with variance</th><th>Largest stock variance</th><th>Expected sales</th><th>Net collections</th><th>Difference*</th></tr></thead><tbody>{exceptions.map(b=><tr key={b.stationId}><td><b>{b.branch}</b><small className="table-subline">{b.status} · {b.address || 'No address recorded'}</small></td><td>{b.stockDiscrepancies}</td><td>{qty(b.largestAbsoluteStockVariance)} <small className="table-subline">native unit</small></td><td>{money(b.expectedSales)}</td><td>{money(b.netCollections)}</td><td className={Math.abs(b.collectionGap)>=0.01?'status-pending':''}>{money(b.collectionGap)}</td></tr>)}</tbody></table></div>}
    <p className="report-footnote">* Difference = expected meter sales minus net collections recorded during the same date range. It is a review signal, not automatically a cash shortage: collection timing, credit/other workflows, and posting dates can differ. Litres and kilograms remain separate. Visible only to authenticated company leadership (owner/director). {user?.email ? `Account: ${user.email}.` : ''}</p>
  </section>;
}
