import { HandHeart, Plus, Pencil, Archive } from 'lucide-react';
import { useState } from 'react';
import { contentService, givingService } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Alert from '../../components/ui/Alert.jsx';
import ImageUploadField from '../../components/ui/ImageUploadField.jsx';
import { formatEventDate } from '../../utils/formatDate.js';

const blank = { title: '', description: '', goalAmount: '', currency: 'ETB', startsAt: '', endsAt: '', status: 'DRAFT', categoryId: '', bannerUrl: '', ctaUrl: '' };
const dateValue = (value) => value ? new Date(value).toISOString().slice(0, 16) : '';

export default function CampaignManagementPage() {
  const campaigns = useAsync(async () => (await givingService.listCampaigns()).data.data ?? [], []);
  const [open, setOpen] = useState(false); const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const edit = (campaign) => { setError(''); setForm({ ...blank, ...campaign, startsAt: dateValue(campaign.startsAt), endsAt: dateValue(campaign.endsAt), categoryId: campaign.categoryId ?? '' }); setOpen(true); };
  async function uploadCampaignImage(file) {
    const response = await contentService.uploadImage(file);
    const nextUrl = response?.data?.data?.url || response?.data?.data?.imageUrl || response?.data?.url || '';
    if (!nextUrl) throw new Error('The upload service did not return a public URL.');
    setForm((current) => ({ ...current, bannerUrl: nextUrl }));
    return response;
  }
  async function save(event) {
    event.preventDefault(); setError(''); setSaving(true);
    const payload = { ...form, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null };
    try { if (form.id) await givingService.updateCampaign(form.id, payload); else await givingService.createCampaign(payload); setOpen(false); setForm(blank); campaigns.reload(); }
    catch (reason) { setError(reason.message || 'Could not save this campaign.'); } finally { setSaving(false); }
  }
  async function archive(id) { if (!window.confirm('Archive this campaign? It will no longer be public.')) return; try { await givingService.archiveCampaign(id); campaigns.reload(); } catch (reason) { setError(reason.message || 'Could not archive this campaign.'); } }
  return <div className="stack-lg">
    <div className="page-head"><div><h1>Campaigns</h1><p>Create, publish, and track fundraising from verified bank-transfer records.</p></div><Button iconRight={<Plus size={15} />} onClick={() => { setForm(blank); setError(''); setOpen(true); }}>New campaign</Button></div>
    {error && !open ? <Alert variant="danger">{error}</Alert> : null}
    <DataState query={campaigns} feature="Campaigns" endpoint="/campaigns" emptyState={<EmptyState icon={<HandHeart size={30} />} title="No campaigns yet" description="Create a campaign to show it on public giving pages." action={<Button onClick={() => setOpen(true)}>Create campaign</Button>} />}>
      {(list) => <div className="table-wrap"><table className="table"><thead><tr><th>Campaign</th><th>Goal</th><th>Raised</th><th>Ends</th><th>Status</th><th /></tr></thead><tbody>{list.map((c) => <tr key={c.id}><td><strong>{c.title}</strong><small className="muted" style={{ display: 'block' }}>{c.category || 'General giving'}</small></td><td>{c.goalAmount ?? '—'} {c.currency}</td><td>{c.raisedAmount ?? 0} {c.currency}</td><td>{c.endsAt ? formatEventDate(c.endsAt, 'gregorian') : '—'}</td><td><span className="badge">{c.status}</span></td><td className="row"><Button size="sm" variant="secondary" onClick={() => edit(c)} iconLeft={<Pencil size={14} />}>Edit</Button>{c.status !== 'ARCHIVED' ? <Button size="sm" variant="ghost" onClick={() => archive(c.id)} aria-label={`Archive ${c.title}`}><Archive size={15} /></Button> : null}</td></tr>)}</tbody></table></div>}
    </DataState>
    <Modal open={open} onClose={() => !saving && setOpen(false)} title={form.id ? 'Edit campaign' : 'New campaign'} size="lg"><form className="form-grid" onSubmit={save}>{error ? <Alert variant="danger">{error}</Alert> : null}
      <Input label="Title" value={form.title} onChange={change('title')} required /><Input label="Status" type="select" value={form.status} onChange={change('status')} options={['DRAFT','ACTIVE','CLOSED','ARCHIVED'].map((value) => ({ value, label: value }))} />
      <Input label="Description" type="textarea" value={form.description} onChange={change('description')} rows={4} /><Input label="Fundraising goal" type="number" min="0" step="0.01" value={form.goalAmount} onChange={change('goalAmount')} />
      <Input label="Currency" maxLength="3" value={form.currency} onChange={change('currency')} required /><Input label="Giving category ID (optional)" type="number" min="1" value={form.categoryId} onChange={change('categoryId')} hint="Use the matching approved giving category." />
      <Input label="Start date" type="datetime-local" value={form.startsAt} onChange={change('startsAt')} /><Input label="End date" type="datetime-local" value={form.endsAt} onChange={change('endsAt')} />
      <ImageUploadField label="Campaign banner image" value={form.bannerUrl} onChange={(value) => setForm((current) => ({ ...current, bannerUrl: value }))} onUpload={uploadCampaignImage} hint="Upload the campaign cover photo and it will be stored as the public banner URL." />
      <Input label="Call-to-action URL" type="url" value={form.ctaUrl} onChange={change('ctaUrl')} />
      <div><Button type="submit" loading={saving}>{form.id ? 'Save changes' : 'Create campaign'}</Button></div>
    </form></Modal>
  </div>;
}
