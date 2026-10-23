import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Building2, Users, ClipboardCheck, Fuel, Receipt, Scale, ShieldCheck, FileSpreadsheet, Banknote, ArrowLeftRight, Cable, BellRing, MessageSquare, LifeBuoy, KeyRound, Search, CheckCircle2, AlertTriangle, ChevronRight, CircleHelp, Gauge, Settings2 } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { apiRequest } from '../lib/api';
import Notice from '../components/Notice';

const roleContent = {
  owner: {
    label: 'Company owner / director',
    intro: 'Set up the company, establish controls, appoint the team and review performance across the branches you are authorised to manage.',
    first: '/getting-started',
    firstLabel: 'Open setup checklist',
    principles: ['Keep company and branch details accurate.', 'Give each person only the role and branch access they need.', 'Review approvals, reconciliation, handovers and audit history regularly.', 'Do not treat pending readings or unapproved adjustments as final accounts.'],
    steps: [
      ['Create branches', 'Open Stations & branches. Add each real station with its correct details; avoid creating duplicate branches.', '/stations', 'Set up branches', Building2],
      ['Configure fuel and equipment', 'Set up fuel products, tanks, pumps and nozzles. Confirm that each nozzle points to the correct pump, tank and product, and that units match (litres or kilograms).', '/controls', 'Configure controls', Fuel],
      ['Invite and assign people', 'Use People & invites to invite managers and attendants. Assign the correct branch and role; verify the invitation and membership status.', '/team', 'Manage team', Users],
      ['Set operating rules', 'Review audit, approvals and dispute controls. Keep meter approvals and financial separation of duties enabled according to company policy.', '/governance', 'Review governance', ShieldCheck],
      ['Review daily performance', 'Use sales, reports, accountability, alerts and daily closing to compare expected sales, collections, handovers and unresolved exceptions.', '/reports', 'Open reports', FileSpreadsheet],
      ['Maintain company access', 'Review company settings, account security and support when responsibilities, staff or business details change.', '/company-settings', 'Company settings', Settings2],
    ],
  },
  manager: {
    label: 'Station manager',
    intro: 'Run the assigned branch, prepare the team and equipment, monitor sales and stock, and resolve exceptions within your permissions.',
    first: '/', firstLabel: 'Open branch overview',
    principles: ['Work only with branches and records you are authorised to access.', 'Confirm equipment setup before a shift begins.', 'Review opening and closing readings and approval status.', 'Investigate cash differences and handovers; never alter records to hide a variance.'],
    steps: [
      ['Check branch and team readiness', 'Review the branch, active staff, attendance and assigned roles before operations begin.', '/stations', 'Review branch', Building2],
      ['Check fuel inventory and equipment', 'Confirm products, tanks, pumps, nozzles and stock records are correctly configured. Escalate missing or inconsistent equipment records.', '/inventory', 'Review inventory', Fuel],
      ['Prepare the shift', 'Follow attendance and cashier-shift procedures. Make sure each assigned active nozzle has the required opening meter reading and that readings are approved before official sales.', '/attendance', 'Open attendance', ClipboardCheck],
      ['Monitor sales and collections', 'Record cumulative meter readings and actual amounts received using the matching unit. Select the correct approved reading, payment method and reference where applicable.', '/sales', 'Record sales', Receipt],
      ['Complete controls and handovers', 'Record physical tank checks and required cash controls. Count, record and confirm money handovers with the correct parties.', '/controls', 'Open controls', Scale],
      ['Resolve and report exceptions', 'Review alerts, messages, reconciliation, accountability and audit records. Escalate unexplained differences instead of bypassing approval.', '/accountability', 'Review accountability', ArrowLeftRight],
    ],
  },
  attendant: {
    label: 'Station attendant / cashier',
    intro: 'Follow the shift procedure carefully: confirm your assignment, submit accurate readings, record real collections and complete handovers.',
    first: '/attendance', firstLabel: 'Open attendance',
    principles: ['Use only your own assigned open cashier shift and authorised station.', 'Enter the actual cumulative meter total shown on the equipment; do not enter litres in a kilogram field or vice versa.', 'Record only money actually received. Never invent a payment reference or backdate a reading.', 'If a shift, nozzle or approved reading is missing, stop and ask your manager to check the setup.'],
    steps: [
      ['Sign in and check your assignment', 'Confirm you are signed into the correct account and assigned to the correct station. Report missing access to your manager.', '/', 'Open overview', Gauge],
      ['Record attendance and shift', 'Follow your station’s attendance and cashier shift opening procedure. Do not record meter readings until the required shift is open.', '/attendance', 'Attendance and shifts', ClipboardCheck],
      ['Submit opening meter readings', 'Choose your actual open shift and assigned active nozzle. Enter the opening totalizer accurately and submit it for the required review. Wait for approval where required.', '/controls', 'Opening meter controls', Scale],
      ['Record sales readings', 'Choose the correct litre or LPG/kg workflow. Enter the current cumulative totalizer and any required price/date details. Do not estimate or reset a cumulative meter value.', '/sales', 'Record meter reading', Receipt],
      ['Record collections honestly', 'Select the matching approved reading, enter the actual amount collected, select the correct payment method and add a real POS/transfer reference when available.', '/sales', 'Record collection', Receipt],
      ['Complete handover and report issues', 'Count cash carefully, complete the required handover with the receiving person and report shortages, excesses, damaged meters or incorrect records immediately.', '/accountability', 'Money handovers', ArrowLeftRight],
    ],
  },
  general: {
    label: 'Workspace user',
    intro: 'Your available features depend on the company and station roles assigned to your account. Use the guide links below and ask your company administrator if access is missing.',
    first: '/', firstLabel: 'Open overview',
    principles: ['Only access information you are authorised to use.', 'Use real operational records and accurate units.', 'Do not share passwords or verification codes.', 'Report missing options or errors to your manager or support.'],
    steps: [
      ['Start at Overview', 'Review the workspace information available to your role.', '/', 'Open overview', Gauge],
      ['Check your assigned work', 'Use the navigation menu to open the station functions available to you.', '/attendance', 'Attendance', ClipboardCheck],
      ['Ask for missing access', 'If a feature or dropdown is unavailable, report the exact page and message. Do not create duplicate or dummy records to work around it.', '/support', 'Contact support', LifeBuoy],
    ],
  },
};

