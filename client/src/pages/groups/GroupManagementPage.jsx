import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CalendarDays, FileText, Users } from 'lucide-react';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import Button from '../../components/ui/Button.jsx';
import DataState from '../../components/ui/DataState.jsx';
import ProfileAvatar from '../../components/ui/ProfileAvatar.jsx';
import ReliableImage from '../../components/ui/ReliableImage.jsx';

const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function GroupManagementPage({ section = 'overview' }) {
  const { id } = useParams();
  const { pathname } = useLocation();
  const groupType = pathname.includes('/departments/') ? 'department' : 'bible_study_group';
  const { success, error: showError } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrls, setImageUrls] = useState([]);
  const [submissionKey, setSubmissionKey] = useState(newIdempotencyKey);
  const [programDraft, setProgramDraft] = useState({ title: '', description: '', locationText: '', startsAt: '', endsAt: '', capacity: '' });
  const [programImageUrl, setProgramImageUrl] = useState('');
  const [programSubmissionKey, setProgramSubmissionKey] = useState(newIdempotencyKey);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const overview = useAsync(async () => unwrap(await publicService.groupManagementOverview(id, groupType)), [id, groupType]);
  const posts = useAsync(async () => unwrap(await publicService.groupManagementPosts(id, groupType)) ?? [], [id, groupType]);
  const followers = useAsync(async () => unwrap(await publicService.groupFollowers(id, groupType)) ?? [], [id, groupType]);
  const programs = useAsync(async () => unwrap(await publicService.groupPrograms(id, groupType)) ?? [], [id, groupType]);
  const g = overview.data?.group;

  async function retryTelegram(postId) {
    try {
      const response = await publicService.retryGroupPostTelegram(id, groupType, postId);
      const delivery = response.data?.data;
      await posts.reload();
      success(delivery?.alreadyDelivered ? 'Telegram post already delivered' : 'Telegram post delivered');
    } catch (cause) {
      showError('Telegram delivery failed', cause?.response?.data?.error || cause.message);
      await posts.reload();
    }
  }

  async function publish(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await publicService.createGroupPost(id, groupType, { title, body, imageUrls, category: 'UPDATE', status: 'PUBLISHED', idempotencyKey: submissionKey });
      const delivery = response.data?.data?.telegramDelivery;
      if (delivery?.status === 'FAILED') showError('Post published; Telegram delivery failed', delivery.error || 'Retry it from the posts list after checking Telegram settings.');
      else if (delivery?.status === 'SENT') success('Post published', 'The update was also sent to Telegram.');
      else success('Post published', 'Followers have been queued for notification.');
      setTitle(''); setBody(''); setImageUrls([]); setSubmissionKey(newIdempotencyKey()); await Promise.all([posts.reload(), overview.reload()]);
    } catch (cause) { showError('Could not publish post', cause?.response?.data?.error || cause.message); }
    finally { setSaving(false); }
  }
  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imageUrls.length >= 8) { showError('Image limit reached', 'You can add up to eight images to a post.'); event.target.value = ''; return; }
    setUploading(true);
    try { const response = await publicService.uploadGroupPostImage(id, groupType, file); setImageUrls((items) => [...items, response.data?.data?.url].filter(Boolean)); }
    catch (cause) { showError('Image upload failed', cause?.response?.data?.error || cause.message); }
    finally { setUploading(false); event.target.value = ''; }
  }
  async function createProgram(event) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await publicService.createGroupProgram(id, groupType, {
        ...programDraft,
        imageUrl: programImageUrl || undefined,
        idempotencyKey: programSubmissionKey,
      });
      const delivery = response.data?.data?.telegramDelivery;
      if (delivery?.status === 'FAILED') showError('Program published; Telegram delivery failed', delivery.error || 'Retry it from the posts list after checking Telegram settings.');
      else if (delivery?.status === 'SENT') success('Program published', 'The program was also sent to Telegram.');
      else success('Program published', 'Followers have been queued for an update.');
      setProgramDraft({ title: '', description: '', locationText: '', startsAt: '', endsAt: '', capacity: '' });
      setProgramImageUrl('');
      setProgramSubmissionKey(newIdempotencyKey());
      await Promise.all([programs.reload(), overview.reload()]);
    } catch (cause) { showError('Program could not be saved', cause?.response?.data?.error || cause.message); }
    finally { setSaving(false); }
  }

  if (overview.loading) return <div className="group-management-loading" role="status">Loading group workspace…</div>;
  if (overview.error || !overview.data) return <div className="group-management-error"><h1>Workspace unavailable</h1><p>{overview.error?.message || 'You do not have access to this group workspace.'}</p><Button to="/community" variant="secondary">Back to community</Button></div>;

  return <section className="group-management-page">
    <header className="group-management-heading"><div><span className="eyebrow blue">{groupType === 'department' ? 'Department' : 'Bible study group'} workspace</span><h1>{g?.name || 'Group management'}</h1><p>Manage this group’s community and updates.</p></div><Link to={`/community/${groupType === 'department' ? 'departments' : 'bible-study-groups'}/${id}`} className="btn btn-secondary btn-sm">View public page</Link></header>
    {section === 'overview' ? <>
      <div className="group-management-stats"><Stat icon={<Users />} label="Followers" value={overview.data.followers} /><Stat icon={<FileText />} label="Published posts" value={overview.data.posts} /><Stat icon={<CalendarDays />} label="Drafts & scheduled" value={overview.data.drafts} /></div>
      <div className="group-management-grid"><article className="group-management-card"><h2>Recent posts</h2><PostList query={posts} limit={4} onRetryTelegram={retryTelegram} /></article><article className="group-management-card"><h2>Followers</h2><FollowerList query={followers} limit={5} /></article></div>
    </> : null}
    {section === 'members' ? <article className="group-management-card"><h2>Followers</h2><p className="muted">These members chose to follow this group for updates. Following does not create a ministry or Bible study membership.</p><FollowerList query={followers} /></article> : null}
    {section === 'posts' ? <div className="group-management-grid group-management-posts"><article className="group-management-card"><h2>Create a post</h2><form className="group-post-compose" onSubmit={publish}><label>Title<input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></label><label>Message<textarea required maxLength={12000} rows={7} value={body} onChange={(e) => setBody(e.target.value)} /></label><label className="group-image-upload">Add an image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadImage} disabled={uploading || imageUrls.length >= 8} /><small>JPG, PNG, WebP, or GIF · up to 5 MB each</small></label>{imageUrls.length ? <div className="group-upload-previews">{imageUrls.map((url) => <button type="button" key={url} onClick={() => setImageUrls((items) => items.filter((item) => item !== url))} aria-label="Remove uploaded image"><ReliableImage src={url} alt="Uploaded post attachment" fallback={<span className="muted">Preview unavailable</span>} /><span>Remove</span></button>)}</div> : null}<Button type="submit" loading={saving || uploading} disabled={uploading}>Publish update</Button></form></article><article className="group-management-card"><h2>Recent posts</h2><PostList query={posts} onRetryTelegram={retryTelegram} /></article></div> : null}
    {section === 'programs' ? <div className="group-management-grid"><article className="group-management-card"><h2>Create a program</h2><p className="muted">Publish a gathering or event to the group page. Followers will receive an update through their enabled channels.</p><form className="group-post-compose" onSubmit={createProgram}><label>Program title<input required maxLength={200} value={programDraft.title} onChange={(event) => setProgramDraft((current) => ({ ...current, title: event.target.value }))} /></label><label>Description<textarea rows={4} maxLength={12000} value={programDraft.description} onChange={(event) => setProgramDraft((current) => ({ ...current, description: event.target.value }))} /></label><label>Starts at<input type="datetime-local" required value={programDraft.startsAt} onChange={(event) => setProgramDraft((current) => ({ ...current, startsAt: event.target.value }))} /></label><label>Ends at<input type="datetime-local" value={programDraft.endsAt} onChange={(event) => setProgramDraft((current) => ({ ...current, endsAt: event.target.value }))} /></label><label>Location<input maxLength={500} value={programDraft.locationText} onChange={(event) => setProgramDraft((current) => ({ ...current, locationText: event.target.value }))} /></label><label>Capacity (optional)<input type="number" min="1" max="100000" value={programDraft.capacity} onChange={(event) => setProgramDraft((current) => ({ ...current, capacity: event.target.value }))} /></label><label className="group-image-upload">Program image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { const response = await publicService.uploadGroupPostImage(id, groupType, file); setProgramImageUrl(response.data?.data?.url || ''); } catch (cause) { showError('Image upload failed', cause?.response?.data?.error || cause.message); } finally { setUploading(false); event.target.value = ''; } }} /><small>Optional · JPG, PNG, WebP, or GIF · up to 5 MB</small></label>{programImageUrl ? <div className="group-upload-previews"><button type="button" onClick={() => setProgramImageUrl('')} aria-label="Remove program image"><ReliableImage src={programImageUrl} alt="Program attachment" fallback={<span className="muted">Preview unavailable</span>} /><span>Remove</span></button></div> : null}<Button type="submit" loading={saving || uploading} disabled={uploading}>Publish program</Button></form></article><article className="group-management-card"><h2>Upcoming programs</h2><ProgramList query={programs} /></article></div> : null}
    {section === 'settings' ? <GroupSettingsForm key={`${groupType}:${id}`} group={g} groupId={id} groupType={groupType} onSaved={overview.reload} /> : null}
  </section>;
}

