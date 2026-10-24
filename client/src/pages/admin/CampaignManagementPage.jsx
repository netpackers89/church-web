import { useState } from 'react';
import {
  Archive,
  Building2,
  Copy,
  Eye,
  HandHeart,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { contentService, givingService } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import MoreActionsMenu from '../../components/ui/MoreActionsMenu.jsx';
import ImageUploadField from '../../components/ui/ImageUploadField.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import ReliableImage from '../../components/ui/ReliableImage.jsx';
import { formatEventDate } from '../../utils/formatDate.js';

const blank = {
  title: '',
  description: '',
  goalAmount: '',
  currency: 'ETB',
  startsAt: '',
  endsAt: '',
  status: 'DRAFT',
  categoryId: '',
  bannerUrl: '',
  ctaUrl: '',
  paymentAccounts: [],
};

const blankAccount = () => ({
  id: null,
  name: '',
  type: 'BANK',
  accountHolder: '',
  accountNumber: '',
  phoneNumber: '',
  branch: '',
  instructions: '',
  currency: 'ETB',
  isActive: true,
});

const dateValue = (value) => (value ? new Date(value).toISOString().slice(0, 16) : '');
const accountNumber = (account) => account.phoneNumber || account.accountNumber || '';

export default function CampaignManagementPage({ embedded = false }) {
  const campaigns = useAsync(async () => (await givingService.listCampaigns()).data.data ?? [], []);
  const { success, error: notifyError } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [details, setDetails] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  function edit(campaign) {
    setError('');
    setEditingAccount(null);
    setForm({
      ...blank,
      ...campaign,
      paymentAccounts: Array.isArray(campaign.paymentAccounts) ? campaign.paymentAccounts : [],
      startsAt: dateValue(campaign.startsAt),
      endsAt: dateValue(campaign.endsAt),
      categoryId: campaign.categoryId ?? '',
    });
    setOpen(true);
  }

  function updateAccount(index, key, value) {
    setForm((current) => ({
      ...current,
      paymentAccounts: current.paymentAccounts.map((account, accountIndex) =>
        accountIndex === index ? { ...account, [key]: value } : account),
    }));
  }

  async function openDetails(campaign) {
    setDetailError('');
    setDetails({ ...campaign, loading: true });
    try {
      const response = await givingService.adminCampaign(campaign.id);
      setDetails(response.data?.data ?? response.data);
    } catch (reason) {
      setDetailError(reason.message || 'Campaign details could not be loaded.');
      setDetails(campaign);
    }
  }

  async function uploadCampaignImage(file) {
    const response = await contentService.uploadImage(file);
    const nextUrl = response?.data?.data?.url || response?.data?.data?.imageUrl || response?.data?.url || '';
    if (!nextUrl) throw new Error('The upload service did not return a public URL.');
    setForm((current) => ({ ...current, bannerUrl: nextUrl }));
    return response;
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      ...form,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
    try {
      if (form.id) await givingService.updateCampaign(form.id, payload);
      else await givingService.createCampaign(payload);
      setOpen(false);
      setForm(blank);
      setEditingAccount(null);
      await campaigns.reload();
      success(form.id ? 'Campaign updated.' : 'Campaign created.');
    } catch (reason) {
      setError(reason.message || 'Could not save this campaign.');
    } finally {
      setSaving(false);
    }
  }

  async function setCampaignStatus(campaign) {
    const status = campaign.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
    try {
      await givingService.updateCampaign(campaign.id, { status });
      await campaigns.reload();
      success(`Campaign ${status === 'ACTIVE' ? 'activated' : 'closed'}.`);
    } catch (reason) {
      notifyError('Campaign status could not be updated.', reason.message);
    }
  }

  async function archive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await givingService.archiveCampaign(archiveTarget.id);
      await campaigns.reload();
      success(`${archiveTarget.title} was archived.`);
      setArchiveTarget(null);
    } catch (reason) {
      notifyError('Campaign could not be archived.', reason.message);
    } finally {
      setArchiving(false);
    }
  }

  async function copyAccountNumber(account) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.');
      await navigator.clipboard.writeText(accountNumber(account));
      success('Account number copied.');
    } catch (reason) {
      notifyError('Could not copy the account number.', reason.message);
    }
  }

  function addAccount() {
    const index = form.paymentAccounts.length;
    setForm((current) => ({ ...current, paymentAccounts: [...current.paymentAccounts, blankAccount()] }));
    setEditingAccount(index);
  }

  function removeAccount(index) {
    setForm((current) => ({
      ...current,
      paymentAccounts: current.paymentAccounts.filter((_, accountIndex) => accountIndex !== index),
    }));
    setEditingAccount(null);
  }

  return (
    <div className="stack-lg">
      {!embedded ? (
        <div className="page-head">
          <div>
            <h1>Campaigns</h1>
            <p>Create, publish, and track fundraising from verified contribution records.</p>
          </div>
          <Button iconRight={<Plus size={15} />} onClick={() => edit(blank)}>New campaign</Button>
        </div>
      ) : (
        <div className="row-between">
          <div>
            <h2>Fundraising campaigns</h2>
            <p className="muted">Create, publish, and track verified fundraising.</p>
          </div>
          <Button iconRight={<Plus size={15} />} onClick={() => edit(blank)}>New campaign</Button>
        </div>
      )}

      {error && !open ? <Alert variant="danger">{error}</Alert> : null}
      <DataState
        query={campaigns}
        feature="Campaigns"
        endpoint="/campaigns"
        emptyState={(
          <EmptyState
            icon={<HandHeart size={30} />}
            title="No campaigns yet"
            description="Create a campaign to show it on public giving pages."
            action={<Button onClick={() => edit(blank)}>Create campaign</Button>}
          />
        )}
      >
        {(list) => (
          <div className="campaign-card-grid">
            {list.map((campaign) => (
              <article className="campaign-card" key={campaign.id}>
                <button type="button" className="campaign-card-view" onClick={() => openDetails(campaign)} aria-label={`View ${campaign.title} details`}>
                  {campaign.bannerUrl ? (
                    <ReliableImage className="campaign-card-banner" src={campaign.bannerUrl} alt={`${campaign.title} campaign`} />
                  ) : (
                    <div className="campaign-card-banner campaign-card-placeholder"><HandHeart size={28} /></div>
                  )}
                </button>
                <div className="campaign-card-content">
                  <div className="row-between campaign-card-heading">
                    <div>
                      <h2>{campaign.title}</h2>
                      <p className="muted">{campaign.category || 'General fundraising'}</p>
                    </div>
                    <Badge variant={campaign.status === 'ACTIVE' ? 'success' : campaign.status === 'DRAFT' ? 'warning' : 'neutral'}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <p className="campaign-card-description">{campaign.description || 'No campaign description has been added.'}</p>
                  <dl className="campaign-card-facts">
                    <div><dt>Goal</dt><dd>{campaign.goalAmount ?? 'No goal'} {campaign.goalAmount != null ? campaign.currency : ''}</dd></div>
                    <div><dt>Verified total</dt><dd>{campaign.raisedAmount ?? 0} {campaign.currency}</dd></div>
                    <div><dt>Ends</dt><dd>{campaign.endsAt ? formatEventDate(campaign.endsAt, 'gregorian') : 'No end date'}</dd></div>
                    <div><dt>Accounts</dt><dd>{campaign.paymentAccounts?.filter((account) => account.isActive).length ?? 0} active</dd></div>
                  </dl>
                  <div className="campaign-card-actions">
                    <Button size="sm" variant="secondary" iconLeft={<Eye size={14} />} onClick={() => openDetails(campaign)}>View details</Button>
                    <MoreActionsMenu actions={[
                      { label: 'Edit campaign', icon: <Pencil size={15} />, onClick: () => edit(campaign) },
                      { label: campaign.status === 'ACTIVE' ? 'Close campaign' : 'Activate campaign', icon: <HandHeart size={15} />, onClick: () => setCampaignStatus(campaign) },
                      ...(campaign.status !== 'ARCHIVED'
                        ? [{ label: 'Archive campaign', icon: <Archive size={15} />, danger: true, onClick: () => setArchiveTarget(campaign) }]
                        : []),
                    ]} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </DataState>

      <Modal open={details !== null} onClose={() => setDetails(null)} title={details?.title || 'Campaign details'} size="lg">
        {details ? (
          <div className="stack campaign-details">
            {detailError ? <Alert variant="danger">{detailError}</Alert> : null}
            {details.bannerUrl ? <ReliableImage className="campaign-detail-banner" src={details.bannerUrl} alt={`${details.title} campaign`} /> : null}
            {details.loading ? <p role="status">Loading campaign details…</p> : (
              <>
                <p>{details.description || 'No campaign description.'}</p>
                <dl className="campaign-detail-facts">
                  <div><dt>Purpose</dt><dd>{details.category || 'General fundraising'}</dd></div>
                  <div><dt>Status</dt><dd>{details.status}</dd></div>
                  <div><dt>Goal</dt><dd>{details.goalAmount ?? 'No goal'} {details.goalAmount != null ? details.currency : ''}</dd></div>
                  <div><dt>Verified collected</dt><dd>{details.raisedAmount ?? 0} {details.currency}</dd></div>
                  <div><dt>Starts</dt><dd>{details.startsAt ? formatEventDate(details.startsAt, 'gregorian') : 'Not specified'}</dd></div>
                  <div><dt>Ends</dt><dd>{details.endsAt ? formatEventDate(details.endsAt, 'gregorian') : 'Not specified'}</dd></div>
                </dl>
                <section className="stack-sm">
                  <h3>Campaign payment accounts</h3>
                  {details.paymentAccounts?.length ? (
                    <div className="campaign-account-grid">
                      {details.paymentAccounts.map((account) => (
                        <article className="campaign-account-card" key={account.id}>
                          <div className="row-between">
                            <strong>{account.name}</strong>
                            <Badge variant={account.isActive ? 'success' : 'neutral'}>{account.isActive ? 'Active' : 'Inactive'}</Badge>
                          </div>
                          <p><Building2 size={14} /> {account.type} · {account.currency}</p>
                          {account.accountHolder ? <p>Account holder: {account.accountHolder}</p> : null}
                          <div className="campaign-account-number">
                            <span>{account.type === 'TELEBIRR' ? 'Phone' : 'Account number'}: <strong>{accountNumber(account) || 'Not set'}</strong></span>
                            {accountNumber(account) ? <Button size="sm" variant="secondary" iconLeft={<Copy size={14} />} onClick={() => copyAccountNumber(account)}>Copy</Button> : null}
                          </div>
                          {account.branch ? <p>Branch: {account.branch}</p> : null}
                          {account.instructions ? <p>{account.instructions}</p> : null}
                        </article>
                      ))}
                    </div>
                  ) : <p className="muted">No payment accounts have been configured.</p>}
                </section>
                <section className="stack-sm">
                  <h3>Contribution records</h3>
                  {details.contributions?.length ? (
                    <div className="campaign-contributions">
                      {details.contributions.map((item) => (
                        <article className="campaign-contribution" key={item.id}>
                          <div>
                            <strong>{item.contributorName || 'Contributor not specified'}</strong>
                            <p className="muted">{item.receivedAt ? formatEventDate(item.receivedAt, 'gregorian') : 'Date not recorded'}{item.paymentReference ? ` · ${item.paymentReference}` : ''}</p>
                          </div>
                          <div className="campaign-contribution-meta">
                            <strong>{item.amount} {item.currency}</strong>
                            <Badge variant={item.status === 'APPROVED' ? 'success' : item.status === 'PENDING' ? 'warning' : 'neutral'}>{item.status}</Badge>
                          </div>
                        </article>
                      ))}
                      {details.contributions.length === 100 ? <p className="muted">Showing the 100 most recent contribution records.</p> : null}
                    </div>
                  ) : <p className="muted">No contribution records are linked to this campaign.</p>}
                </section>
              </>
            )}
            <div className="modal-foot">
              <Button variant="secondary" onClick={() => setDetails(null)}>Close</Button>
              <Button disabled={details.loading} onClick={() => { edit(details); setDetails(null); }}>Edit campaign</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={open} onClose={() => !saving && setOpen(false)} title={form.id ? 'Edit campaign' : 'New campaign'} size="lg">
        <form className="form-grid" onSubmit={save}>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Input label="Title" value={form.title} onChange={change('title')} required />
          <Input label="Status" type="select" value={form.status} onChange={change('status')} options={['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'].map((value) => ({ value, label: value }))} />
          <Input label="Short and full description" type="textarea" value={form.description} onChange={change('description')} rows={4} maxLength={10000} />
          <Input label="Fundraising goal" type="number" min="0" step="0.01" value={form.goalAmount ?? ''} onChange={change('goalAmount')} />
          <Input label="Currency" maxLength="3" value={form.currency} onChange={change('currency')} required />
          <Input label="Giving category ID (optional)" type="number" min="1" value={form.categoryId} onChange={change('categoryId')} hint="Use the matching approved giving category." />
          <Input label="Start date" type="datetime-local" value={form.startsAt} onChange={change('startsAt')} />
          <Input label="End date" type="datetime-local" value={form.endsAt} onChange={change('endsAt')} />
          <ImageUploadField label="Campaign banner image" value={form.bannerUrl} onChange={(value) => setForm((current) => ({ ...current, bannerUrl: value }))} onUpload={uploadCampaignImage} hint="Upload the campaign cover image or paste a public image URL." />
          <Input label="Call-to-action URL" type="url" value={form.ctaUrl} onChange={change('ctaUrl')} />
          <section className="stack campaign-account-editor">
            <div className="row-between">
              <div><h3>Campaign payment accounts</h3><p className="muted">Only active accounts appear publicly. Removing one deactivates it; historical contribution references are retained.</p></div>
              <Button type="button" variant="secondary" onClick={addAccount}>Add another account</Button>
            </div>
            {form.paymentAccounts.map((account, index) => (
              <article className="campaign-account-editor-card" key={account.id || `new-${index}`}>
                <div className="row-between">
                  <div>
                    <strong>{account.name || `Payment account ${index + 1}`}</strong>
                    <p className="muted">{account.type}{account.accountHolder ? ` · ${account.accountHolder}` : ''} · {accountNumber(account) || 'Account number not entered'}</p>
                  </div>
                  <Badge variant={account.isActive ? 'success' : 'neutral'}>{account.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div className="campaign-card-actions">
                  <Button type="button" size="sm" variant="secondary" iconLeft={<Pencil size={14} />} onClick={() => setEditingAccount(editingAccount === index ? null : index)}>
                    {editingAccount === index ? 'Close editor' : 'Edit account'}
                  </Button>
                  {accountNumber(account) ? <Button type="button" size="sm" variant="secondary" iconLeft={<Copy size={14} />} onClick={() => copyAccountNumber(account)}>Copy number</Button> : null}
                  <Button type="button" size="sm" variant="danger" iconLeft={<Trash2 size={14} />} onClick={() => removeAccount(index)}>Remove from campaign</Button>
                </div>
                {editingAccount === index ? (
                  <div className="campaign-account-fields">
                    <Input label="Display name" value={account.name} onChange={(event) => updateAccount(index, 'name', event.target.value)} required maxLength={120} />
                    <Input label="Account type" type="select" value={account.type} onChange={(event) => updateAccount(index, 'type', event.target.value)} options={['BANK', 'TELEBIRR', 'OTHER'].map((value) => ({ value, label: value }))} />
                    <Input label="Account holder" value={account.accountHolder || ''} onChange={(event) => updateAccount(index, 'accountHolder', event.target.value)} maxLength={160} />
                    {account.type === 'TELEBIRR'
                      ? <Input label="Mobile payment number" type="tel" value={account.phoneNumber || ''} onChange={(event) => updateAccount(index, 'phoneNumber', event.target.value)} required maxLength={40} />
                      : <Input label="Account number" value={account.accountNumber || ''} onChange={(event) => updateAccount(index, 'accountNumber', event.target.value)} required maxLength={80} />}
                    <Input label="Branch (optional)" value={account.branch || ''} onChange={(event) => updateAccount(index, 'branch', event.target.value)} maxLength={200} />
                    <Input label="Currency" value={account.currency || 'ETB'} onChange={(event) => updateAccount(index, 'currency', event.target.value.toUpperCase())} maxLength={3} required />
                    <Input label="Payment instructions (optional)" type="textarea" value={account.instructions || ''} onChange={(event) => updateAccount(index, 'instructions', event.target.value)} maxLength={1000} rows={2} />
                    <label className="check-label"><input type="checkbox" checked={account.isActive} onChange={(event) => updateAccount(index, 'isActive', event.target.checked)} /> Active for new contributions</label>
                  </div>
                ) : null}
              </article>
            ))}
            {!form.paymentAccounts.length ? <p className="muted">No payment accounts. Add at least one account to accept contributions directly for this campaign.</p> : null}
          </section>
          <div className="modal-foot">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{form.id ? 'Save changes' : 'Create campaign'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={archiveTarget !== null}
        onClose={() => !archiving && setArchiveTarget(null)}
        onConfirm={archive}
        title="Archive campaign?"
        message={`“${archiveTarget?.title || ''}” will no longer appear as an active public campaign. Existing contributions and payment-account history will be preserved.`}
        confirmLabel="Archive campaign"
        danger
        loading={archiving}
      />
    </div>
  );
}