const quickLinks = [
  ['/stations', 'Stations & branches', 'Company branches and assigned station details', Building2],
  ['/team', 'People & invites', 'Invite staff and manage authorised membership', Users],
  ['/attendance', 'Attendance', 'Attendance and cashier shift workflow', ClipboardCheck],
  ['/inventory', 'Fuel inventory', 'Products and stock information', Fuel],
  ['/advanced-operations', 'POS & integrations', 'Connected systems and operational integrations', Cable],
  ['/sales', 'Sales & reconciliation', 'Meter readings, collections and sales ledger', Receipt],
  ['/controls', 'Tank & cash controls', 'Tank checks, shift controls and meter approvals', Scale],
  ['/governance', 'Audit & disputes', 'Review control records and exceptions', ShieldCheck],
  ['/reports', 'Financial reports', 'Review financial and operational summaries', FileSpreadsheet],
  ['/payroll', 'Payroll & expenses', 'Payroll and branch expense records', Banknote],
  ['/accountability', 'Money handovers', 'Document cash transfers and acknowledgements', ArrowLeftRight],
  ['/alerts', 'Operational alerts', 'Review important notices and required actions', BellRing],
  ['/messages', 'Staff messages', 'Communicate with authorised workspace members', MessageSquare],
  ['/support', 'Support & FAQs', 'Find help or contact the support team', LifeBuoy],
  ['/account-security', 'Account security', 'Protect and maintain your account', KeyRound],
];