function Stat({ icon, label, value }) { return <article className="group-management-stat"><span>{icon}</span><div><strong>{Number(value || 0)}</strong><small>{label}</small></div></article>; }
function PostList({ query, limit, onRetryTelegram }) { return <DataState query={query} feature="Group posts" endpoint="/groups/:id/management/posts" emptyState={<p className="muted">No posts yet.</p>}>{(items) => <div className="group-manager-post-list">{(limit ? items.slice(0, limit) : items).map((post) => <article key={post.id}><div><strong>{post.title}</strong><p>{post.body}</p>{post.telegramDeliveryStatus ? <small className="muted">Telegram: {post.telegramDeliveryStatus.toLowerCase()}{post.telegramDeliveryError ? ` — ${post.telegramDeliveryError}` : ''}</small> : null}</div><span className={`group-post-status status-${post.status?.toLowerCase()}`}>{post.status}</span>{post.telegramDeliveryStatus === 'FAILED' ? <Button type="button" size="sm" variant="secondary" onClick={() => onRetryTelegram?.(post.id)}>Retry Telegram</Button> : null}</article>)}</div>}</DataState>; }
function FollowerList({ query, limit }) { return <DataState query={query} feature="Group followers" endpoint="/groups/:id/followers" emptyState={<p className="muted">No followers yet.</p>}>{(items) => <ul className="group-follower-list">{(limit ? items.slice(0, limit) : items).map((item) => <li key={item.id}><ProfileAvatar src={item.profileImageUrl} name={item.name} alt={`${item.name || 'Member'} profile picture`} imageClassName="group-follower-initial" fallbackClassName="group-follower-initial" /><span><strong>{item.name}</strong><small>Following since {new Date(item.followedAt).toLocaleDateString()}</small></span></li>)}</ul>}</DataState>; }
function ProgramList({ query }) { return <DataState query={query} feature="Group programs" endpoint="/groups/:id/programs" emptyState={<p className="muted">No upcoming programs yet.</p>}>{(items) => <div className="group-manager-post-list">{items.map((item) => <article key={item.id}><div><strong>{item.title}</strong><p>{new Date(item.startsAt).toLocaleString()}{item.locationText ? ` · ${item.locationText}` : ''}</p></div><Link className="btn btn-secondary btn-sm" to={`/events/${item.id}`}>View</Link></article>)}</div>}</DataState>; }

