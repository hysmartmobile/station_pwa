import { formatMoney, getPreferredCurrency } from '../lib/currency';
import { useEffect, useMemo, useState } from 'react';
import { Banknote, CheckCircle2, ClipboardList, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import Notice from '../components/Notice';
import StatCard from '../components/StatCard';
import { useAuth } from '../features/auth/AuthContext';
import { apiRequest } from '../lib/api';

const dateString=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const money = value => formatMoney(value);
const shortId=id=>`${String(id||'').slice(0,8)}…${String(id||'').slice(-4)}`;
export default function PayrollPage(){
 const {session,user}=useAuth(); const today=dateString(new Date()); const monthStart=`${today.slice(0,7)}-01`;
 const [data,setData]=useState({stations:[],staff:[],payroll:[],expenses:[],permissions:{}}); const [stationId,setStationId]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState('');
 const [form,setForm]=useState({employeeUserId:'',periodStart:monthStart,periodEnd:today,basicSalary:'',allowances:'0',deductions:'0',reference:'PAY-',notes:''});
 const [expense,setExpense]=useState({category:'utilities',description:'',amount:'',incurredOn:today,reference:''});
 async function load(){if(!session)return;setBusy(true);setError('');try{const result=await apiRequest('/payroll',{token:session.access_token});
  // API responses can legitimately omit collections for users with no active branch access.
  // Normalize every collection before rendering so `.length`, `.filter`, and `.map` are safe.
  const payload=result&&typeof result==='object'?result:{};
  const normalized={...payload,stations:Array.isArray(payload.stations)?payload.stations:[],staff:Array.isArray(payload.staff)?payload.staff:[],payroll:Array.isArray(payload.payroll)?payload.payroll:[],expenses:Array.isArray(payload.expenses)?payload.expenses:[],permissions:payload.permissions&&typeof payload.permissions==='object'?payload.permissions:{},truncated:payload.truncated===true};
  setData(normalized);setStationId(old=>old&&normalized.stations.some(s=>s.id===old)?old:(normalized.stations[0]?.id||''));
 }catch(e){setError(e.message||'Could not load payroll and branch expenses.')}finally{setBusy(false)}}
 useEffect(()=>{load()},[session]);
 const selectedStaff=useMemo(()=>data.staff.filter(s=>s.station_id===stationId),[data.staff,stationId]);
 const currentStation=data.stations.find(s=>s.id===stationId);
 const ownMember=selectedStaff.find(s=>s.user_id===user?.id);
 const myPayroll=data.payroll.filter(p=>p.submitted_by===user?.id).length;
 const pending=data.payroll.filter(p=>p.status==='pending').length;
 const unpaid=data.payroll.filter(p=>p.status==='approved'&&p.payment_status==='unpaid').length;
 async function submitPayroll(e){e.preventDefault();setError('');setNotice('');try{await apiRequest('/payroll',{token:session.access_token,method:'POST',body:{stationId,employeeUserId:form.employeeUserId,periodStart:form.periodStart,periodEnd:form.periodEnd,basicSalary:form.basicSalary,allowances:form.allowances,deductions:form.deductions,reference:form.reference,notes:form.notes}});setNotice('Salary submitted. It remains outside approved expenses until a different company owner/director approves it.');setForm(f=>({...f,basicSalary:'',allowances:'0',deductions:'0',reference:'PAY-',notes:''}));await load()}catch(e){setError(e.message||'Could not submit salary.')}}
 async function submitExpense(e){e.preventDefault();setError('');setNotice('');try{await apiRequest('/companies/expenses',{token:session.access_token,method:'POST',body:{stationId,category:expense.category,description:expense.description,amount:expense.amount,incurredOn:expense.incurredOn,reference:expense.reference}});setNotice('Expense recorded for independent review. It will not affect profit and loss until approved.');setExpense(x=>({...x,description:'',amount:'',reference:''}));await load()}catch(e){setError(e.message||'Could not submit branch expense.')}}
 async function reviewPayroll(row,approve){const note=window.prompt(approve?'Approval note (optional):':'Reason for rejection (required):',approve?'Payroll period and amount checked':'Supporting payroll record needs correction');if(note===null)return;if(!approve&&!note.trim()){setError('Provide a reason when rejecting payroll.');return}try{await apiRequest(`/payroll/${row.id}/review`,{token:session.access_token,method:'POST',body:{approve,note}});setNotice(approve?'Payroll approved and included in the branch operating expenses.':'Payroll rejected and excluded from operating expenses.');await load()}catch(e){setError(e.message||'Could not review payroll')}}
 async function markPaid(row){const method=window.prompt('Payment method: cash, bank_transfer, pos, or other','bank_transfer');if(!method)return;const normalized=method.trim().toLowerCase();if(!['cash','bank_transfer','pos','other'].includes(normalized)){setError('Choose cash, bank_transfer, pos or other.');return}const reference=window.prompt('Bank transfer / receipt / payment reference:');if(!reference||reference.trim().length<3){setError('A valid payment reference is required.');return}try{await apiRequest(`/payroll/${row.id}/pay`,{token:session.access_token,method:'POST',body:{paymentMethod:normalized,paymentReference:reference.trim()}});setNotice('Payment evidence saved and audit logged.');await load()}catch(e){setError(e.message||'Could not record payroll payment')}}
 const staffLabel=s=>`${s.role==='STATION_MANAGER'?'Manager':'Attendant'} · ${s.user_id===user?.id?'You · ':''}${shortId(s.user_id)}`;
 return <>
  <SectionHeader eyebrow="BRANCH ACCOUNTABILITY" title="Payroll & branch expenses" description="Managers record each attendant’s salary and their own salary for their assigned branch. Company owners/directors independently approve payroll and verify payment evidence." action={<button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={15}/>{busy?'Refreshing…':'Refresh'}</button>}/>
  {error&&<Notice type="error">{error}</Notice>}{notice&&<Notice type="success">{notice}</Notice>}{data.truncated&&<Notice type="warning">The payroll/expense register reached the safety cap. Export or narrow the reporting period before treating the displayed list as a complete history.</Notice>}
  {!data.stations.length&&<Notice type="warning">No active branch access was found. Ask the company owner to assign you to a branch or check your company membership.</Notice>}
  <div className="stat-grid"><StatCard label="Payroll awaiting review" value={pending} detail="Not yet included in profit and loss" icon={ClipboardList}/><StatCard label="Approved, unpaid payroll" value={unpaid} detail="Approved salary records awaiting payment" icon={Wallet}/><StatCard label="My submissions" value={myPayroll} detail="Payroll records submitted by your account" icon={ShieldCheck}/><StatCard label="Branch records" value={data.payroll.length+data.expenses.length} detail="Payroll and operating expense entries" icon={Banknote}/></div>
  <section className="content-card"><div className="card-heading"><Banknote/><div><h2>Record staff salary</h2><p>Submit one salary per employee and pay period. Net salary is calculated by the system; duplicate employee/pay-period submissions are blocked.</p></div></div>
   <form className="inline-form" onSubmit={submitPayroll}>
    <div><label>Branch</label><select required value={stationId} onChange={e=>{setStationId(e.target.value);setForm(f=>({...f,employeeUserId:''}))}}>{data.stations.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
    <div><label>Employee</label><select required value={form.employeeUserId} onChange={e=>setForm(f=>({...f,employeeUserId:e.target.value}))}><option value="">Select assigned staff</option>{selectedStaff.map(s=><option key={s.user_id} value={s.user_id}>{staffLabel(s)}</option>)}</select></div>
    <div><label>Period starts</label><input required type="date" value={form.periodStart} max={form.periodEnd} onChange={e=>setForm(f=>({...f,periodStart:e.target.value}))}/></div>
    <div><label>Period ends</label><input required type="date" value={form.periodEnd} min={form.periodStart} onChange={e=>setForm(f=>({...f,periodEnd:e.target.value}))}/></div>
    <div><label>Basic salary ({getPreferredCurrency()})</label><input required type="number" min="0" step="0.01" value={form.basicSalary} onChange={e=>setForm(f=>({...f,basicSalary:e.target.value}))}/></div>
    <div><label>Allowances ({getPreferredCurrency()})</label><input required type="number" min="0" step="0.01" value={form.allowances} onChange={e=>setForm(f=>({...f,allowances:e.target.value}))}/></div>
    <div><label>Deductions ({getPreferredCurrency()})</label><input required type="number" min="0" step="0.01" value={form.deductions} onChange={e=>setForm(f=>({...f,deductions:e.target.value}))}/></div>
    <div><label>Payroll reference</label><input required minLength="3" maxLength="120" value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))} placeholder="PAY-2026-10-ATT-01"/></div>
    <div className="form-wide"><label>Notes (optional)</label><input maxLength="1000" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Approved salary scale, attendance basis, overtime explanation…"/></div>
    <div className="form-wide"><b>Calculated net salary: {money(Math.max(0,Number(form.basicSalary||0)+Number(form.allowances||0)-Number(form.deductions||0)))}</b></div>
    <button className="btn btn-primary" disabled={busy||!stationId||!form.employeeUserId}>Submit salary for owner/director approval</button>
   </form>
   <p className="report-footnote">Managers may record salaries for attendants in their branch and their own salary. Managers cannot approve payroll or mark payroll paid. Owners/directors cannot approve their own submissions.</p>
  </section>
  <section className="content-card"><div className="card-heading"><Wallet/><div><h2>Record other branch expense</h2><p>Log rent, utilities, repairs, transport, bank charges and other operating costs with a receipt or transfer reference. Record salaries only in Payroll to avoid double-counting staff costs.</p></div></div>
   <form className="inline-form" onSubmit={submitExpense}>
    <div><label>Branch</label><select required value={stationId} onChange={e=>setStationId(e.target.value)}>{data.stations.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
    <div><label>Category</label><select value={expense.category} onChange={e=>setExpense(x=>({...x,category:e.target.value}))}>{['utilities','staff','maintenance','security','transport','bank_charges','rent','taxes','generator_fuel','licenses','office_supplies','insurance','communications','staff_welfare','professional_fees','repairs','other'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></div>
    <div><label>Date incurred</label><input required type="date" value={expense.incurredOn} onChange={e=>setExpense(x=>({...x,incurredOn:e.target.value}))}/></div>
    <div><label>Amount ({getPreferredCurrency()})</label><input required type="number" min="0.01" step="0.01" value={expense.amount} onChange={e=>setExpense(x=>({...x,amount:e.target.value}))}/></div>
    <div><label>Description</label><input required minLength="3" maxLength="500" value={expense.description} onChange={e=>setExpense(x=>({...x,description:e.target.value}))} placeholder="What was purchased or paid?"/></div>
    <div><label>Receipt / transfer reference</label><input required minLength="2" maxLength="100" value={expense.reference} onChange={e=>setExpense(x=>({...x,reference:e.target.value}))}/></div>
    <button className="btn btn-primary" disabled={busy||!stationId}>Submit expense for independent review</button>
   </form>
  </section>
  <section className="content-card"><div className="card-heading"><ClipboardList/><div><h2>Payroll register</h2><p>Submission, approval and payment are separate steps. The audit log records each transition.</p></div></div>
   {data.payroll.length===0?<p className="loading-line">No payroll has been recorded for your accessible branches yet.</p>:<div className="table-scroll"><table className="data-table"><thead><tr><th>Branch / employee</th><th>Pay period</th><th>Basic</th><th>Allowances</th><th>Deductions</th><th>Net salary</th><th>Approval / payment</th><th>Actions</th></tr></thead><tbody>{data.payroll.filter(p=>!stationId||p.station_id===stationId).map(p=><tr key={p.id}><td><b>{data.stations.find(s=>s.id===p.station_id)?.name||shortId(p.station_id)}</b><small className="table-subline">{p.employee_role==='STATION_MANAGER'?'Manager':'Attendant'} · {shortId(p.employee_user_id)}</small><small className="table-subline">Ref: {p.reference}</small></td><td>{p.period_start} – {p.period_end}</td><td>{money(p.basic_salary)}</td><td>{money(p.allowances)}</td><td>{money(p.deductions)}</td><td><b>{money(p.net_salary)}</b></td><td><span className={`status-badge ${p.status==='approved'?'':'status-pending'}`}>{p.status}</span><small className="table-subline">{p.payment_status==='paid'?`Paid · ${p.payment_method} · ${p.payment_reference}`:p.status==='approved'?'Approved · unpaid':'Not payable yet'}</small></td><td>{data.permissions.canReview&&p.status==='pending'&&p.submitted_by!==user?.id&&<><button className="btn btn-outline" onClick={()=>reviewPayroll(p,true)}>Approve</button> <button className="btn btn-outline" onClick={()=>reviewPayroll(p,false)}>Reject</button></>}{data.permissions.canMarkPaid&&p.status==='approved'&&p.payment_status==='unpaid'&&p.submitted_by!==user?.id&&<button className="btn btn-outline" onClick={()=>markPaid(p)}>Record payment</button>}</td></tr>)}</tbody></table></div>}
  </section>
  <section className="content-card"><div className="card-heading"><Wallet/><div><h2>Branch expense register</h2><p>Pending items remain visible for traceability but are excluded from profit and loss until approved.</p></div></div>
   {data.expenses.length===0?<p className="loading-line">No operating expenses recorded for accessible branches.</p>:<div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Branch</th><th>Category / description</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead><tbody>{data.expenses.filter(e=>!stationId||e.station_id===stationId).map(e=><tr key={e.id}><td>{e.incurred_on}</td><td>{data.stations.find(s=>s.id===e.station_id)?.name||shortId(e.station_id)}</td><td>{e.category}<small className="table-subline">{e.description}</small></td><td>{e.reference}</td><td>{money(e.amount)}</td><td><span className={`status-badge ${e.status==='approved'?'':'status-pending'}`}>{e.status}</span></td></tr>)}</tbody></table></div>}
  </section>
 </>;
}
