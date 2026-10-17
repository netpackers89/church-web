import { useState } from 'react';
import { Bell, Send, RefreshCw, Archive, Users } from 'lucide-react';
import { adminService } from '../../services/index.js';
import { unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import Alert from '../../components/ui/Alert.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import ImageUploadField from '../../components/ui/ImageUploadField.jsx';
import { contentService } from '../../services/index.js';
import { adminService as registrationService, userService } from '../../services/api.js';

const AUDIENCE_TYPES = [
  { value: 'ALL', label: 'All active members' },
  { value: 'USER', label: 'A single user' },
  { value: 'ROLE', label: 'Members with a role' },
  { value: 'DEPARTMENT', label: 'A department' },
  { value: 'ORGANIZATION', label: 'An organization' },
  { value: 'BIBLE_STUDY_GROUP', label: 'A Bible study group' },
];

const BLANK = { title: '', body: '', imageUrl: '', linkUrl: '', audienceType: 'ALL', audienceRef: '' };

export default function WebsiteNotificationsPage() {
  const { success } = useToast();
  const notifications = useAsync(async () => unwrap(await adminService.websiteNotifications({ limit: 100 })) ?? [], []);
  const templates = useAsync(async () => unwrap(await adminService.emailTemplates()) ?? [], []);
  const people = useAsync(async () => unwrap(await userService.directory()) ?? [], []);
  const departments = useAsync(async () => unwrap(await registrationService.departments()) ?? [], []);
  const organizations = useAsync(async () => unwrap(await registrationService.organizations()) ?? [], []);
  const groups = useAsync(async () => unwrap(await registrationService.bibleStudyGroups()) ?? [], []);
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const change = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

  function applyTemplate(id) {
    setTemplateId(id);
    const template = (templates.data ?? []).find((item) => String(item.id) === String(id));
    if (!template) return;
    setForm((current) => ({
      ...current,
      title: template.title || template.subject || current.title,
      body: template.body || current.body,
      imageUrl: template.bannerUrl || current.imageUrl,
      linkUrl: template.ctaUrl || current.linkUrl,
    }));
  }

  async function send(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const audience = { type: form.audienceType, ref: form.audienceType === 'ALL' ? null : form.audienceRef };
      const result = unwrap(await adminService.createWebsiteNotification({ title: form.title, body: form.body, imageUrl: form.imageUrl, linkUrl: form.linkUrl, audience }));
      success(`Notification sent to ${result?.recipientCount ?? 'the'} member(s)`);
      setOpen(false);
      setForm(BLANK);
      await notifications.reload();
    } catch (reason) {
      setError(reason.message || 'The notification could not be sent.');
    } finally {
      setSaving(false);
    }
  }

  const audienceOptions = () => {
    if (form.audienceType === 'USER') return (people.data ?? []).map((person) => ({ value: String(person.id), label: `${person.name} — ${person.email || person.phone || ''}` }));
    if (form.audienceType === 'DEPARTMENT') return (departments.data ?? []).map((department) => ({ value: String(department.id), label: department.name }));
    if (form.audienceType === 'ORGANIZATION') return (organizations.data ?? []).map((organization) => ({ value: String(organization.id), label: organization.name }));
    if (form.audienceType === 'BIBLE_STUDY_GROUP') return (groups.data ?? []).map((group) => ({ value: String(group.id), label: group.name }));
    return [];
  };

  async function archive(notification) {
    if (!window.confirm('Archive this notification?')) return;
    setError('');
    try {
      await adminService.archiveWebsiteNotification(notification.id);
      success('Notification archived');
      await notifications.reload();
    } catch (reason) {
      setError(reason.message || 'Could not archive the notification.');
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="eyebrow blue"><Bell size={15} /> Communications</span>
          <h1>Website notifications</h1>
          <p>Publish in-app notifications to members. They appear in the member portal and stay synchronized with member notification history.</p>
        </div>
        <div className="page-actions row" style={{ gap: '0.5rem' }}>
          <Button variant="secondary" iconRight={<RefreshCw size={14} />} onClick={notifications.reload}>Refresh</Button>
          <Button iconRight={<Send size={15} />} onClick={() => { setForm(BLANK); setTemplateId(''); setError(''); setOpen(true); }}>Send notification</Button>
        </div>
      </div>

      {error && !open ? <Alert variant="danger">{error}</Alert> : null}

      <DataState query={notifications} feature="Website notifications" endpoint="/admin/notifications" skeletonCount={1}
        emptyState={<EmptyState icon={<Bell size={30} />} title="No notifications yet" description="Send a notification to reach members in their portal." action={<Button onClick={() => setOpen(true)} iconRight={<Send size={15} />}>Send the first notification</Button>} />}>
        {(list) => (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Recipient</th><th>Title</th><th>Status</th><th>Sent</th><th /></tr></thead>
              <tbody>
                {list.map((n) => (
                  <tr key={n.id}>
                    <td><strong>{n.recipientName ?? 'Member'}</strong><small className="muted" style={{ display: 'block' }}>{n.recipientEmail}</small></td>
                    <td><strong>{n.title}</strong><small className="muted" style={{ display: 'block' }}>{n.body}</small></td>
                    <td><Badge variant={n.status === 'SENT' ? 'success' : n.status === 'SKIPPED' ? 'neutral' : 'warning'}>{n.status}</Badge></td>
                    <td className="muted">{n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}</td>
                    <td><div className="row" style={{ gap: '0.35rem', justifyContent: 'flex-end' }}><Button size="sm" variant="ghost" iconLeft={<Archive size={14} />} onClick={() => archive(n)}>Archive</Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      <Modal open={open} onClose={() => !saving && setOpen(false)} title="Send website notification" size="lg">
        <form className="stack" onSubmit={send}>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Input label="Start from a saved template (optional)" type="select" value={templateId} onChange={(e) => applyTemplate(e.target.value)}
            options={(templates.data ?? []).filter((template) => !template.isArchived).map((template) => ({ value: String(template.id), label: `${template.name} · ${template.category?.replaceAll('_', ' ') || 'General'}` }))}
            placeholder="Write a notification from scratch" />
          <Input label="Title" value={form.title} onChange={change('title')} required maxLength={200} />
          <Input label="Message" type="textarea" rows={5} value={form.body} onChange={change('body')} required maxLength={10000} />
          <ImageUploadField label="Notification image" value={form.imageUrl} onChange={(value) => setForm((current) => ({ ...current, imageUrl: value }))}
            onUpload={(file) => contentService.uploadImage(file, { mediaType: 'BANNER', title: form.title || 'Notification image' })}
            hint="Optional. Upload an image or paste its public HTTPS URL." />
          <Input label="Link (optional)" type="url" value={form.linkUrl} onChange={change('linkUrl')} hint="A member-side URL such as /events/3." />
          <Input label="Audience" type="select" value={form.audienceType} onChange={change('audienceType')} options={AUDIENCE_TYPES} />
          {form.audienceType !== 'ALL' ? (
            <Input
              label={form.audienceType === 'USER' ? 'Recipient' : form.audienceType === 'ROLE' ? 'Role code (e.g. MEMBER)' : 'Recipient group'}
              type={form.audienceType === 'ROLE' ? 'text' : 'select'}
              value={form.audienceRef}
              onChange={change('audienceRef')}
              required
              options={audienceOptions()}
              placeholder={form.audienceType === 'ROLE' ? 'MEMBER' : 'Select a group'}
              hint="Recipients are resolved from current church memberships at send time."
            />
          ) : null}
          <div className="modal-foot" style={{ padding: '1rem 0 0' }}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving} iconRight={<Users size={15} />}>Send notification</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
