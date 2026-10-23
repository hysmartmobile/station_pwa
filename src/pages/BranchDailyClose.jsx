import { formatMoney } from '../lib/currency';
import { useEffect, useState } from 'react';
import { CalendarCheck, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import Notice from '../components/Notice';
import { apiRequest } from '../lib/api';
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const money = value => formatMoney(value);
export default function BranchDailyClose({session,stationId,canManage}) {
 const [date,setDate]=useState(today),[report,setReport]=useState(null),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){if(!session||!stationId)return;setBusy(true);setError('');try{setReport(await apiRequest(`/controls/daily-closing?stationId=${encodeURIComponent(stationId)}&date=${encodeURIComponent(date)}`,{token:session.access_token}));}catch(e){setError(e.message||'Could not load branch daily close.');setReport(null)}finally{setBusy(false)}}
 useEffect(()=>{load()},[session,stationId,date]);
 async function submit(){setBusy(true);setError('');setNotice('');try{await apiRequest('/controls/daily-closing/submit',{token:session.access_token,method:'POST',body:{stationId,businessDate:date,managerNote:note}});setNotice('Daily close submitted for company-owner review.');setNote('');await load()}catch(e){setError(e.message||'Could not submit daily close.')}finally{setBusy(false)}}
 if(!canManage)return null;
 const s=report?.summary||{};
 return <section className="content-card"><div className="card-heading"><CalendarCheck/><div><h2>Branch daily closing</h2><p>Review your branch’s shift reconciliation and submit the daily close for independent owner review.</p></div><button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={15}/>{busy?'Loading…':'Refresh'}</button></div>
 <div className="report-filter-row"><label>Business date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div>{error&&<Notice type="error">{error}</Notice>}{notice&&<Notice type="success">{notice}</Notice>}
 {report&&<><div className="stat-grid"><article className="stat-card"><div className="stat-top">Cashier shifts</div><strong>{s.shiftCount??0}</strong><p>{s.openShifts??0} still open</p></article><article className="stat-card"><div className="stat-top">Reconciled</div><strong>{s.reconciledShifts??0}</strong><p>{s.unreconciledShifts??0} awaiting reconciliation</p></article><article className="stat-card"><div className="stat-top">Expected sales</div><strong>{money(s.expectedSales)}</strong><p>Meter-derived, approved sales</p></article><article className="stat-card"><div className="stat-top">Net collections</div><strong>{money(s.collections)}</strong><p>Sales variance {money(s.salesVariance)}</p></article></div>
 {report.blockers?.length>0&&<Notice type="warning">Daily close is not ready: {report.blockers.join(' ')}</Notice>}{report.submission&&<Notice type={report.submission.status==='approved'?'success':report.submission.status==='rejected'?'error':'info'}>Owner review status: {report.submission.status.replaceAll('_',' ')}{report.submission.review_note?` — ${report.submission.review_note}`:''}</Notice>}
 <label>Handover note (optional)<textarea rows="3" maxLength="1500" value={note} onChange={e=>setNote(e.target.value)} placeholder="Explain material variances, incidents, stock concerns or follow-up actions."/></label>
 <button className="btn btn-primary" onClick={submit} disabled={busy||!report.ready||report.submission?.status==='submitted'||report.submission?.status==='approved'}><Send size={15}/>{busy?'Submitting…':report.submission?.status==='submitted'?'Awaiting owner review':report.submission?.status==='approved'?'Daily close approved':'Submit daily close for owner review'}</button>
 <p className="report-footnote"><ShieldCheck size={14}/> Submission does not post accounting entries or auto-close shifts. Any variance remains a review signal requiring human investigation.</p></>}
 </section>;
}
