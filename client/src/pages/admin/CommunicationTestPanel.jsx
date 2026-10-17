import { useState } from 'react';
import { FlaskConical, Send, Mail, MessageCircle, Globe, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { adminService as registrationService, userService, unwrap } from '../../services/api.js';
import { adminService as messaging } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Input from '../../components/ui/Input.jsx';
import ImageUploadField from '../../components/ui/ImageUploadField.jsx';
import { contentService } from '../../services/index.js';

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail, note: 'Sends a real test email through the configured provider.' },
  { id: 'telegram', label: 'Telegram', icon: MessageCircle, note: 'Sends a real test message to the member\u2019s linked chat.' },
  { id: 'website', label: 'Website Notification', icon: Globe, note: 'Stores a real in-app notification for the member portal.' },
];

export default function CommunicationTestPanel() {
  const [channel, setChannel] = useState('email');
  const [templateId, setTemplateId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [audienceType, setAudienceType] = useState('USER');
  const [audienceRef, setAudienceRef] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [groupConfirmed, setGroupConfirmed] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { channel, recipient, integration }
  const [error, setError] = useState('');
  const [manual, setManual] = useState(null); // { verdict: 'WORKS'|'FAILED', notes: '' }
  const [recorded, setRecorded] = useState([]); // session log of tests

  const templates = useAsync(async () => unwrap(await messaging.emailTemplates()) ?? [], []);
  const directory = useAsync(async () => unwrap(await userService.directory()) ?? [], []);
  const departments = useAsync(async () => unwrap(await registrationService.departments()) ?? [], []);
  const organizations = useAsync(async () => unwrap(await registrationService.organizations()) ?? [], []);
  const groups = useAsync(async () => unwrap(await registrationService.bibleStudyGroups()) ?? [], []);
  const status = useAsync(async () => unwrap(await messaging.notificationStatus()) ?? {}, []);

  const selectedRecipient = (directory.data ?? []).find((u) => String(u.id) === String(audienceType === 'USER' ? recipientId : audienceRef));
  const selectedChannel = CHANNELS.find((c) => c.id === channel);

  function applyTemplate(id) {
    setTemplateId(id);
    const t = (templates.data ?? []).find((item) => String(item.id) === String(id));
    if (t) { setSubject(t.subject || t.title || ''); setBody(t.body || ''); setImageUrl(t.bannerUrl || ''); }
  }

  async function sendTest(e) {
    e.preventDefault();
    setSending(true);
    setError('');
    setResult(null);
    setManual(null);
    try {
      const response = await messaging.testCommunication({
        channel, userId: recipientId, subject, body, imageUrl,
        audience: { type: audienceType, ref: audienceType === 'USER' ? recipientId : audienceRef },
        confirmGroupSend: groupConfirmed,
      });
      const data = unwrap(response);
      setResult(data);
    } catch (reason) {
      setError(reason.message || 'The test could not be sent.');
    } finally {
      setSending(false);
    }
  }

  const groupOptions = audienceType === 'DEPARTMENT'
    ? (departments.data ?? []).map((item) => ({ value: String(item.id), label: item.name }))
    : audienceType === 'ORGANIZATION'
      ? (organizations.data ?? []).map((item) => ({ value: String(item.id), label: item.name }))
      : (groups.data ?? []).map((item) => ({ value: String(item.id), label: item.name }));

  function recordManual(verdict) {
    const entry = { verdict, notes: manual?.notes ?? '', channel: result.channel, recipient: result.recipient?.name || `${result.recipientCount || 0} recipients`, at: new Date().toISOString() };
    setRecorded((current) => [entry, ...current]);
    setManual({ verdict, notes: '' });
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="eyebrow blue"><FlaskConical size={15} /> Communications</span>
          <h1>Communication testing</h1>
          <p>Send a clearly labelled test to one member or an authorized recipient group. The integration response and your manual result are kept separate.</p>
        </div>
      </div>

      <Alert variant="warning">
        <ShieldAlert size={15} /> Messages are prefixed with “[TEST — please ignore]”. Group sends require explicit confirmation and resolve only active members from the selected church group.
      </Alert>

      <div className="grid-2" style={{ alignItems: 'flex-start' }}>
        <form className="card card-pad-lg stack" onSubmit={sendTest}>
          {error ? <Alert variant="danger">{error}</Alert> : null}

          <div className="field">
            <span>Channel</span>
            <div className="chip-row" role="radiogroup" aria-label="Communication channel">
              {CHANNELS.map((c) => {
                const Icon = c.icon;
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={channel === c.id} className={`chip ${channel === c.id ? 'active' : ''}`} onClick={() => setChannel(c.id)}>
                    <Icon size={14} /> {c.label}
                  </button>
                );
              })}
            </div>
            <span className="hint">{selectedChannel?.note}</span>
          </div>

          {channel === 'email' ? (
            <Input label="Message template (optional)" type="select" value={templateId} onChange={(e) => applyTemplate(e.target.value)}
              options={(templates.data ?? []).map((t) => ({ value: String(t.id), label: t.name || t.subject || t.code }))} placeholder="No template" />
          ) : null}

          <Input label="Send to" type="select" value={audienceType} onChange={(e) => { setAudienceType(e.target.value); setAudienceRef(''); setRecipientId(''); setGroupConfirmed(false); }}
            options={[{ value: 'USER', label: 'One member' }, { value: 'DEPARTMENT', label: 'A department' }, { value: 'ORGANIZATION', label: 'An organization' }, { value: 'BIBLE_STUDY_GROUP', label: 'A Bible study group' }]} />
          {audienceType === 'USER' ? <Input label="Recipient (from Members & Staff)" type="select" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}
            options={(directory.data ?? []).map((u) => ({ value: String(u.id), label: `${u.name} — ${u.email || u.phone || ''}` }))} placeholder="Select a member" required /> : <>
            <Input label="Recipient group" type="select" value={audienceRef} onChange={(e) => setAudienceRef(e.target.value)} options={groupOptions} placeholder="Select a group" required />
            <label className="check-label"><input type="checkbox" checked={groupConfirmed} onChange={(e) => setGroupConfirmed(e.target.checked)} /> I understand this sends a real test message to every eligible member of this group.</label>
          </>}

          <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} />
          <Input label="Message body" type="textarea" rows={5} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={4000} />
          <ImageUploadField label="Message image" value={imageUrl} onChange={setImageUrl}
            onUpload={(file) => contentService.uploadImage(file, { mediaType: 'BANNER', title: subject || 'Communication test image' })}
            hint="Optional. Email and website show this image; Telegram sends it as a photo." />

          <div>
            <Button type="submit" loading={sending} disabled={audienceType === 'USER' ? !recipientId : !audienceRef || !groupConfirmed} iconRight={<Send size={15} />}>Send test</Button>
          </div>
        </form>

        <div className="stack">
          <section className="card card-body">
            <h2 className="serif" style={{ fontSize: '1.1rem' }}>Preview</h2>
            {audienceType === 'USER' && selectedRecipient ? (
              <div className="stack" style={{ gap: '0.3rem', marginTop: '0.6rem' }}>
                <div><strong>Recipient:</strong> {selectedRecipient.name}</div>
                <div className="muted"><strong>Email:</strong> {selectedRecipient.email || '—'}</div>
                <div className="muted"><strong>Role:</strong> {selectedRecipient.role || 'MEMBER'}</div>
                <div className="muted" style={{ marginTop: '0.6rem' }}><strong>Subject:</strong> [TEST] {subject}</div>
                <p style={{ marginTop: '0.3rem' }}>[TEST — please ignore] {body}</p>
              </div>
            ) : audienceType !== 'USER' && audienceRef ? <div className="stack" style={{ gap: '0.3rem', marginTop: '0.6rem' }}><div><strong>Recipient group selected</strong></div><p className="muted">Every eligible active member in this group will receive a clearly labelled test. The final recipient count is resolved safely by the server.</p><div className="muted"><strong>Subject:</strong> [TEST] {subject}</div><p>[TEST — please ignore] {body}</p></div> : <p className="muted" style={{ marginTop: '0.6rem' }}>Select a recipient or recipient group to preview the test message.</p>}
          </section>

          <section className="card card-body">
            <h2 className="serif" style={{ fontSize: '1.1rem' }}>Integration status</h2>
            {status.loading ? <p className="muted">Loading provider status…</p> : status.error ? <Alert variant="warning">Provider status unavailable.</Alert> : (
              <div className="stack" style={{ gap: '0.3rem', marginTop: '0.6rem' }}>
                {Object.entries(status.data?.providers ?? {}).map(([name, info]) => (
                  <div key={name} className="row-between"><span>{name}</span><span className={`badge ${info?.configured || info?.ready ? 'badge-success' : 'badge-neutral'}`}>{info?.configured || info?.ready ? 'Configured' : 'Not configured'}</span></div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {result ? (
        <section className="card card-pad-lg stack">
          <h2 className="serif" style={{ fontSize: '1.15rem' }}>Integration response</h2>
          <div className="row" style={{ gap: '0.6rem' }}>
            {result.integration?.status === 'DELIVERED' ? <CheckCircle2 size={18} style={{ color: 'var(--success)' }} /> : <XCircle size={18} style={{ color: 'var(--danger)' }} />}
            <div>
              <strong>{result.integration?.status === 'DELIVERED' ? 'Integration confirmed' : result.integration?.status === 'PARTIAL' ? 'Integration partially delivered' : 'Integration did not confirm delivery'}</strong>
              <p className="muted">{result.integration?.detail}</p>
              {result.integration?.messageId ? <p className="muted"><small>Message id: {result.integration.messageId}</small></p> : null}
            </div>
          </div>

          <div className="row" style={{ gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <strong style={{ alignSelf: 'center' }}>Your verification:</strong>
            <Button size="sm" variant={manual?.verdict === 'WORKS' ? 'primary' : 'secondary'} iconLeft={<CheckCircle2 size={14} />} onClick={() => recordManual('WORKS')}>Works</Button>
            <Button size="sm" variant={manual?.verdict === 'FAILED' ? 'danger' : 'secondary'} iconLeft={<XCircle size={14} />} onClick={() => recordManual('FAILED')}>Failed</Button>
            <Input label="Notes (optional)" value={manual?.notes ?? ''} onChange={(e) => setManual((current) => ({ ...(current ?? {}), notes: e.target.value }))} style={{ flex: 1, minWidth: '16rem' }} />
          </div>
          {manual?.verdict ? <Alert variant="info">Recorded manually as {manual.verdict} for this session. This is your own verification, separate from the integration response.</Alert> : null}
        </section>
      ) : null}

      {recorded.length ? (
        <section className="card card-body">
          <h2 className="serif" style={{ fontSize: '1.1rem' }}>This session</h2>
          <div className="table-wrap" style={{ marginTop: '0.6rem' }}>
            <table className="table">
              <thead><tr><th>Channel</th><th>Recipient</th><th>Your result</th><th>Notes</th><th>Time</th></tr></thead>
              <tbody>
                {recorded.map((entry, index) => (
                  <tr key={index}>
                    <td>{entry.channel}</td>
                    <td>{entry.recipient}</td>
                    <td><span className={`badge ${entry.verdict === 'WORKS' ? 'badge-success' : 'badge-danger'}`}>{entry.verdict}</span></td>
                    <td className="muted">{entry.notes || '—'}</td>
                    <td className="muted">{new Date(entry.at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.6rem' }}>Manual verification results are kept for this admin session only. The integration actions are recorded permanently in the audit log.</p>
        </section>
      ) : null}
    </div>
  );
}
