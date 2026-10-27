import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Send, Users, RefreshCw } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import SectionHeader from '../components/SectionHeader';

export default function MessagesPage() {
  const { session } = useAuth();
  const [scope, setScope] = useState({ canSend: false, owner: false, stations: [], recipients: [] });
  const [stationId, setStationId] = useState('');
  const [selected, setSelected] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [sentMessages, setSentMessages] = useState([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  async function loadRecipients(nextStationId = stationId) {
    if (!session) return;
    setLoading(true); setError('');
    try {
      const query = nextStationId ? `?stationId=${encodeURIComponent(nextStationId)}` : '';
      const data = await apiRequest(`/messages/recipients${query}`, { token: session.access_token });
      setScope(data); setSelected([]);
      if (!data.owner && !nextStationId && data.stations?.length) {
        setStationId(data.stations[0].id);
      }
    } catch (e) { setError(e.message || 'Unable to load permitted recipients.'); }
    finally { setLoading(false); }
  }
  async function loadSentMessages() {
    if (!session) return;
    setReceiptsLoading(true);
    try { const data = await apiRequest('/messages/sent', { token: session.access_token }); setSentMessages(data.messages || []); }
    catch (e) { setError(e.message || 'Unable to load read receipts.'); }
    finally { setReceiptsLoading(false); }
  }
  useEffect(() => { loadRecipients(''); loadSentMessages(); }, [session]);
  const allSelected = useMemo(() => scope.recipients.length > 0 && scope.recipients.every(r => selected.includes(r.userId)), [scope.recipients, selected]);

  async function sendMessage(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (!selected.length) { setError('Choose at least one recipient.'); return; }
    setSending(true);
    try {
      const result = await apiRequest('/messages', { token: session.access_token, method: 'POST', body: { stationId: stationId || null, recipientUserIds: selected, title, message, requiresAcknowledgement } });
      setNotice(`${result.sent} recipient${result.sent === 1 ? '' : 's'} received the message in their HySmart notification centre.${result.emailJobsQueued ? ` ${result.emailJobsQueued} opted-in email copy/copies queued.` : ''}`);
      setTitle(''); setMessage(''); setSelected([]); setRequiresAcknowledgement(false);
      await loadSentMessages();
      window.dispatchEvent(new Event('hysmart:notifications-refresh'));
    } catch (e) { setError(e.message || 'Message could not be sent.'); }
    finally { setSending(false); }
  }

  return <div className="page-stack">
    <SectionHeader eyebrow="TEAM COMMUNICATION" title="Staff messages" description="Send an announcement directly to the selected staff members’ HySmart notification centres." />
    <section className="content-card">
      <div className="card-heading"><MessageSquare /><div><h2>Compose a message</h2><p>Recipients see the message under the bell notification icon, including while they are using another page.</p></div></div>
      {loading && <p className="report-footnote">Loading your permitted recipients…</p>}
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {notice && <div className="notice notice-success" role="status">{notice}</div>}
      {!loading && !scope.canSend && !error && <p className="report-footnote">Only the CEO/company owner or an assigned branch manager can send staff messages.</p>}
      {!loading && scope.canSend && <form onSubmit={sendMessage} className="message-compose-form">
        <label>Delivery scope
          <select value={stationId} onChange={e => { const value = e.target.value; setStationId(value); setSelected([]); loadRecipients(value); }}>
            {scope.owner && <option value="">All company branches</option>}
            {scope.stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
          </select>
        </label>
        <div className="message-recipient-heading"><label><Users size={16} /> Recipients</label><button className="text-btn" type="button" onClick={() => setSelected(allSelected ? [] : scope.recipients.map(r => r.userId))}>{allSelected ? 'Clear all' : 'Select all'}</button></div>
        <div className="message-recipient-list">{scope.recipients.length ? scope.recipients.map(recipient => <label className="message-recipient" key={recipient.userId}><input type="checkbox" checked={selected.includes(recipient.userId)} onChange={e => setSelected(current => e.target.checked ? [...current, recipient.userId] : current.filter(id => id !== recipient.userId))}/><span><b>{recipient.role.replaceAll('_', ' ')}</b><small>{recipient.stationName}</small></span></label>) : <p className="report-footnote">No other active recipients are available in this scope.</p>}</div>
        <label>Message title<input value={title} onChange={e => setTitle(e.target.value)} minLength={3} maxLength={120} required placeholder="e.g. End-of-shift reporting reminder" /></label>
        <label>Message<textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={3000} rows={5} required placeholder="Write the announcement or instruction…" /></label>
        <label className="message-ack-option"><input type="checkbox" checked={requiresAcknowledgement} onChange={e => setRequiresAcknowledgement(e.target.checked)} /><span><b>Require staff acknowledgement</b><small>Recipients must confirm they have understood this instruction. They can still read it without acknowledging it.</small></span></label>
        <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={sending || !selected.length || !title.trim() || !message.trim()}><Send size={16}/>{sending ? 'Sending…' : `Send to ${selected.length} recipient${selected.length === 1 ? '' : 's'}`}</button><button className="btn btn-secondary" type="button" onClick={() => loadRecipients(stationId)} disabled={loading || sending}><RefreshCw size={16}/> Refresh recipients</button></div>
      </form>}
    </section>
    <section className="content-card">
      <div className="card-heading"><Users/><div><h2>Message read receipts</h2><p>Track which recipients have opened your direct messages. Receipts are visible only to the original sender and remain scoped to your company or assigned branch.</p></div><button className="btn btn-secondary" type="button" onClick={loadSentMessages} disabled={receiptsLoading}><RefreshCw size={16}/>{receiptsLoading ? 'Refreshing…' : 'Refresh'}</button></div>
      {receiptsLoading && <p className="report-footnote">Loading sent messages…</p>}
      {!receiptsLoading && !sentMessages.length && <p className="report-footnote">No sent-message receipts yet. Receipts will appear after you send a message.</p>}
      {!receiptsLoading && sentMessages.map(item => <article className="message-receipt-card" key={item.id}>
        <div className="message-receipt-heading"><div><h3>{item.title}</h3><p>{item.stationName} · {new Date(item.sentAt).toLocaleString()}</p></div><span className="message-receipt-count">{item.readCount}/{item.recipientCount} read{item.requiresAcknowledgement ? ` · ${item.acknowledgedCount}/${item.recipientCount} acknowledged` : ''}</span></div>
        <div className="message-recipient-list">{item.recipients.map(recipient => <div className="message-recipient" key={recipient.userId}><span><b>Staff member · {recipient.userId.slice(0, 8)}</b><small>{recipient.readAt ? `Read ${new Date(recipient.readAt).toLocaleString()}` : 'Not read yet'}{item.requiresAcknowledgement ? ` · ${recipient.acknowledgedAt ? `Acknowledged ${new Date(recipient.acknowledgedAt).toLocaleString()}` : 'Acknowledgement pending'}` : ''}</small></span><span className={recipient.acknowledgedAt ? 'status-pill status-success' : 'status-pill'}>{item.requiresAcknowledgement ? recipient.acknowledgementStatus : recipient.status}</span></div>)}</div>
      </article>)}
    </section>
    <section className="content-card"><div className="card-heading"><MessageSquare/><div><h2>How delivery works</h2><p>Messages are saved to each recipient’s personal inbox and appear in the notification centre. Unread counts refresh automatically. Branch managers can only select members of their assigned branch; the company owner can send to one branch or all company branches.</p></div></div></section>
  </div>;
}
