import { Landmark, Save, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';
import { adminService } from '../../services/index.js';
import { usePermissions } from '../../hooks/usePermission.js';
import useAsync from '../../hooks/useAsync.js';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Input from '../../components/ui/Input.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import CampaignManagementPage from './CampaignManagementPage.jsx';
import GivingManagementPage from './GivingManagementPage.jsx';
import ReportsPage from './ReportsPage.jsx';

function legacyPaymentMethods(settings) {
  const bank = settings?.bank_account && typeof settings.bank_account === 'object' ? settings.bank_account : {};
  const name = bank.bankName || settings?.bankName || '';
  const accountNumber = bank.accountNumber || settings?.accountNumber || '';
  return name && accountNumber ? [{ id: 'legacy-bank-account', name, type: 'BANK', accountHolder: bank.accountHolder || settings?.accountHolder || '', accountNumber, phoneNumber: '', branch: bank.bankBranch || settings?.bankBranch || '', instructions: bank.transferInstructions || settings?.transferInstructions || '', logoUrl: '', currency: bank.currency || settings?.currency || 'ETB', isPublic: true }] : [];
}

function GivingAccountsPanel() {
  const { success } = useToast();
  const settings = useAsync(async () => {
    const response = await adminService.settings();
    return response?.data?.data ?? response?.data ?? {};
  }, []);
  const [paymentMethods, setPaymentMethods] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const methods = paymentMethods ?? (Array.isArray(settings.data?.paymentMethods) ? settings.data.paymentMethods : legacyPaymentMethods(settings.data));

  function updateMethod(index, key, value) { setPaymentMethods((current) => (current ?? methods).map((method, methodIndex) => methodIndex === index ? { ...method, [key]: value } : method)); }
  function addMethod() { setPaymentMethods((current) => [...(current ?? methods), { id: crypto.randomUUID(), name: '', type: 'BANK', accountHolder: '', accountNumber: '', phoneNumber: '', branch: '', instructions: '', logoUrl: '', currency: 'ETB', isPublic: true }]); }
  async function save() {
    setSaving(true); setError('');
    try { await adminService.updateSettings({ ...(settings.data || {}), paymentMethods: methods }); success('Giving accounts saved.'); }
    catch (reason) { setError(reason.message || 'Could not save giving accounts.'); }
    finally { setSaving(false); }
  }

  return <div className="stack-lg">
    <div><h2>Giving accounts</h2><p className="muted">Publish only verified church bank and Telebirr details. Members see this list on the giving page.</p></div>
    <DataState query={settings} feature="Giving accounts" endpoint="/admin/settings" isEmpty={() => false} skeletonCount={1}>
      {() => <section className="payment-method-settings">
        {error ? <Alert variant="danger">{error}</Alert> : null}
        <div className="row-between"><p className="muted">Add each method once, then update it here whenever church account details change.</p><Button type="button" variant="secondary" onClick={addMethod}>Add account</Button></div>
        {methods.map((method, index) => <div className="payment-method-editor" key={method.id}>
          <div className="row-between"><strong>{method.name || `Payment method ${index + 1}`}</strong><Button type="button" size="sm" variant="ghost" onClick={() => setPaymentMethods((current) => (current ?? methods).filter((_, itemIndex) => itemIndex !== index))}>Remove</Button></div>
          <div className="grid-2">
            <Input label="Provider name" value={method.name ?? ''} onChange={(event) => updateMethod(index, 'name', event.target.value)} required />
            <Input label="Payment type" type="select" value={method.type ?? 'BANK'} onChange={(event) => updateMethod(index, 'type', event.target.value)} options={[{ value: 'BANK', label: 'Bank' }, { value: 'TELEBIRR', label: 'Telebirr' }, { value: 'OTHER', label: 'Other configured provider' }]} />
            <Input label="Account holder" value={method.accountHolder ?? ''} onChange={(event) => updateMethod(index, 'accountHolder', event.target.value)} />
            {method.type === 'TELEBIRR' ? <Input label="Telebirr phone number" type="tel" value={method.phoneNumber ?? ''} onChange={(event) => updateMethod(index, 'phoneNumber', event.target.value)} required /> : <Input label="Account number" value={method.accountNumber ?? ''} onChange={(event) => updateMethod(index, 'accountNumber', event.target.value)} required />}
            <Input label="Branch" value={method.branch ?? ''} onChange={(event) => updateMethod(index, 'branch', event.target.value)} />
            <Input label="Currency" value={method.currency ?? 'ETB'} onChange={(event) => updateMethod(index, 'currency', event.target.value.toUpperCase())} />
            <Input label="Provider logo URL" type="url" value={method.logoUrl ?? ''} onChange={(event) => updateMethod(index, 'logoUrl', event.target.value)} />
            <Input label="Payment instructions" value={method.instructions ?? ''} onChange={(event) => updateMethod(index, 'instructions', event.target.value)} />
          </div>
          <label className="check-label"><input type="checkbox" checked={method.isPublic !== false} onChange={(event) => updateMethod(index, 'isPublic', event.target.checked)} /> Show this method on the public giving page</label>
        </div>)}
        {!methods.length ? <EmptyState icon={<Landmark size={28} />} title="No giving accounts configured" description="Add a verified church account before accepting manual transfer records." /> : null}
        <Button onClick={save} loading={saving} iconRight={<Save size={15} />}>Save giving accounts</Button>
      </section>}
    </DataState>
  </div>;
}

export default function FinanceWorkspacePage() {
  const permissions = usePermissions();
  const canManageFinance = permissions.has('finance.manage');
  const canReadReports = permissions.has('reports.read');
  const canManageAccounts = permissions.has('settings.manage');
  const tabs = useMemo(() => [
    ...(canManageAccounts ? [{ id: 'accounts', label: 'Giving Accounts' }] : []),
    ...(canManageFinance ? [{ id: 'campaigns', label: 'Fundraising' }, { id: 'payments', label: 'Payments & Receipts' }] : []),
    ...(canReadReports || canManageFinance ? [{ id: 'reports', label: 'Financial Reports' }] : []),
  ], [canManageAccounts, canManageFinance, canReadReports]);
  const [active, setActive] = useState('reports');
  const activeTab = tabs.some((tab) => tab.id === active) ? active : (tabs[0]?.id || 'reports');

  return <div className="stack-lg finance-workspace">
    <div className="page-head"><div><h1>Finance</h1><p>Manage church giving accounts, fundraising, contribution review, receipts, and financial reporting.</p></div><span className="stat-icon"><Settings size={17} /></span></div>
    <div className="chip-row" role="tablist" aria-label="Finance workspace">
      {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={`chip ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActive(tab.id)}>{tab.label}</button>)}
    </div>
    {activeTab === 'accounts' ? <GivingAccountsPanel /> : null}
    {activeTab === 'campaigns' ? <CampaignManagementPage embedded /> : null}
    {activeTab === 'payments' ? <GivingManagementPage embedded /> : null}
    {activeTab === 'reports' ? <ReportsPage embedded initialActive="giving" /> : null}
  </div>;
}
