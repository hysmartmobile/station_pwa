import { getPreferredCurrency } from '../lib/currency';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Clock3, RefreshCw, ShieldAlert, ShieldCheck, Mail, MessageSquare, Smartphone } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import StatCard from '../components/StatCard';
import Notice from '../components/Notice';
import EmptyState from '../components/EmptyState';
import { apiRequest } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';

const severityLabel = { critical: 'Urgent', warning: 'Review', info: 'Pending approval' };
const severityIcon = { critical: ShieldAlert, warning: AlertTriangle, info: Clock3 };
export default function AlertsPage() {
  const { session } = useAuth();
  const [profile, setProfile] = useState(null);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scopeQuery, setScopeQuery] = useState('');
  const [preferences, setPreferences] = useState({ openShiftHours: 12, litreStockVariance: 10, kgStockVariance: 5, cashVarianceNgn: 1000, collectionGapNgn: 10000, dailySummaryEnabled: true });
  const [summary, setSummary] = useState(null);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState([]);
  const [deliveryHistory, setDeliveryHistory] = useState([]);
  const [deliveryStatus, setDeliveryStatus] = useState(null);
  const [deliveryStatusError, setDeliveryStatusError] = useState('');
  const [retryingDeliveryId, setRetryingDeliveryId] = useState('');
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationNote, setNotificationNote] = useState('');
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError('');
    try {
      const me = await apiRequest('/me', { token: session.access_token });
      setProfile(me);
      const isOwner = me.companies?.some(c => ['COMPANY_OWNER', 'COMPANY_ADMIN'].includes(c.role) && c.status === 'active');
      let query = '';
      if (!isOwner) {
        const membership = me.stationMemberships?.find(m => m.status === 'active' && m.role === 'STATION_MANAGER');
        const stationId = membership?.station_id || membership?.stationId;
        if (!stationId) throw new Error('Management alerts are available to the company owner or an assigned branch manager.');
        query = `?stationId=${encodeURIComponent(stationId)}`;
      }
      setScopeQuery(query);
      // Persist current management alerts into the user's in-app inbox; this is independent of email delivery.
      try { await apiRequest('/notifications/sync-management-alerts', { token: session.access_token, method: 'POST' }); window.dispatchEvent(new Event('hysmart:notifications-refresh')); } catch {}
      const [data, prefs, daily, notificationSettings, history] = await Promise.all([apiRequest(`/alerts${query}`, { token: session.access_token }), apiRequest(`/alerts/preferences${query}`, { token: session.access_token }), apiRequest(`/alerts/daily-summary${query}`, { token: session.access_token }), apiRequest(`/alerts/notification-preferences${query}`, { token: session.access_token }), apiRequest(`/alerts/delivery-history${query}`, { token: session.access_token })]);
      setPayload(data); setPreferences(prefs.preferences); setSummary(daily); setNotificationPreferences(notificationSettings.preferences || []); setNotificationNote(notificationSettings.note || ''); setDeliveryHistory(history.history || []);
      try { setDeliveryStatus(await apiRequest('/notifications/delivery-status', { token: session.access_token })); setDeliveryStatusError(''); } catch (deliveryError) { setDeliveryStatus(null); setDeliveryStatusError(deliveryError.message || 'Delivery monitoring is unavailable. Apply migration 0030 and verify your role scope.'); }
    } catch (e) { setError(e.message || 'Unable to load management alerts.'); setPayload(null); }
    finally { setLoading(false); }
  }, [session]);
  useEffect(() => { load(); }, [load]);
  const alerts = payload?.alerts || [];
  async function savePreferences(event) { event.preventDefault(); if (!session) return; setSavingPreferences(true); setPreferencesMessage(''); try { const body = { ...preferences, stationId: scopeQuery ? new URLSearchParams(scopeQuery).get('stationId') : null }; const saved = await apiRequest('/alerts/preferences', { token: session.access_token, method: 'PUT', body }); setPreferences(saved.preferences); setPreferencesMessage('Alert thresholds saved.'); await load(); } catch (e) { setPreferencesMessage(e.message || 'Unable to save alert thresholds.'); } finally { setSavingPreferences(false); } }
  const isOwner = profile?.companies?.some(c => ['COMPANY_OWNER', 'COMPANY_ADMIN'].includes(c.role) && c.status === 'active');
  async function saveNotificationPreferences(event) {
    event.preventDefault(); if (!session) return;
    setSavingNotifications(true); setNotificationMessage('');
    try {
      const body = { stationId: scopeQuery ? new URLSearchParams(scopeQuery).get('stationId') : null, preferences: notificationPreferences };
      const saved = await apiRequest('/alerts/notification-preferences', { token: session.access_token, method: 'PUT', body });
      setNotificationPreferences(saved.preferences || []); setNotificationNote(saved.note || '');
      setNotificationMessage('Notification settings saved.');
      const history = await apiRequest(`/alerts/delivery-history${scopeQuery}`, { token: session.access_token }); setDeliveryHistory(history.history || []);
    } catch (e) { setNotificationMessage(e.message || 'Unable to save notification settings.'); }
    finally { setSavingNotifications(false); }
  }
  const updateNotification = (channel, patch) => setNotificationPreferences(rows => rows.map(row => row.channel === channel ? { ...row, ...patch } : row));
  async function retryDeliveryJob(id) { if (!session) return; setRetryingDeliveryId(id); setDeliveryStatusError(''); try { await apiRequest(`/notifications/delivery/${id}/retry`, { token: session.access_token, method: 'POST' }); setDeliveryStatus(await apiRequest('/notifications/delivery-status', { token: session.access_token })); setDeliveryStatusError('Retry queued. This is not confirmation of delivery.'); } catch (e) { setDeliveryStatusError(e.message || 'Unable to queue this retry.'); } finally { setRetryingDeliveryId(''); } }
  const channelIcon = { in_app: BellRing, email: Mail, sms: MessageSquare, push: Smartphone };
  const actionLink = (type) => ({ overdue_attendance: '/attendance', open_cash_shift: '/sales', cash_variance: '/sales', litre_stock_variance: '/controls', kg_stock_variance: '/sales', pending_litre_adjustment: '/controls', pending_kg_adjustment: '/controls', collection_gap: '/sales' })[type] || '/';
  return <>
    <SectionHeader eyebrow="MANAGEMENT CONTROL" title="Operational alerts" description={isOwner ? 'Prioritized exceptions across your company branches.' : 'Prioritized exceptions for your assigned branch.'} action={<button className="btn btn-outline" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''}/>{loading ? 'Refreshing…' : 'Refresh alerts'}</button>} />
    {error && <Notice type="error">{error}</Notice>}
    <div className="stat-grid company-stat-grid"><StatCard label="Urgent" value={payload ? payload.summary.critical : '—'} detail="Needs prompt investigation" icon={ShieldAlert}/><StatCard label="Review" value={payload ? payload.summary.warning : '—'} detail="Operational exceptions" icon={AlertTriangle}/><StatCard label="Pending approvals" value={payload ? payload.summary.info : '—'} detail="Requests awaiting review" icon={Clock3}/><StatCard label="Total alerts" value={payload ? payload.summary.total : '—'} detail={`${payload?.branchCount ?? '—'} branches in scope`} icon={BellRing}/></div>
    <section className="content-card"><div className="card-heading"><BellRing/><div><h2>Prioritized action list</h2><p>Alerts are generated from recent saved operational records and refresh on request.</p></div></div>
      {loading && !payload ? <p className="loading-line">Checking recent operational records…</p> : alerts.length === 0 ? <EmptyState icon={CheckCircle2} title="No alerts found" description="There are no matching exceptions in the records checked. This does not replace the normal shift-closing and physical stock-check process."/> : <div className="record-list">{alerts.map(alert => { const Icon = severityIcon[alert.severity] || AlertTriangle; return <article className="record-row" key={alert.id}><span className="record-icon"><Icon size={18}/></span><div className="record-main"><div className="alert-title-row"><b>{alert.title}</b><span className={`status-badge ${alert.severity === 'critical' ? 'status-danger' : alert.severity === 'warning' ? 'status-pending' : ''}`}>{severityLabel[alert.severity]}</span></div><small>{alert.branch} · {alert.detail}</small><a className="alert-action-link" href={actionLink(alert.type)}>{alert.action} →</a></div></article>; })}</div>}
      {payload?.note && <p className="report-footnote">{payload.note}</p>}
    </section>
    <section className="content-card"><div className="card-heading"><BellRing/><div><h2>Daily management summary</h2><p>Generated on request from recent records and current open items.</p></div></div><div className="alert-threshold-grid"><div><b>Total alerts</b><span>{summary?.totalAlerts ?? '—'}</span></div><div><b>Urgent</b><span>{summary?.critical ?? '—'}</span></div><div><b>Warnings</b><span>{summary?.warnings ?? '—'}</span></div><div><b>Pending approvals</b><span>{summary?.pendingApprovals ?? '—'}</span></div></div><p className="report-footnote">{summary?.note || 'Daily summary is available in the app. Scheduled email, SMS and push notifications require an external delivery provider and are not enabled.'}</p></section>
    <section className="content-card"><div className="card-heading"><BellRing/><div><h2>Notification delivery settings</h2><p>{isOwner ? 'Configure company-wide recipients, or manage a specific branch from its branch view.' : 'These settings apply only to your assigned branch.'}</p></div></div>
      <p className="report-footnote">In-app alerts are available within HySmart. Email and SMS settings can be saved now, but external delivery is not active until a provider and secure worker are configured. No provider credentials are stored in these settings.</p>
      <form className="form-grid" onSubmit={saveNotificationPreferences}>
        {notificationPreferences.map(pref => { const Icon = channelIcon[pref.channel] || BellRing; const label = pref.channel === 'in_app' ? 'In-app alerts' : pref.channel === 'email' ? 'Email notifications' : 'SMS notifications'; return <div className="content-card" key={pref.channel} style={{ margin: 0 }}><div className="card-heading"><Icon/><div><h3>{label}</h3><p>{pref.channel === 'in_app' ? 'Shown inside HySmart.' : pref.channel === 'email' ? 'Daily summaries and urgent alerts by email.' : 'Urgent alerts by text message.'}</p></div></div><label className="checkbox-row"><input type="checkbox" checked={Boolean(pref.enabled)} onChange={e=>updateNotification(pref.channel,{enabled:e.target.checked})}/> Enable {label.toLowerCase()}</label>{pref.channel !== 'in_app' && <label>{pref.channel === 'email' ? 'Recipient email' : 'Recipient phone number'}<input type={pref.channel === 'email' ? 'email' : 'tel'} value={pref.recipient || ''} placeholder={pref.channel === 'email' ? 'manager@example.com' : '+2348012345678'} onChange={e=>updateNotification(pref.channel,{recipient:e.target.value})} required={Boolean(pref.enabled)} /></label>}<label className="checkbox-row"><input type="checkbox" checked={Boolean(pref.dailySummary)} onChange={e=>updateNotification(pref.channel,{dailySummary:e.target.checked})} disabled={!pref.enabled}/> Receive daily summary</label><label className="checkbox-row"><input type="checkbox" checked={Boolean(pref.criticalAlerts)} onChange={e=>updateNotification(pref.channel,{criticalAlerts:e.target.checked})} disabled={!pref.enabled}/> Receive critical alerts</label></div>; })}
        <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={savingNotifications || !notificationPreferences.length}>{savingNotifications ? 'Saving…' : 'Save notification settings'}</button>{notificationMessage && <span role="status">{notificationMessage}</span>}</div>
      </form>
      {notificationNote && <p className="report-footnote">{notificationNote}</p>}
      <h3>Delivery worker health and retry controls</h3>
      {deliveryStatusError && <Notice type={deliveryStatusError.startsWith('Retry queued') ? 'success' : 'error'}>{deliveryStatusError}</Notice>}
      {deliveryStatus ? <><div className="alert-threshold-grid"><div><b>Queued</b><span>{deliveryStatus.counts.queued}</span></div><div><b>Sent</b><span>{deliveryStatus.counts.sent}</span></div><div><b>Failed</b><span>{deliveryStatus.counts.failed}</span></div><div><b>Worker status</b><span>{deliveryStatus.worker.status}{deliveryStatus.worker.stale ? ' · stale/unknown' : ''}</span></div></div><p className="report-footnote">Last completed: {deliveryStatus.worker.lastCompletedAt ? new Date(deliveryStatus.worker.lastCompletedAt).toLocaleString() : 'No successful run recorded'}. Monitoring is stale if no recent heartbeat is recorded. A provider acceptance or a queued retry does not prove the recipient received or read the email.</p>{deliveryStatus.worker.error && <Notice type="error">Last worker error: {deliveryStatus.worker.error}</Notice>}<div className="table-wrap"><table><thead><tr><th>Created</th><th>Type</th><th>Status</th><th>Recipient</th><th>Failure detail</th><th>Action</th></tr></thead><tbody>{deliveryStatus.jobs.map(job => <tr key={job.id}><td>{job.created_at ? new Date(job.created_at).toLocaleString() : '—'}</td><td>{job.notification_type}</td><td><span className={`status-badge ${job.status === 'failed' ? 'status-danger' : job.status === 'sent' ? 'status-success' : 'status-pending'}`}>{job.status}</span></td><td>{job.recipient_masked || '—'}</td><td>{job.error_code || job.lastError || '—'}{job.retryCount ? ` · retries ${job.retryCount}` : ''}</td><td>{job.retryable ? <button className="btn btn-outline" type="button" disabled={Boolean(retryingDeliveryId)} onClick={() => retryDeliveryJob(job.id)}>{retryingDeliveryId === job.id ? 'Queuing…' : 'Retry'}</button> : '—'}</td></tr>)}</tbody></table></div></> : !deliveryStatusError ? <p className="report-footnote">Loading delivery worker status…</p> : <p className="report-footnote">Delivery monitoring could not be loaded. Confirm migration 0030 is applied and the worker is configured.</p>}
      <h3>Recent delivery log</h3>{deliveryHistory.length ? <div className="table-wrap"><table><thead><tr><th>Time</th><th>Channel</th><th>Type</th><th>Status</th><th>Recipient</th></tr></thead><tbody>{deliveryHistory.map(item=><tr key={item.id}><td>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</td><td>{item.channel}</td><td>{item.notification_type}</td><td><span className={`status-badge ${item.status === 'failed' ? 'status-danger' : item.status === 'sent' ? 'status-success' : 'status-pending'}`}>{item.status}</span></td><td>{item.recipient_masked || '—'}</td></tr>)}</tbody></table></div> : <p className="report-footnote">No delivery attempts have been logged for this scope.</p>}
    </section>
    <section className="content-card"><div className="card-heading"><ShieldCheck/><div><h2>Configurable alert thresholds</h2><p>Thresholds are saved for this company or branch. They prioritize review, not findings of misconduct.</p></div></div><form className="form-grid" onSubmit={savePreferences}><label>Open shift (hours)<input type="number" min="1" max="72" value={preferences.openShiftHours} onChange={e=>setPreferences(v=>({...v,openShiftHours:Number(e.target.value)}))} required /></label><label>Stock variance (litres)<input type="number" min="0.001" step="0.001" value={preferences.litreStockVariance} onChange={e=>setPreferences(v=>({...v,litreStockVariance:Number(e.target.value)}))} required /></label><label>LPG variance (kg)<input type="number" min="0.001" step="0.001" value={preferences.kgStockVariance} onChange={e=>setPreferences(v=>({...v,kgStockVariance:Number(e.target.value)}))} required /></label><label>Cash variance ({getPreferredCurrency()})<input type="number" min="0.01" step="0.01" value={preferences.cashVarianceNgn} onChange={e=>setPreferences(v=>({...v,cashVarianceNgn:Number(e.target.value)}))} required /></label><label>Sales/collection gap ({getPreferredCurrency()})<input type="number" min="0.01" step="0.01" value={preferences.collectionGapNgn} onChange={e=>setPreferences(v=>({...v,collectionGapNgn:Number(e.target.value)}))} required /></label><label className="checkbox-row"><input type="checkbox" checked={preferences.dailySummaryEnabled} onChange={e=>setPreferences(v=>({...v,dailySummaryEnabled:e.target.checked}))}/> Enable daily summary indicator</label><div className="form-actions"><button className="btn btn-primary" type="submit" disabled={savingPreferences}>{savingPreferences ? 'Saving…' : 'Save thresholds'}</button>{preferencesMessage && <span role="status">{preferencesMessage}</span>}</div></form><div className="alert-threshold-grid"><div><b>Open shift</b><span>12 hours or more</span></div><div><b>Petrol/diesel/kerosene stock variance</b><span>10 litres or more</span></div><div><b>LPG stock variance</b><span>5 kg or more</span></div><div><b>Cash closing variance</b><span>{getPreferredCurrency()} 1,000 or more</span></div><div><b>Sales-to-collection gap</b><span>{getPreferredCurrency()} 10,000 or more</span></div></div></section>
  </>;
}
