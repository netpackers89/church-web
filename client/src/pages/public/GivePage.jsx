import { useEffect, useRef, useState } from 'react';
import { Banknote, Landmark, Copy, Check, ArrowRight, Smartphone, Send } from 'lucide-react';
import PageHero from '../../components/layout/PageHero.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Alert from '../../components/ui/Alert.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import useAsync from '../../hooks/useAsync.js';
import { publicService, unwrap, userService } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function PaymentMethodCard({ method, isSelected, onSubmit }) {
  const { success } = useToast();
  const [copied, setCopied] = useState('');
  const [imageError, setImageError] = useState(false);

  const number = method.phoneNumber || method.accountNumber;
  const numberLabel = method.phoneNumber ? 'Phone Number' : 'Account Number';

  async function copy(value, label) {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const field = document.createElement('textarea');
        field.value = value;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copiedSuccessfully = document.execCommand('copy');
        field.remove();
        if (!copiedSuccessfully) throw new Error('Clipboard permission is unavailable.');
      }
      setCopied(label);
      success(`${label} copied to clipboard!`);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('');
      success('Select account number manually');
    }
  }

  // Format account numbers into clean 4-digit readable groups (e.g., 1000 1234 5678)
  const formattedNumber = number
    ? number.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
    : '•••• •••• ••••';

  return (
    <article
      className={`pm-card ${method.type?.toLowerCase()} ${isSelected ? 'is-selected' : ''}`}
    >
      {/* Subtle Background Glow */}
      <div className="pm-card-ambient" />

      {/* Card Header */}
      <div className="pm-card-header">
        <div className="pm-brand-badge">
          {method.logoUrl && !imageError ? (
            <img
              src={method.logoUrl}
              alt={`${method.name} logo`}
              className="pm-brand-logo"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="pm-logo-fallback">
              {method.type === 'TELEBIRR' ? <Smartphone size={20} /> : <Landmark size={20} />}
            </div>
          )}
          <div className="pm-brand-info">
            <h3 className="pm-brand-name">{method.name}</h3>
            <span className="pm-badge-type">
              {method.type === 'TELEBIRR' ? 'Mobile Wallet' : method.type === 'BANK' ? 'Bank Transfer' : 'Provider'}
            </span>
          </div>
        </div>

        <div className="pm-provider-pill">
          {method.type === 'TELEBIRR' ? 'Mobile wallet' : method.type === 'BANK' ? 'Bank transfer' : 'Payment provider'}
        </div>
      </div>

      {/* Account Number Display (Sleek Digital Styling) */}
      <div className="pm-card-body">
        <span className="pm-label">{numberLabel}</span>
        <div className="pm-number-container">
          <span className="pm-digit-display">{formattedNumber}</span>
          <button
            type="button"
            className={`pm-copy-btn ${copied ? 'copied' : ''}`}
            onClick={() => copy(number, numberLabel)}
            aria-label={`Copy ${numberLabel}`}
            title="Copy Number"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* Card Metadata & Details */}
      <div className="pm-card-footer">
        {method.accountHolder && (
          <div className="pm-meta-item">
            <span className="pm-meta-label">Account Name</span>
            <span className="pm-meta-value">{method.accountHolder}</span>
          </div>
        )}

        {method.branch && (
          <div className="pm-meta-item">
            <span className="pm-meta-label">Branch</span>
            <span className="pm-meta-value">{method.branch}</span>
          </div>
        )}
      </div>

      {/* Instructions Overlay / Expand */}
      {method.instructions && (
        <p className="pm-instructions">{method.instructions}</p>
      )}

      {/* Action Button */}
      <button
        type="button"
        className="pm-action-btn"
        aria-pressed={isSelected}
        onClick={() => onSubmit(method.id)}
      >
        <span>{isSelected ? 'Selected for payment' : 'Select for payment'}</span>
        <ArrowRight size={16} />
      </button>
    </article>
  );
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function GivePage() {
  const { user, loading: authLoading } = useAuth();
  const { success } = useToast();
  const formRef = useRef(null);
  const bank = useAsync(async () => unwrap(await publicService.bankAccount()), []);
  const categories = useAsync(async () => unwrap(await publicService.givingCategories()) ?? [], []);
  const campaigns = useAsync(async () => (unwrap(await publicService.campaigns()) ?? []).filter((campaign) => campaign.status === 'ACTIVE' || campaign.displayStatus === 'ACTIVE'), []);
  const [form, setForm] = useState({ paymentMethodId: '', categoryId: '', campaignId: '', amount: '', paymentReference: '', transferDate: localToday(), contributorName: '', note: '', accuracyConfirmed: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [resubmissionId, setResubmissionId] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [search, setSearch] = useState('');
  const methods = bank.data?.methods ?? (bank.data?.bankName && bank.data?.accountNumber ? [{ id: 'legacy-bank-account', name: bank.data.bankName, type: 'BANK', accountHolder: bank.data.accountHolder, accountNumber: bank.data.accountNumber, branch: bank.data.bankBranch, instructions: bank.data.transferInstructions, currency: bank.data.currency || 'ETB' }] : []);
  const visibleMethods = methods.filter((method) => `${method.name} ${method.type} ${method.accountHolder ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  useEffect(() => {
    const priorId = new URLSearchParams(window.location.search).get('resubmit');
    if (!priorId || !user) return undefined;
    let active = true;
    userService.myGiving().then((response) => {
      if (!active) return;
      const prior = (response.data?.data ?? []).find((record) => String(record.id) === priorId && record.status === 'REJECTED');
      if (!prior) {
        setSubmitError('This rejected contribution could not be found in your account.');
        return;
      }
      setResubmissionId(String(prior.id));
      setCorrectionReason(prior.rejectionReason || '');
      setForm((current) => ({
        ...current,
        paymentMethodId: prior.paymentMethodId || current.paymentMethodId,
        categoryId: prior.categoryId ? String(prior.categoryId) : current.categoryId,
        campaignId: prior.campaignId ? String(prior.campaignId) : '',
        amount: prior.amount ?? '',
        transferDate: prior.receivedAt ? String(prior.receivedAt).slice(0, 10) : current.transferDate,
        contributorName: prior.contributorName || '',
        note: prior.note || '',
      }));
    }).catch((error) => {
      if (active) setSubmitError(error.message || 'Could not load the rejected contribution details.');
    });
    return () => { active = false; };
  }, [user]);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    if (submitError) setSubmitError('');
  }

  function chooseMethod(id) {
    set('paymentMethodId', id);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      await userService.submitGiving({
        ...form,
        paymentMethodId: form.paymentMethodId,
        categoryId: form.categoryId || null,
        campaignId: form.campaignId || null,
        amount: form.amount,
        supersedesDonationId: resubmissionId || undefined,
      });
      setSubmitted(true);
      success('Contribution details submitted');
    } catch (error) {
      setSubmitError(error.message || 'Your contribution details could not be submitted. Please check them and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-main">
      <PageHero eyebrow="Giving" title="Give with purpose" subtitle="Use a configured church payment method, then submit your transaction details for finance-team verification. A submission is not confirmation that funds have been received." imageUrl="https://images.unsplash.com/photo-1593113630400-ea4288922497?auto=format&fit=crop&w=1920&q=85" />
      <section className="section">
        <div className="container">
          <div className="row-between giving-section-heading">
            <div><span className="eyebrow blue"><span className="dot" /> Church payment methods</span><h2 className="serif">Transfer using verified details</h2></div>
            {methods.length > 1 ? <label className="giving-method-search"><span className="sr-only">Search payment methods</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search methods" /></label> : null}
          </div>
          {bank.loading ? <div className="payment-cards-grid">{Array.from({ length: 2 }, (_, index) => <div key={index} className="pm-card skeleton" style={{ height: '17rem' }} />)}</div>
            : bank.error ? <ErrorMessage error={bank.error} onRetry={bank.reload} title="Payment methods could not be loaded" />
              : visibleMethods.length ? <div className="payment-cards-grid">{visibleMethods.map((method) => <PaymentMethodCard key={method.id} method={method} isSelected={String(form.paymentMethodId) === String(method.id)} onSubmit={chooseMethod} />)}</div>
                : methods.length ? <EmptyState icon={Banknote} title="No matching payment methods" description="Try a different search." />
                  : <EmptyState icon={Banknote} title="No payment methods published" description="The finance team has not configured a payment provider yet. Please check back later or contact the church office." />}
          <p className="giving-security-note">Please verify the account holder and account details before making a transfer. This website displays giving information; it does not process bank transfers or mobile-money payments.</p>
        </div>
      </section>
      <section className="section section-paper" ref={formRef}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <div className="row-between giving-section-heading"><div><span className="eyebrow blue"><span className="dot" /> Transaction verification</span><h2 className="serif">Submit payment details</h2><p className="muted">Finance reviews submissions, usually within 24 hours. This is a review target, not an automatic approval.</p></div></div>
          {!user && !authLoading ? <div className="card card-pad-lg"><Alert variant="info">Sign in to submit a contribution. Your giving history is private to your account and authorized finance staff.</Alert><Button to="/login" variant="primary">Sign in to continue</Button></div> : null}
          {user && submitted ? <div className="card card-pad-lg"><Alert variant="success">Your contribution details have been submitted successfully. Our finance team will review your transaction. This does not mean funds have been received or verified.</Alert><Button to="/me/giving" variant="secondary">View my giving status</Button></div> : null}
          {user && !submitted ? (
            <form className="card card-pad-lg giving-submit-form" onSubmit={handleSubmit}>
              {submitError ? <Alert variant="danger">{submitError}</Alert> : null}
              {resubmissionId ? <Alert variant="warning">Correct the rejected contribution and submit a new review record. The previous rejected submission will remain in your history. Finance note: {correctionReason || 'Please review the transaction details.'}</Alert> : null}
              <label className="field"><span>Payment provider</span><select value={form.paymentMethodId} onChange={(event) => set('paymentMethodId', event.target.value)} required><option value="">Select a configured provider</option>{methods.map((method) => <option key={method.id} value={method.id}>{method.name} · {method.type === 'TELEBIRR' ? 'Mobile wallet' : method.type === 'BANK' ? 'Bank' : 'Payment'}</option>)}</select></label>
              <div className="grid-2">
                <label className="field"><span>Giving category</span><select value={form.categoryId} onChange={(event) => set('categoryId', event.target.value)} required={!form.campaignId}><option value="">Select a category</option>{(categories.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className="field"><span>Campaign (optional)</span><select value={form.campaignId} onChange={(event) => set('campaignId', event.target.value)}><option value="">No campaign</option>{(campaigns.data ?? []).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select></label>
              </div>
              {!categories.loading && !categories.error && !categories.data?.length && !campaigns.data?.length ? <Alert variant="warning">The church has not configured giving categories or active campaigns yet. Contact the finance team before submitting.</Alert> : null}
              <div className="grid-2">
                <Input label="Amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => set('amount', event.target.value)} required />
                <Input label="Transaction reference / ID" value={form.paymentReference} onChange={(event) => set('paymentReference', event.target.value)} minLength={3} maxLength={200} required />
                <Input label="Date paid" type="date" value={form.transferDate} onChange={(event) => set('transferDate', event.target.value)} required />
                <Input label="Contributor name (optional)" value={form.contributorName} onChange={(event) => set('contributorName', event.target.value)} maxLength={160} />
              </div>
              <Input label="Note (optional)" type="textarea" rows={3} value={form.note} onChange={(event) => set('note', event.target.value)} maxLength={2000} />
              <p className="muted giving-evidence-note">Receipt or screenshot uploads are not enabled yet. Do not paste private card or banking credentials into the note.</p>
              <label className="check-label"><input type="checkbox" checked={form.accuracyConfirmed} onChange={(event) => set('accuracyConfirmed', event.target.checked)} required /> I confirm the transaction information I submitted is accurate.</label>
              <Button type="submit" loading={submitting} disabled={!methods.length || (!categories.data?.length && !campaigns.data?.length)} iconRight={<Send size={15} />}>Submit for verification</Button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}