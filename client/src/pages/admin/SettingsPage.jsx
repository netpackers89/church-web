import { Settings, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminService } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

function legacyPaymentMethod(settings) {
  const bank = settings?.bank_account && typeof settings.bank_account === 'object' ? settings.bank_account : {};
  const name = bank.bankName || settings?.bankName || '';
  const accountNumber = bank.accountNumber || settings?.accountNumber || '';
  if (!name || !accountNumber) return [];
  return [{
    id: 'legacy-bank-account',
    name,
    type: 'BANK',
    accountHolder: bank.accountHolder || settings?.accountHolder || '',
    accountNumber,
    phoneNumber: '',
    branch: bank.bankBranch || settings?.bankBranch || '',
    instructions: bank.transferInstructions || settings?.transferInstructions || '',
    logoUrl: '',
    currency: bank.currency || settings?.currency || 'ETB',
    isPublic: true,
  }];
}

export default function SettingsPage() {
  const { success, error: toastError } = useToast();
  const settings = useAsync(async () => {
    const res = await adminService.settings();
    return res?.data?.data ?? res?.data ?? {};
  }, []);

  const [form, setForm] = useState({});
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (settings.data && typeof settings.data === 'object') {
      setForm(settings.data);
      setPaymentMethods(Array.isArray(settings.data.paymentMethods) ? settings.data.paymentMethods : legacyPaymentMethod(settings.data));
    }
  }, [settings.data]);

  async function handleSave(e) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      await adminService.updateSettings({ ...form, paymentMethods });
      success('Settings saved');
    } catch (err) {
      setSaveError(err?.message || 'Could not save settings.');
      toastError('Settings not saved', err?.message);
    } finally {
      setSaving(false);
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const updatePaymentMethod = (index, key, value) => setPaymentMethods((current) => current.map((method, methodIndex) => methodIndex === index ? { ...method, [key]: value } : method));

  function addPaymentMethod() {
    setPaymentMethods((current) => [...current, {
      id: crypto.randomUUID(), name: '', type: 'BANK', accountHolder: '', accountNumber: '',
      phoneNumber: '', branch: '', instructions: '', logoUrl: '', currency: 'ETB', isPublic: true,
    }]);
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>System settings</h1>
          <p>Church-wide configuration. Administrator only.</p>
        </div>
      </div>

      <div className="card card-pad-lg" style={{ maxWidth: '44rem' }}>
        <div className="row" style={{ marginBottom: '1rem' }}>
          <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.4rem', height: '2.4rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)' }}><Settings size={17} /></span>
          <h2 className="serif" style={{ fontSize: '1.25rem' }}>Configuration</h2>
        </div>

        <DataState
          query={settings}
          feature="System settings"
          endpoint="/admin/settings"
          skeletonCount={1}
          isEmpty={() => false}
        >
          {() => (
            <form className="form-grid" onSubmit={handleSave} noValidate>
              {saveError ? <Alert variant="danger">{saveError}</Alert> : null}
              <Input label="Church name" value={form.churchName ?? ''} onChange={set('churchName')} />
              <Input label="Contact email" type="email" value={form.contactEmail ?? ''} onChange={set('contactEmail')} />
              <Input label="Contact phone" value={form.contactPhone ?? ''} onChange={set('contactPhone')} />
              <Input label="Address" value={form.address ?? ''} onChange={set('address')} />
              <section className="payment-method-settings">
                <div className="row-between">
                  <div><h3 className="serif">Giving payment methods</h3><p className="muted">Only publish verified church bank or Telebirr details. The public giving page reads this list directly.</p></div>
                  <Button type="button" variant="secondary" onClick={addPaymentMethod}>Add method</Button>
                </div>
                {paymentMethods.map((method, index) => (
                  <div className="payment-method-editor" key={method.id}>
                    <div className="row-between"><strong>{method.name || `Payment method ${index + 1}`}</strong><Button type="button" size="sm" variant="ghost" onClick={() => setPaymentMethods((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button></div>
                    <div className="grid-2">
                      <Input label="Provider name" value={method.name ?? ''} onChange={(event) => updatePaymentMethod(index, 'name', event.target.value)} required />
                      <Input label="Payment type" type="select" value={method.type ?? 'BANK'} onChange={(event) => updatePaymentMethod(index, 'type', event.target.value)} options={[{ value: 'BANK', label: 'Bank' }, { value: 'TELEBIRR', label: 'Telebirr' }, { value: 'OTHER', label: 'Other configured provider' }]} />
                      <Input label="Account holder" value={method.accountHolder ?? ''} onChange={(event) => updatePaymentMethod(index, 'accountHolder', event.target.value)} />
                      {method.type === 'TELEBIRR'
                        ? <Input label="Telebirr phone number" type="tel" value={method.phoneNumber ?? ''} onChange={(event) => updatePaymentMethod(index, 'phoneNumber', event.target.value)} required />
                        : <Input label="Account number" value={method.accountNumber ?? ''} onChange={(event) => updatePaymentMethod(index, 'accountNumber', event.target.value)} required />}
                      <Input label="Branch" value={method.branch ?? ''} onChange={(event) => updatePaymentMethod(index, 'branch', event.target.value)} />
                      <Input label="Currency" value={method.currency ?? 'ETB'} onChange={(event) => updatePaymentMethod(index, 'currency', event.target.value.toUpperCase())} />
                      <Input label="Provider logo URL (official logo)" type="url" value={method.logoUrl ?? ''} onChange={(event) => updatePaymentMethod(index, 'logoUrl', event.target.value)} />
                      <Input label="Payment instructions" value={method.instructions ?? ''} onChange={(event) => updatePaymentMethod(index, 'instructions', event.target.value)} />
                    </div>
                    <label className="check-label"><input type="checkbox" checked={method.isPublic !== false} onChange={(event) => updatePaymentMethod(index, 'isPublic', event.target.checked)} /> Show this method on the public giving page</label>
                  </div>
                ))}
                {!paymentMethods.length ? <p className="muted">No payment methods configured. The public page will not display invented account details.</p> : null}
              </section>
              <div>
                <Button type="submit" loading={saving} iconRight={<Save size={15} />}>Save settings</Button>
              </div>
            </form>
          )}
        </DataState>
      </div>
    </div>
  );
}