export default function UserGuidePage() {
  const { session } = useAuth();
  const location = useLocation();
  const [workspace, setWorkspace] = useState(null);
  const [workspaceError, setWorkspaceError] = useState('');
  const [search, setSearch] = useState('');
  const [showAllLinks, setShowAllLinks] = useState(false);

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    apiRequest('/me', { token: session.access_token })
      .then(data => { if (active) { setWorkspace(data); setWorkspaceError(''); } })
      .catch(error => { if (active) setWorkspaceError(error.message || 'Your role could not be verified. Showing the general guide.'); });
    return () => { active = false; };
  }, [session]);

  const role = useMemo(() => {
    const companyRoles = (workspace?.companies || []).map(item => String(item.role || '').toUpperCase());
    if (companyRoles.some(item => ['COMPANY_OWNER', 'COMPANY_ADMIN', 'COMPANY_DIRECTOR'].includes(item))) return 'owner';
    const stationRoles = (workspace?.stationMemberships || []).filter(item => item.status === 'active').map(item => String(item.role || '').toUpperCase());
    if (stationRoles.includes('STATION_MANAGER')) return 'manager';
    if (stationRoles.includes('ATTENDANT')) return 'attendant';
    return 'general';
  }, [workspace]);
  const requestedGuide = location.pathname.split('/').filter(Boolean)[1] || ''; 
  const requestedRole = ['owner', 'manager', 'attendant'].includes(requestedGuide) ? requestedGuide : null;
  // Never disclose a higher-privilege manual based solely on a manually typed URL.
  const roleRank = { general: 0, attendant: 1, manager: 2, owner: 3 };
  const guideRole = requestedRole && roleRank[role] >= roleRank[requestedRole] ? requestedRole : role;
  const guide = roleContent[guideRole];
  const permittedRoutes = guideRole === 'owner' ? null : guideRole === 'manager' ? new Set(['/', '/stations', '/team', '/attendance', '/inventory', '/advanced-operations', '/sales', '/controls', '/governance', '/payroll', '/accountability', '/alerts', '/messages', '/support', '/account-security', '/user-guide']) : guideRole === 'attendant' ? new Set(['/', '/attendance', '/sales', '/controls', '/advanced-operations', '/accountability', '/support', '/account-security', '/user-guide']) : new Set(['/', '/stations', '/support', '/account-security', '/user-guide']);
  const filteredLinks = quickLinks.filter(([to, title, detail]) => (!permittedRoutes || permittedRoutes.has(to)) && `${title} ${detail}`.toLowerCase().includes(search.trim().toLowerCase()));

  return <div className="user-guide-page">
    <header className="section-header user-guide-header">
      <div><span className="eyebrow">HYSMART LEARNING CENTRE</span><h1>User guide</h1><p>Practical instructions for company owners, directors, station managers and attendants.</p></div>
      <span className="user-guide-role"><BookOpen size={17}/>{guide.label}</span>
    </header>
    {workspaceError && <Notice type="error">{workspaceError}</Notice>}
    <section className="user-guide-welcome">
      <div className="user-guide-welcome-icon"><BookOpen size={27}/></div>
      <div><span className="eyebrow">YOUR ROLE-BASED GUIDE</span><h2>Know what to do, and when</h2><p>{guide.intro}</p><Link className="btn btn-guide-primary" to={guide.first}>{guide.firstLabel}<ChevronRight size={16}/></Link></div>
    </section>

    <section className="content-card user-guide-card">
      <div className="card-heading"><ShieldCheck size={19}/><div><h2>Operating principles</h2><p>These rules protect the accuracy and accountability of station records.</p></div></div>
      <div className="user-guide-principles">{guide.principles.map(item => <div key={item}><CheckCircle2 size={18}/><span>{item}</span></div>)}</div>
    </section>

    <section className="user-guide-section">
      <div className="section-title-row"><div><h2>Step-by-step workflow</h2><p>Follow the sequence that matches your role. Use each link to open the relevant feature.</p></div><span className="setup-count">{guide.steps.length} steps</span></div>
      <div className="user-guide-steps">{guide.steps.map(([title, detail, to, action, Icon], index) => <article className="user-guide-step" key={title}>
        <div className="user-guide-step-number">{String(index + 1).padStart(2, '0')}</div><div className="user-guide-step-icon"><Icon size={20}/></div>
        <div className="user-guide-step-copy"><h3>{title}</h3><p>{detail}</p><Link to={to}>{action}<ChevronRight size={15}/></Link></div>
      </article>)}</div>
    </section>

    <section className="content-card user-guide-card user-guide-detailed-workflow">
      <div className="card-heading"><ClipboardCheck size={19}/><div><h2>Detailed setup and daily recording instructions</h2><p>Use this sequence with real station records. The exact controls shown still depend on your role and permissions.</p></div></div>
      <div className="user-guide-troubleshooting">
        <div><Building2 size={18}/><div><b>Company owner / director — initial setup</b><p>Start at Getting Started. Create each real branch in Stations &amp; branches, then open Fuel inventory for that branch. Create fuel products first and choose the correct unit: litre for litre-based products or kilogram for LPG. Create each tank against the matching product and unit; create pumps; then create each nozzle and link it to the correct pump, tank and product. Check the active status and opening stock/cost details before staff use it. Next use People &amp; invites to invite each real manager or attendant and assign the correct company/station role. Sign in with a test account for each role and verify that it can see only its permitted branches and pages.</p></div></div>
        <div><Users size={18}/><div><b>Station manager — before operations</b><p>Select the correct branch and confirm products, tanks, pumps, nozzles, assigned staff and attendance. Resolve missing or inactive equipment before opening shifts. Confirm the opening meter process and approval responsibilities. During the day review meter approvals, tank checks, cash controls, sales collections, handovers and alerts. At closing, compare expected sales with actual collections and documented handovers; investigate and document differences instead of changing source records to force a match.</p></div></div>
        <div><ClipboardCheck size={18}/><div><b>Attendant / cashier — open and record a shift</b><p>Open Attendance and select the assigned station if the page offers a station selector. Follow the attendance action available to your account, then open your cashier shift using the assigned cashier user and the actual opening float if requested. Do not record readings until the shift is open. In Tank &amp; cash controls, select your open cashier shift, select the assigned active nozzle and enter the actual opening meter totalizer in the matching unit; submit it for review. If the shift or nozzle list is empty, stop and ask a manager to verify real shift status, station membership and equipment configuration.</p></div></div>
        <div><Gauge size={18}/><div><b>Record a litre meter reading</b><p>Open Sales &amp; reconciliation and select the correct station / branch and shift business date. Choose “Litre reading”. Select the active litre nozzle, read its current cumulative totalizer from the physical meter, enter that total (not the litres sold), enter the applicable selling price per litre, confirm the shift date and add a note only when useful. Submit once. The app calculates the difference from the previous totalizer; never estimate a totalizer or reset it to make the numbers fit.</p></div></div>
        <div><Fuel size={18}/><div><b>Record an LPG / kilogram meter reading</b><p>In Sales &amp; reconciliation choose “LPG / kg reading”. Select the active kilogram nozzle, enter the physical meter’s current cumulative kilogram totalizer, enter the correct price per kilogram, confirm the shift date and optionally add a note. Save once. Do not enter litres in a kilogram field or combine kilogram and litre figures.</p></div></div>
        <div><Receipt size={18}/><div><b>Record a collection against a reading</b><p>Choose “Litre collection” or “LPG / kg collection” to match the reading. Select an eligible approved reading for your open shift. Enter the amount actually received, select Cash, POS, Bank transfer or Other as appropriate, and enter a genuine POS / transfer reference when one exists. Add an explanatory note if needed and submit once. The expected amount may be prefilled from the reading; verify it against the real payment. Do not claim that money was received if it was not.</p></div></div>
        <div><Scale size={18}/><div><b>Tank checks, stock adjustments and handovers</b><p>In Tank &amp; cash controls, choose the correct tank and unit, enter the physical measured quantity and select the actual measurement method (for example dip stick, weigh scale or electronic gauge where offered). A physical observation is not automatically a stock adjustment. Adjustments must have a real reason and follow the required approval. For a cash shift close or money handover, count the actual cash, enter the counted amount, record relevant notes and complete the acknowledgement / approval steps shown. Never acknowledge money you did not receive.</p></div></div>
        <div><AlertTriangle size={18}/><div><b>When a selector is empty</b><p>Do not create dummy records. First verify the selected branch, active status, correct unit, real equipment links, current open cashier shift, and approval status. Collections only show eligible approved readings for the open shift. Refresh the page once after correcting setup. If still empty, capture the page, exact error and selected station, then ask an authorised manager or support to inspect the API response and database records.</p></div></div>
      </div>
    </section>

    <section className="content-card user-guide-card">
      <div className="card-heading"><CircleHelp size={19}/><div><h2>When something is missing or goes wrong</h2><p>Do not bypass a required control or make up a record to continue.</p></div></div>
      <div className="user-guide-troubleshooting"><div><AlertTriangle size={18}/><div><b>A dropdown has no options</b><p>Check that the real record exists, is active, belongs to the correct branch and is eligible for the current workflow. For example, collections require an eligible approved meter reading. Ask your manager to verify setup and permissions.</p></div></div><div><AlertTriangle size={18}/><div><b>A submission is rejected</b><p>Read the full error, confirm the selected station, shift, unit and entered values, then correct the source data. Do not repeatedly resubmit financial records if the result is unclear; check the ledger first.</p></div></div><div><AlertTriangle size={18}/><div><b>You cannot access a page</b><p>Your role may not permit it. Ask the company owner or authorised manager to review your assigned role and station membership.</p></div></div></div>
      <Link className="user-guide-support-link" to="/support"><LifeBuoy size={17}/> Open Support & FAQs <ChevronRight size={15}/></Link>
    </section>

    <section className="user-guide-section">
      <div className="section-title-row"><div><h2>Feature directory</h2><p>Search the app guide to find the page you need.</p></div></div>
      <label className="user-guide-search"><Search size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search pages, sales, inventory, handovers…" aria-label="Search feature directory"/><span>{filteredLinks.length}</span></label>
      <div className="user-guide-link-grid">{filteredLinks.slice(0, showAllLinks ? filteredLinks.length : 6).map(([to, title, detail, Icon]) => <Link className="user-guide-link-card" to={to} key={to}><span><Icon size={19}/></span><div><b>{title}</b><small>{detail}</small></div><ChevronRight size={16}/></Link>)}</div>
      {filteredLinks.length > 6 && <button className="btn btn-outline user-guide-show-more" onClick={() => setShowAllLinks(value => !value)}>{showAllLinks ? 'Show fewer pages' : `Show all ${filteredLinks.length} pages`}</button>}
      {!filteredLinks.length && <div className="empty-state"><Search size={22}/><b>No matching pages</b><p>Try another keyword such as “shift”, “cash” or “team”.</p></div>}
    </section>
    <p className="user-guide-disclaimer">The guide explains the normal workflow; available actions still depend on your role, station configuration, approval status and company policy. A guide step does not itself create records or approve transactions.</p>
  </div>;
}
