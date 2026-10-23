import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Users, UserPlus, MessageCircle, Copy, ShieldCheck, UserX } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';
import Notice from '../components/Notice';
import { useAuth } from '../features/auth/AuthContext';
import { apiRequest } from '../lib/api';

export default function TeamPage() {
  const { session } = useAuth();
  const location = useLocation();
  const [stations, setStations] = useState([]);
  const [stationId, setStationId] = useState('');
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ATTENDANT');
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!session) return;
    apiRequest('/me', { token: session.access_token })
      .then(data => setIsOwner(!!data.companies?.some(company => ['COMPANY_OWNER', 'COMPANY_ADMIN'].includes(company.role))))
      .catch(() => setIsOwner(false));
    apiRequest('/stations', { token: session.access_token })
      .then(data => { setStations(data); const requested = location.state?.stationId; if (requested && data.some(station => station.id === requested)) setStationId(requested); else if (data[0]) setStationId(current => current || data[0].id); })
      .catch(e => setError(e.message));
  }, [session, location.state]);

  useEffect(() => {
    if (!session || !stationId) { setMembers([]); return; }
    apiRequest(`/stations/${stationId}/members`, { token: session.access_token })
      .then(setMembers).catch(e => setError(e.message));
  }, [session, stationId]);

  async function removeMember(userId, memberRole) {
    if (memberRole === 'STATION_MANAGER') { setError('To change a branch manager, invite and activate the replacement manager first.'); return; }
    if (!window.confirm('Remove this attendant from the selected branch? Historical attendance and sales records will be retained.')) return;
    setError(''); setNotice('');
    try {
      await apiRequest(`/stations/${stationId}/members/${userId}`, { token: session.access_token, method: 'DELETE' });
      setMembers(rows => rows.map(member => member.user_id === userId ? { ...member, status: 'removed' } : member));
      setNotice('Team member removed. Historical operational records have been retained.');
    } catch (e) { setError(e.message); }
  }

  async function invite(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setResult(null);
    try {
      const invitation = await apiRequest('/invitations', { token: session.access_token, method: 'POST', body: { stationId, email: email.trim().toLowerCase(), role } });
      setResult(invitation); setNotice('Invitation created. Send the link using WhatsApp or copy it to share securely.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(result.inviteUrl); setNotice('Invitation link copied to clipboard.'); }
    catch { setError('Clipboard access was unavailable. Please use the WhatsApp button instead.'); }
  }

  return <>
    <SectionHeader eyebrow="TEAM & ACCESS" title="People & invitations" description="Invite the right people to the right branch. Every invitation is email-bound, single-use and time-limited." />
    {error && <Notice type="error">{error}</Notice>}
    {notice && <Notice type="success">{notice}</Notice>}
    <div className="two-col">
      <section className="content-card">
        <div className="card-heading"><UserPlus/><div><h2>Invite a team member</h2><p>{isOwner ? 'Directors can invite branch managers or petrol attendants.' : 'Branch managers can invite petrol attendants only, for their assigned branch.'} Invitations expire after 72 hours.</p></div></div>
        <form className="stack-form" onSubmit={invite}>
          <label htmlFor="team-branch">Branch</label>
          <select id="team-branch" value={stationId} onChange={event => setStationId(event.target.value)} required><option value="">Select a branch</option>{stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}</select>
          <label htmlFor="team-email">Invitee email address</label>
          <input id="team-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} placeholder="manager@company.com" />
          <small className="field-hint">The invitee must register using this email address.</small>
          <label htmlFor="team-role">Invite as</label>
          <select id="team-role" value={role} onChange={event => setRole(event.target.value)}>{isOwner && <option value="STATION_MANAGER">Branch manager</option>}<option value="ATTENDANT">Petrol attendant</option></select>
          <small className="field-hint">{isOwner ? 'Choose the role this person should have at this branch.' : 'Your manager account can only invite attendants. Manager invitations are restricted to the company director.'}</small>
          <button className="btn btn-primary btn-wide" disabled={busy || !stationId}><MessageCircle size={17}/>{busy ? 'Creating secure invitation…' : 'Create invitation'}</button>
        </form>
        {result && <div className="invite-result"><b>Invitation ready</b><p>Send this secure link to {result.email}. The invitee must register with this email address and will be assigned to the selected branch.</p><div className="invite-actions"><a className="btn btn-whatsapp" href={result.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={16}/> Send via WhatsApp</a><button type="button" className="btn btn-outline" onClick={copyLink}><Copy size={15}/> Copy link</button></div></div>}
      </section>
      <section className="content-card">
        <div className="card-heading"><Users/><div><h2>Assigned team</h2><p>Access is scoped to the selected branch. Removed members remain in historical audit records.</p></div></div>
        <label className="field-label" htmlFor="member-branch">Viewing branch</label>
        <select id="member-branch" className="filter-select" value={stationId} onChange={event => setStationId(event.target.value)}><option value="">Select branch</option>{stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}</select>
        {members.length === 0 ? <EmptyState title="Your team will appear here" description="After a team member accepts an invitation, their branch assignment will appear here." /> : <div className="record-list">{members.map((member, index) => <div className="record-row" key={`${member.user_id}-${index}`}><span className="record-icon"><ShieldCheck/></span><div className="record-main"><b>{member.full_name || member.phone || member.user_id}</b><small>{member.role?.replaceAll('_', ' ') || 'Member'}</small></div><span className="status-badge">{member.status}</span>{member.status === 'active' && member.user_id !== session?.user?.id && <button className="icon-action" title="Remove member" aria-label={`Remove ${member.role}`} onClick={() => removeMember(member.user_id, member.role)}><UserX size={15}/></button>}</div>)}</div>}
      </section>
    </div>
  </>;
}
