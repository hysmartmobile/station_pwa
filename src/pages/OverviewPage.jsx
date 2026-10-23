import { formatMoney } from '../lib/currency';
import { useEffect, useMemo, useState } from 'react';
import { Activity, Building2, ClipboardCheck, Fuel, Receipt, Users, ArrowUpRight, Clock3, ShieldCheck, RefreshCw, Wallet, AlertTriangle, Scale } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import StatCard from '../components/StatCard';
import Notice from '../components/Notice';
import { useAuth } from '../features/auth/AuthContext';
import { apiRequest } from '../lib/api';
import { Link, useNavigate } from 'react-router-dom';
import CompanyRiskPulse from './CompanyRiskPulse';
import CompanyDailyClosing from './CompanyDailyClosing';

const money = value => formatMoney(value);
const number = value => new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(Number(value || 0));

export default function OverviewPage() {
  const { session } = useAuth();
  const nav = useNavigate();
  const [me, setMe] = useState(null);
  const [billing, setBilling] = useState(null);
  const [audit, setAudit] = useState([]);
  const [summary, setSummary] = useState(null);
  const [stationWorkspace, setStationWorkspace] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function loadDashboard(token, activeCheck = () => true) {
    setRefreshing(true);
    setError('');
    try {
      const [profile, plan, auditData] = await Promise.all([
        apiRequest('/me', { token }),
        apiRequest('/billing/status', { token }).catch(() => null),
        apiRequest('/companies/audit', { token }).catch(() => null),
      ]);
      if (!activeCheck()) return;
      setMe(profile); setBilling(plan); setAudit(auditData?.events || []);
      if (!profile.companies?.length && !profile.stations?.length) { nav('/setup', { replace: true }); return; }
      if (profile.companies?.length) {
        const companySummary = await apiRequest('/companies/dashboard-summary', { token });
        if (activeCheck()) { setSummary(companySummary); setStationWorkspace(null); }
      } else {
        setSummary(null);
        const assigned = (profile.stations || []).find(s => s.stationRole === 'STATION_MANAGER')
          || (profile.stations || []).find(s => s.stationRole === 'ATTENDANT')
          || (profile.stations || [])[0];
        if (assigned?.id) {
          const stationId = encodeURIComponent(assigned.id);
          const [operations, controls, attendance, approvals] = await Promise.all([
            apiRequest(`/operations?stationId=${stationId}`, { token }),
            apiRequest(`/controls?stationId=${stationId}`, { token }).catch(() => null),
            apiRequest(`/attendance?stationId=${stationId}`, { token }).catch(() => []),
            assigned.stationRole === 'STATION_MANAGER' ? apiRequest(`/operations/meter-approvals?stationId=${stationId}`, { token }).catch(() => null) : Promise.resolve(null),
          ]);
          if (activeCheck()) setStationWorkspace({ station: assigned, operations, controls, attendance: Array.isArray(attendance) ? attendance : [], approvals });
        } else if (activeCheck()) setStationWorkspace(null);
      }
    } catch (e) { if (activeCheck()) setError(e.message || 'Unable to load dashboard data.'); }
    finally { if (activeCheck()) setRefreshing(false); }
  }

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    loadDashboard(session.access_token, () => active);
    return () => { active = false; };
  }, [session]);

  const branches = summary?.branches || [];
  const totals = useMemo(() => branches.reduce((acc, b) => {
    acc.salesToday += Number(b.salesToday || 0);
    acc.salesAllTime += Number(b.salesAllTime || 0);
    acc.collectionsToday += Number(b.collectionsToday || 0);
    acc.collectionsAllTime += Number(b.collectionsAllTime || 0);
    acc.attendanceToday += Number(b.attendanceToday || 0);
    acc.openShifts += Number(b.openShifts || 0);
    acc.managers += Number(b.managerCount || 0);
    acc.attendants += Number(b.attendantCount || 0);
    acc.pumps += Number(b.pumpCount || 0);
    acc.tanks += Number(b.tankCount || 0);
    return acc;
  }, { salesToday: 0, salesAllTime: 0, collectionsToday: 0, collectionsAllTime: 0, attendanceToday: 0, openShifts: 0, managers: 0, attendants: 0, pumps: 0, tanks: 0 }), [branches]);

  const owner = !!me?.companies?.length;
  const manager = me?.stationMemberships?.some(m => m.role === 'STATION_MANAGER');
  const attendant = me?.stationMemberships?.some(m => m.role === 'ATTENDANT');
  const activeBranches = branches.filter(b => b.status === 'active').length;

  return <>
    <SectionHeader eyebrow={owner ? 'COMPANY CONTROL CENTRE' : 'DAILY CONTROL'} title={owner ? 'Company overview' : 'Operations overview'} description={owner ? 'Consolidated performance across every branch, calculated from recorded operations.' : 'A clear starting point for your assigned station operations.'} action={<button className="btn btn-outline" onClick={() => session && loadDashboard(session.access_token)} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''}/> {refreshing ? 'Refreshing' : 'Refresh'}</button>} />
    {error && <Notice type="error">{error} — check the API, database migration and environment configuration.</Notice>}
    <div className="welcome-panel"><div><span className="pill pill-light">HYSMART STATION</span><h2>{owner ? 'Your whole business. One clear view.' : manager ? 'Your branch. Your team. Your shift.' : attendant ? 'Your shift starts with clear records.' : 'Good operations start with good records.'}</h2><p>{owner ? 'Review sales, collections, attendance, staffing and equipment across all branches without opening each branch separately.' : manager ? 'Manage only your assigned branch, support attendants and keep daily operations accountable.' : attendant ? 'Record your attendance and keep every shift reading and collection accurate.' : 'Manage branches, people, shifts and fuel records from one place.'}</p></div><div className="welcome-art"><Fuel size={70}/><span>MEASURE · REVIEW · IMPROVE</span></div></div>
    {billing && <div className={`plan-banner ${billing.paidActive ? 'plan-banner-active' : 'plan-banner-locked'}`}><div className="plan-banner-icon">{billing.paidActive ? <ShieldCheck size={20}/> : <Clock3 size={20}/>}</div><div className="plan-banner-copy"><b>{billing.paidActive ? `${billing.subscription?.plan === 'multi' ? 'Multi-Branch' : 'Starter'} plan active` : billing.trialActive ? 'Your 7-day trial is running' : 'Upgrade required to create branches'}</b><p>{billing.paidActive ? `${billing.branchCount} of ${billing.branchLimit} branches in use · subscription period ends ${billing.subscription?.current_period_end ? new Date(billing.subscription.current_period_end).toLocaleDateString() : 'after the current billing period'}` : billing.trialActive ? `Trial ends ${new Date(billing.trialEndsAt).toLocaleDateString()}. A paid plan is required before a new branch can be created.` : 'Choose Starter at ₦30,000/month or Multi-Branch at ₦120,000/month for up to five branches.'}</p></div><Link className="btn btn-primary" to="/billing">{billing.paidActive ? 'Manage plan' : 'View plans'} <ArrowUpRight size={16}/></Link></div>}

    {owner ? <>
      <div className="stat-grid company-stat-grid">
        <StatCard label="Sales today" value={summary ? money(totals.salesToday) : '—'} detail="Meter-based expected sales" icon={Receipt}/>
        <StatCard label="Collections today" value={summary ? money(totals.collectionsToday) : '—'} detail="Recorded payments received" icon={Wallet}/>
        <StatCard label="Branches" value={summary ? `${activeBranches}/${branches.length}` : '—'} detail="Active / total branches" icon={Building2}/>
        <StatCard label="Attendance today" value={summary ? number(totals.attendanceToday) : '—'} detail={`${number(totals.openShifts)} open attendance shifts`} icon={ClipboardCheck}/>
      </div>
      <div className="stat-grid company-stat-grid company-stat-grid-secondary">
        <StatCard label="All-time expected sales" value={summary ? money(totals.salesAllTime) : '—'} detail="Sum of saved meter readings" icon={Activity}/>
        <StatCard label="All-time collections" value={summary ? money(totals.collectionsAllTime) : '—'} detail="Net recorded collections after reversals" icon={Wallet}/>
        <StatCard label="Team members" value={summary ? number(totals.managers + totals.attendants) : '—'} detail={`${totals.managers} managers · ${totals.attendants} attendants`} icon={Users}/>
        <StatCard label="Pumps / tanks" value={summary ? `${number(totals.pumps)} / ${number(totals.tanks)}` : '—'} detail="Active equipment configured" icon={Fuel}/>
      </div>
      <CompanyRiskPulse />
      <CompanyDailyClosing />
      <section className="content-card company-branch-report"><div className="card-heading"><Building2/><div><h2>Branch performance</h2><p>Sales and collections are calculated from the records stored for each branch.</p></div><Link className="text-btn" to="/stations">Manage branches</Link></div>
        {!summary ? <p className="loading-line">Loading company totals…</p> : branches.length === 0 ? <p className="loading-line">No branches have been created yet. Create your first branch to start recording operations.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Branch</th><th>Team</th><th>Attendance today</th><th>Sales today</th><th>Collections today</th><th>Latest reconciliation</th></tr></thead><tbody>{branches.map(b => <tr key={b.id}><td><b>{b.name}</b><small className="table-subline">{b.address || 'No address recorded'} · {b.status}</small></td><td>{number(b.managerCount)} mgr · {number(b.attendantCount)} attendants</td><td>{number(b.attendanceToday)} <small className="table-subline">{number(b.openShifts)} open</small></td><td>{money(b.salesToday)}</td><td>{money(b.collectionsToday)}</td><td>{b.latestReconciliation ? <><span className={`status-badge ${b.latestReconciliation.status === 'balanced' ? '' : 'status-pending'}`}>{b.latestReconciliation.status}</span><small className="table-subline">{b.latestReconciliation.date} · variance {money(b.latestReconciliation.variance)}</small></> : <span className="muted-text"><AlertTriangle size={13}/> Not reconciled</span>}</td></tr>)}</tbody><tfoot><tr><th>Company total</th><th>{number(totals.managers)} mgr · {number(totals.attendants)} attendants</th><th>{number(totals.attendanceToday)}</th><th>{money(totals.salesToday)}</th><th>{money(totals.collectionsToday)}</th><th>All branches</th></tr></tfoot></table></div>}
        <p className="report-footnote">Sales are based on meter readings; collections are payment entries. They are intentionally shown separately. Collections are net of recorded approved reversals. Book stock is not a substitute for a physical tank dip, and pending or rejected meter readings must not be treated as official sales.</p>
      </section>
    </> : <>
      {manager ? <div className="stat-grid">
        <StatCard label="Assigned station" value={stationWorkspace?.station?.name || (me?.stations?.length ? `${me.stations.length} stations` : '—')} detail="Station manager workspace" icon={Building2}/>
        <StatCard label="Pending meter readings" value={stationWorkspace ? (stationWorkspace.approvals ? (stationWorkspace.approvals.litre || []).length + (stationWorkspace.approvals.kg || []).length : [...(stationWorkspace.operations.nozzle_meter_readings || []), ...(stationWorkspace.operations.kg_nozzle_meter_readings || [])].filter(r => r.status === 'pending').length) : '—'} detail="Awaiting independent approval" icon={ClipboardCheck}/>
        <StatCard label="Open cashier shifts" value={stationWorkspace?.controls ? (stationWorkspace.controls.station_cash_shifts || []).filter(s => s.status === 'open').length : '—'} detail="Require cash count and close" icon={Wallet}/>
        <StatCard label="Awaiting reconciliation" value={stationWorkspace?.controls ? (stationWorkspace.controls.station_cash_shifts || []).filter(s => s.status === 'closed' && !(stationWorkspace.controls.station_shift_reconciliations || []).some(r => r.cash_shift_id === s.id)).length : '—'} detail="Closed shifts without a saved reconciliation" icon={Scale}/>
      </div> : <div className="stat-grid">
        <StatCard label="My attendance" value={stationWorkspace?.attendance?.some(r => r.user_id === me?.user?.id && !r.clock_out_at) ? 'Clocked in' : stationWorkspace ? 'Not clocked in' : '—'} detail="Your active attendance record" icon={ClipboardCheck}/>
        <StatCard label="My pending readings" value={stationWorkspace ? [...(stationWorkspace.operations.nozzle_meter_readings || []), ...(stationWorkspace.operations.kg_nozzle_meter_readings || [])].filter(r => r.status === 'pending').length : '—'} detail="Recent readings waiting for manager review" icon={Receipt}/>
        <StatCard label="My collections" value={stationWorkspace ? (stationWorkspace.operations.sales_collections || []).length + (stationWorkspace.operations.kg_sales_collections || []).length : '—'} detail="Collections in recent operational history" icon={Wallet}/>
        <StatCard label="Assigned station" value={stationWorkspace?.station?.name || (me?.stations?.length ? `${me.stations.length} stations` : '—')} detail="Your station assignment" icon={Building2}/>
      </div>}
      {stationWorkspace && <section className="content-card"><div className="card-heading"><Activity/><div><h2>{manager ? 'Branch operations snapshot' : 'My operational snapshot'}</h2><p>{stationWorkspace.station?.name || 'Assigned station'} · Recent records returned by the station API; use the modules below for complete history.</p></div></div><div className="snapshot-inline-grid"><div><b>{(stationWorkspace.operations.station_pumps || []).filter(x => x.status === 'active').length}</b><small>Active pumps</small></div><div><b>{(stationWorkspace.operations.station_tanks || []).filter(x => x.status === 'active').length}</b><small>Active tanks</small></div><div><b>{(stationWorkspace.operations.pump_nozzles || []).filter(x => x.status === 'active').length}</b><small>Active nozzles</small></div><div><b>{(stationWorkspace.operations.tank_stock_checks || []).filter(x => Math.abs(Number(x.variance_litres || 0)) >= 0.01).length + (stationWorkspace.operations.kg_tank_stock_checks || []).filter(x => Math.abs(Number(x.variance_kg || 0)) >= 0.01).length}</b><small>Recent stock-check variances</small></div></div></section>}
    </>}

    <div className="section-title-row"><div><h2>{attendant && !manager ? 'My shift shortcuts' : 'Operations shortcuts'}</h2><p>{attendant && !manager ? 'Start with attendance, then record meter readings and collections for your assigned station.' : 'Open a module to manage the records permitted for your role.'}</p></div></div>
    <div className="shortcut-grid">
      {(owner || manager) && <Link to="/stations" className="shortcut-card"><Building2/><span><b>Stations & branches</b><small>{owner ? 'Create branches and review company-wide assignments.' : 'Open your assigned branch.'}</small></span><ArrowUpRight/></Link>}
      {(owner || manager) && <Link to="/team" className="shortcut-card"><Users/><span><b>People & invitations</b><small>{owner ? 'Invite managers and attendants.' : 'Manage permitted branch team access.'}</small></span><ArrowUpRight/></Link>}
      <Link to="/attendance" className="shortcut-card"><Clock3/><span><b>{attendant && !manager ? 'My attendance' : 'Attendance'}</b><small>{attendant && !manager ? 'Clock in or out and review your own shift records.' : 'Review attendance entries and exceptions.'}</small></span><ArrowUpRight/></Link>
      {(owner || manager) && <Link to="/inventory" className="shortcut-card"><Fuel/><span><b>Fuel inventory</b><small>Configure products, tanks and stock checks.</small></span><ArrowUpRight/></Link>}
      <Link to="/sales" className="shortcut-card"><Receipt/><span><b>{attendant && !manager ? 'Meter readings & collections' : 'Sales & reconciliation'}</b><small>{attendant && !manager ? 'Record your meter readings and payment collections.' : 'Record sales and reconcile collections.'}</small></span><ArrowUpRight/></Link>
      {(owner || manager) && <Link to="/controls" className="shortcut-card"><Scale/><span><b>Tank & cash controls</b><small>Review stock controls, cash shifts and reconciliations.</small></span><ArrowUpRight/></Link>}
      {(owner || manager) && <div className="shortcut-card shortcut-static"><Activity/><span><b>Audit trail</b><small>Review recorded actions in the permitted scope.</small></span></div>}
    </div>
    {owner && <section className="content-card company-audit-card"><div className="card-heading"><ShieldCheck/><div><h2>Recent company activity</h2><p>Recorded audit events across your branches.</p></div><Link className="text-btn" to="/governance">Open governance</Link></div>{audit.length === 0 ? <p className="loading-line">No company-wide audit events are available yet.</p> : <div className="record-list">{audit.slice(0, 8).map(event => <div className="record-row" key={event.id}><span className="record-icon"><Activity size={17}/></span><div className="record-main"><b>{event.action.replaceAll('_', ' ')}</b><small>{event.station_name} · {event.entity_type} · {new Date(event.created_at).toLocaleString()}</small></div><span className="status-badge">Recorded</span></div>)}</div>}</section>}
  </>;
}