function GroupSettingsForm({ group, groupId, groupType, onSaved }) {
  const { success, error } = useToast();
  const [form, setForm] = useState({
    name: group?.name || '',
    description: group?.description || '',
    locationText: group?.locationText || '',
    meetingSchedule: group?.meetingSchedule || '',
    currentStudy: group?.currentStudy || '',
    telegramType: group?.telegramType || 'none',
    telegramUsername: group?.telegramUsername || '',
    telegramPublicLink: group?.telegramPublicLink || '',
    telegramInviteLink: group?.telegramInviteLink || '',
    telegramConnectionStatus: group?.telegramConnectionStatus || 'UNVERIFIED',
  });
  const [saving, setSaving] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [communicationTest, setCommunicationTest] = useState({ channel: '', result: '', error: '' });
  async function submit(event) {
    event.preventDefault(); setSaving(true);
    try { const response = await publicService.updateGroupSettings(groupId, groupType, form); setForm((current) => ({ ...current, ...unwrap(response) })); await onSaved?.(); success('Group details saved.'); }
    catch (cause) { error('Group details could not be saved', cause?.response?.data?.error || cause.message); }
    finally { setSaving(false); }
  }
  async function testCommunication(channel) {
    const target = channel === 'email' ? 'your account email' : 'this Telegram group or channel';
    if (!window.confirm(`Send a real test message to ${target}?${channel === 'telegram' ? ' Members may see it.' : ''}`)) return;
    setTestingTelegram(true);
    setCommunicationTest({ channel, result: '', error: '' });
    try {
      const response = await publicService.testGroupCommunication(groupId, groupType, channel);
      const message = response.data?.message || `${channel} test delivered.`;
      if (channel === 'telegram') setForm((current) => ({ ...current, telegramConnectionStatus: 'CONNECTED' }));
      setCommunicationTest({ channel, result: message, error: '' });
      success(`${channel === 'email' ? 'Email' : 'Telegram'} test delivered`);
    } catch (cause) {
      if (channel === 'telegram') setForm((current) => ({ ...current, telegramConnectionStatus: 'ERROR' }));
      setCommunicationTest({ channel, result: '', error: cause?.response?.data?.error || cause.message || `${channel} test failed.` });
    } finally {
      setTestingTelegram(false);
    }
  }
  return <article className="group-management-card"><h2>Group settings</h2><p className="muted">Update the details shown on the public group page. Group access and membership permissions remain controlled by church administrators.</p><form className="group-post-compose" onSubmit={submit}>
    <label>Group name<input required maxLength={150} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
    <label>Description<textarea rows={5} maxLength={12000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
    <label>Location<input maxLength={500} value={form.locationText} onChange={(event) => setForm((current) => ({ ...current, locationText: event.target.value }))} /></label>
    <label>Meeting schedule<input maxLength={500} value={form.meetingSchedule} onChange={(event) => setForm((current) => ({ ...current, meetingSchedule: event.target.value }))} /></label>
    {groupType === 'bible_study_group' ? <label>Current study topic<input maxLength={500} value={form.currentStudy} onChange={(event) => setForm((current) => ({ ...current, currentStudy: event.target.value }))} /></label> : null}
    <h3>Telegram destination</h3>
    <p className="muted">The church bot must be an administrator with permission to post. Configure a public username for publishing; invite links only let members join.</p>
    <label>Telegram destination type<select value={form.telegramType} onChange={(event) => setForm((current) => ({ ...current, telegramType: event.target.value }))}><option value="none">Not connected</option><option value="group">Group</option><option value="channel">Channel</option></select></label>
    <label>Public group/channel username<input maxLength={64} placeholder="@church_group" value={form.telegramUsername} onChange={(event) => setForm((current) => ({ ...current, telegramUsername: event.target.value, telegramType: current.telegramType === 'none' && event.target.value ? 'group' : current.telegramType }))} /></label>
    <label>Public Telegram link<input type="url" maxLength={500} placeholder="https://t.me/church_group" value={form.telegramPublicLink} onChange={(event) => setForm((current) => ({ ...current, telegramPublicLink: event.target.value, telegramType: current.telegramType === 'none' && event.target.value ? 'group' : current.telegramType }))} /></label>
    <label>Member invitation link (optional)<input type="url" maxLength={500} placeholder="https://t.me/+…" value={form.telegramInviteLink} onChange={(event) => setForm((current) => ({ ...current, telegramInviteLink: event.target.value, telegramType: current.telegramType === 'none' && event.target.value ? 'group' : current.telegramType }))} /></label>
    <p className="muted" role="status">Telegram connection: {form.telegramConnectionStatus}</p>
    <Button type="submit" loading={saving}>Save group settings</Button>
  </form>
  <hr className="divider" />
  <h3>Communication tests</h3>
  <p className="muted">Email tests go only to your account email. Telegram tests send a visible, clearly labelled message to the configured public group or channel. The church bot must be an administrator; invite-only links cannot be used as message destinations.</p>
  {communicationTest.error ? <p className="field-error" role="alert">{communicationTest.error}</p> : null}
  {communicationTest.result ? <p className="muted" role="status">{communicationTest.result}</p> : null}
  <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
    <Button type="button" variant="secondary" loading={testingTelegram && communicationTest.channel === 'email'} disabled={testingTelegram} onClick={() => testCommunication('email')}>Test email</Button>
    <Button type="button" variant="secondary" loading={testingTelegram && communicationTest.channel === 'telegram'} disabled={testingTelegram} onClick={() => testCommunication('telegram')}>Test Telegram channel</Button>
  </div>
  </article>;
}
