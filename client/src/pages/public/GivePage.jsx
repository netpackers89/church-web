import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  Clock3,
  Coins,
  Copy,
  History,
  Landmark,
  Printer,
  Receipt,
  Send,
  Smartphone,
  UserRound,
  UserRoundPlus,
  XCircle,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Alert from "../../components/ui/Alert.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorMessage from "../../components/feedback/ErrorMessage.jsx";
import Modal from "../../components/ui/Modal.jsx";
import useAsync from "../../hooks/useAsync.js";
import { publicService, unwrap, userService } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/feedback/ToastProvider.jsx";
import ReliableImage from "../../components/ui/ReliableImage.jsx";
import "./GivePage.css";

const GIVING_CATEGORIES = [
  { code: "ASRATE", label: "Asrate / Tithe (አሥራት)" },
  { code: "MEBA", label: "Meba / General Offering (መባ)" },
  { code: "BEKURAT_KEDAMYAT", label: "Bekurat & Kedamyat / First Fruits" },
  { code: "MESWAET_KURBAN", label: "Meswa'et / Kurban" },
  { code: "MISGANA", label: "Misgana / Thanksgiving Offering" },
  { code: "METASABIYA", label: "Metasabiya / Memorial Offering" },
  { code: "BUILDING_FUND", label: "Ye'Hinzat Setota / Building Fund" },
  { code: "CHARITY_ALMS", label: "Ye'Bego Adiragot / Charity & Alms Fund" },
  { code: "FIKER_SETOTA", label: "Fiker Setota / Love Offering" },
  { code: "OTHER", label: "Other / Specify Purpose" },
];
function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMoney(value, currency = "ETB") {
  const amount = Number(value ?? 0);
  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleDateString();
}

function statusDetails(status) {
  if (status === "APPROVED" || status === "VERIFIED") {
    return { label: "Verified", Icon: CheckCircle2, className: "is-approved" };
  }
  if (status === "REJECTED") {
    return { label: "Rejected", Icon: XCircle, className: "is-rejected" };
  }
  return { label: "Pending review", Icon: Clock3, className: "is-pending" };
}

export function PaymentMethodCard({ method, isSelected, onSelect, onSignIn }) {
  const { success, error } = useToast();

  async function copy(value, label) {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const field = document.createElement("textarea");
        field.value = value;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) throw new Error("Clipboard permission is unavailable.");
      }
      success(`${label} copied`);
    } catch (failure) {
      error("Could not copy", failure.message || "Please select and copy the details manually.");
    }
  }

  const accountNumber = method.phoneNumber || method.accountNumber || "";
  const numberLabel = method.phoneNumber ? "Phone number" : "Account number";

  return (
    <article className="giving-account-card">
      <div className="giving-account-provider">
        <span className="giving-account-icon">
          {method.type === "TELEBIRR" ? <Smartphone size={20} /> : <Landmark size={20} />}
        </span>
        <div>
          <h3>{method.name}</h3>
          <span>{method.type === "TELEBIRR" ? "Mobile wallet" : method.type === "BANK" ? "Bank transfer" : "Payment provider"}</span>
        </div>
      </div>
      {method.accountHolder ? (
        <div className="giving-account-detail">
          <span>Account holder</span>
          <div>
            <strong>{method.accountHolder}</strong>
            <button type="button" className="giving-copy-button" aria-label="Copy account holder name" onClick={() => copy(method.accountHolder, "Account holder name")}>
              <Copy size={15} />
            </button>
          </div>
        </div>
      ) : null}
      <div className="giving-account-detail">
        <span>{numberLabel}</span>
        <div>
          <strong className="giving-account-number">{accountNumber || "Not provided"}</strong>
          {accountNumber ? (
            <button type="button" className="giving-copy-button" aria-label={`Copy ${numberLabel.toLowerCase()}`} onClick={() => copy(accountNumber, numberLabel)}>
              <Copy size={15} />
            </button>
          ) : null}
        </div>
      </div>
      {method.branch ? <p className="giving-account-branch">Branch: {method.branch}</p> : null}
      {method.instructions ? <p className="giving-account-instructions">{method.instructions}</p> : null}
      {onSelect || onSignIn ? (
        <button
          type="button"
          className={`giving-account-select${isSelected ? " is-selected" : ""}`}
          aria-pressed={isSelected}
          onClick={() => (onSelect ? onSelect(method.id) : onSignIn())}
        >
          {isSelected ? "Selected for contribution" : "Use this account"}
          <ArrowRight size={16} />
        </button>
      ) : null}
    </article>
  );
}

function SignInDialog({ open, onClose }) {
  const { login } = useAuth();
  const { error: toastError } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      setPassword("");
      onClose();
    } catch (failure) {
      const message = failure.message || "Sign in failed. Please check your details and try again.";
      setFormError(message);
      toastError("Could not sign in", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sign in to continue"
      description="Your giving records and official receipts are private to your account."
    >
      <form className="giving-sign-in-form" onSubmit={submit}>
        {formError ? <Alert variant="danger">{formError}</Alert> : null}
        <Input label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <Button type="submit" loading={submitting} block>Sign in</Button>
        <p className="giving-sign-in-register">
          New to the church website? <Link to="/register" onClick={onClose}>Create an account</Link>
        </p>
      </form>
    </Modal>
  );
}

function GivingRecordCard({ record, onOpenReceipt, onResubmit }) {
  const status = statusDetails(record.status);
  const StatusIcon = status.Icon;
  const isApproved = record.status === "APPROVED" || record.status === "VERIFIED";

  return (
    <article className="giving-record-card">
      <div className="giving-record-topline">
        <div>
          <h3>{record.campaignTitle || record.categoryName || "Contribution"}</h3>
          <p>{record.categoryName || (record.campaignTitle ? "Fundraising campaign" : "Giving")}</p>
        </div>
        <span className={`giving-status ${status.className}`}><StatusIcon size={15} />{status.label}</span>
      </div>
      <div className="giving-record-facts">
        <div><span>Amount</span><strong>{formatMoney(record.amount, record.currency)}</strong></div>
        <div><span>Payment date</span><strong>{formatDate(record.receivedAt)}</strong></div>
        <div><span>Reference</span><strong>{record.paymentReference || "—"}</strong></div>
      </div>
      {record.payerMode === "OTHER" && record.recipientName ? (
        <p className="giving-record-recipient">For {record.recipientName}{record.recipientPhone ? ` · ${record.recipientPhone}` : ""}</p>
      ) : null}
      {record.rejectionReason ? <p className="giving-record-review-note"><strong>Finance note:</strong> {record.rejectionReason}</p> : null}
      <div className="giving-record-actions">
        {isApproved ? (
          <Button type="button" variant="secondary" size="sm" icon={<Receipt size={15} />} onClick={() => onOpenReceipt(record)}>View official receipt</Button>
        ) : null}
        {record.status === "REJECTED" ? (
          <Button type="button" variant="secondary" size="sm" icon={<ArrowRight size={15} />} onClick={() => onResubmit(record)}>Correct and resubmit</Button>
        ) : null}
        {isApproved && record.receiptNumber ? <span className="giving-record-receipt-number">Receipt {record.receiptNumber}</span> : null}
      </div>
    </article>
  );
}

function ReceiptPreview({ receipt, loading, error, onRetry }) {
  if (loading) return <div className="giving-receipt-loading" aria-label="Loading receipt" />;
  if (error) return <ErrorMessage error={error} onRetry={onRetry} title="Receipt could not be loaded" />;
  if (!receipt) return null;

  return (
    <div className="giving-receipt-print">
      <header className="giving-receipt-header">
        <span className="giving-receipt-mark"><Receipt size={22} /></span>
        <div>
          <p>OFFICIAL CONTRIBUTION RECEIPT</p>
          <h2>{receipt.church?.churchName || "Church"}</h2>
          {receipt.church?.address ? <span>{receipt.church.address}</span> : null}
          {receipt.church?.contactEmail ? <span>{receipt.church.contactEmail}</span> : null}
        </div>
      </header>
      <div className="giving-receipt-number-row">
        <span>Receipt number <strong>{receipt.receiptNumber}</strong></span>
        <span>Issued <strong>{formatDate(receipt.confirmedAt)}</strong></span>
      </div>
      <dl className="giving-receipt-details">
        <div><dt>Contributor / payer</dt><dd>{receipt.contributor}</dd></div>
        {receipt.recipient ? <div><dt>Contribution for</dt><dd>{receipt.recipient.name}{receipt.recipient.phone ? ` · ${receipt.recipient.phone}` : ""}</dd></div> : null}
        <div><dt>Giving purpose</dt><dd>{receipt.category}{receipt.purpose ? ` — ${receipt.purpose}` : ""}</dd></div>
        <div><dt>Payment account</dt><dd>{receipt.paymentMethod}</dd></div>
        <div><dt>Payment date</dt><dd>{formatDate(receipt.paymentDate)}</dd></div>
        <div><dt>Transaction reference</dt><dd>{receipt.reference}</dd></div>
      </dl>
      <div className="giving-receipt-total">
        <span>Verified contribution</span>
        <strong>{formatMoney(receipt.amount, receipt.currency)}</strong>
      </div>
      <p className="giving-receipt-thanks">Thank you for your generous contribution. This receipt is issued only after an authorized finance review.</p>
    </div>
  );
}

export default function GivePage() {
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { success } = useToast();
  const formRef = useRef(null);
  const [giveType, setGiveType] = useState("regular");
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = searchParams.get("tab");
    return ["submit", "history", "receipts"].includes(requestedTab)
      ? requestedTab
      : "submit";
  });
  const [signInOpen, setSignInOpen] = useState(false);
  const [form, setForm] = useState({
    paymentMethodId: "",
    categoryCode: "",
    campaignId: "",
    otherPurpose: "",
    amount: "",
    paymentReference: "",
    imgbbUrl: "",
    transferDate: localToday(),
    payerMode: "SELF",
    recipientName: "",
    recipientPhone: "",
    recipientMemberId: "",
    note: "",
    accuracyConfirmed: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [resubmissionId, setResubmissionId] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [recordState, setRecordState] = useState(null);
  const [recordsVersion, setRecordsVersion] = useState(0);
  const [selectedReceiptRecord, setSelectedReceiptRecord] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState("");

  const bank = useAsync(async () => unwrap(await publicService.bankAccount()), []);
  const campaigns = useAsync(
    async () => (unwrap(await publicService.campaigns()) ?? []).filter(
      (campaign) => campaign.status === "ACTIVE" || campaign.displayStatus === "ACTIVE",
    ),
    [],
  );
  const methods = useMemo(() => {
    if (bank.data?.methods?.length) return bank.data.methods;
    if (bank.data?.bankName && bank.data?.accountNumber) {
      return [{
        id: "legacy-bank-account",
        name: bank.data.bankName,
        type: "BANK",
        accountHolder: bank.data.accountHolder,
        accountNumber: bank.data.accountNumber,
        branch: bank.data.bankBranch,
        instructions: bank.data.transferInstructions,
        currency: bank.data.currency || "ETB",
      }];
    }
    return [];
  }, [bank.data]);
  const selectedCampaign = (campaigns.data ?? []).find((campaign) => String(campaign.id) === String(form.campaignId));
  const activeMethods = giveType === "fundraising" ? selectedCampaign?.paymentAccounts ?? [] : methods;

  useEffect(() => {
    if (!user?.id) return undefined;
    const ownerId = user.id;
    let active = true;
    userService.myGiving()
      .then((response) => {
        if (!active) return;
        const data = response.data?.data ?? [];
        setRecordState({ ownerId, data, error: "" });

        const params = new URLSearchParams(window.location.search);
        const priorId = params.get("resubmit");
        if (priorId) {
          const prior = data.find(
            (record) => String(record.id) === priorId && record.status === "REJECTED",
          );
          if (!prior) {
            setSubmitError("This rejected contribution could not be found in your account.");
            setActiveTab("submit");
            return;
          }
          setResubmissionId(String(prior.id));
          setCorrectionReason(prior.rejectionReason || "");
          setGiveType(prior.campaignId ? "fundraising" : "regular");
          setForm((current) => ({
            ...current,
            paymentMethodId: prior.paymentMethodId || "",
            categoryCode: prior.categoryCode || "",
            campaignId: prior.campaignId ? String(prior.campaignId) : "",
            amount: prior.amount ?? "",
            paymentReference: prior.paymentReference ?? "",
            transferDate: prior.receivedAt ? String(prior.receivedAt).slice(0, 10) : current.transferDate,
            payerMode: prior.payerMode || "SELF",
            recipientName: prior.recipientName || "",
            recipientPhone: prior.recipientPhone || "",
            recipientMemberId: prior.recipientMemberId ? String(prior.recipientMemberId) : "",
            otherPurpose: prior.otherPurpose || "",
            note: prior.note || "",
          }));
          setActiveTab("submit");
          return;
        }

        const receiptId = params.get("receipt");
        if (!receiptId) return;
        const record = data.find(
          (item) => String(item.id) === receiptId && item.status === "APPROVED",
        );
        setActiveTab("receipts");
        if (record) openReceipt(record);
        else setReceiptError("This approved receipt could not be found in your account.");
      })
      .catch((error) => {
        if (!active) return;
        const message = error.message || "Giving history could not be loaded.";
        setRecordState({ ownerId, data: [], error: message });
        const params = new URLSearchParams(window.location.search);
        if (params.has("resubmit")) setSubmitError(message);
        if (params.has("receipt")) setReceiptError(message);
      });
    return () => { active = false; };
  }, [user?.id, recordsVersion]);

  const hasCurrentRecords = Boolean(user && String(recordState?.ownerId) === String(user.id));
  const records = hasCurrentRecords ? recordState.data : [];
  const recordsLoading = Boolean(user && !hasCurrentRecords);
  const recordsError = hasCurrentRecords ? recordState.error : "";

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    if (submitError) setSubmitError("");
  }

  function chooseMethod(id) {
    setGiveType("regular");
    set("campaignId", "");
    set("paymentMethodId", String(id));
    setActiveTab("submit");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function chooseCampaignAccount(campaignId, accountId) {
    setGiveType("fundraising");
    set("categoryCode", "");
    set("campaignId", String(campaignId));
    set("paymentMethodId", String(accountId));
    setActiveTab("submit");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startResubmission(record) {
    setResubmissionId(String(record.id));
    setCorrectionReason(record.rejectionReason || "");
    setGiveType(record.campaignId ? "fundraising" : "regular");
    setForm((current) => ({
      ...current,
      paymentMethodId: record.campaignPaymentAccountId || record.paymentMethodId || "",
      categoryCode: record.categoryCode || "",
      campaignId: record.campaignId ? String(record.campaignId) : "",
      amount: record.amount ?? "",
      paymentReference: record.paymentReference ?? "",
      transferDate: record.receivedAt ? String(record.receivedAt).slice(0, 10) : current.transferDate,
      payerMode: record.payerMode || "SELF",
      recipientName: record.recipientName || "",
      recipientPhone: record.recipientPhone || "",
      recipientMemberId: record.recipientMemberId ? String(record.recipientMemberId) : "",
      otherPurpose: record.otherPurpose || "",
      note: record.note || "",
    }));
    setSubmitted(false);
    setSubmitError("");
    setActiveTab("submit");
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function openReceipt(record) {
    setSelectedReceiptRecord(record);
    setReceipt(null);
    setReceiptError("");
    setReceiptLoading(true);
    try {
      const response = await userService.myReceipt(record.id);
      setReceipt(response.data?.data ?? null);
    } catch (error) {
      setReceiptError(error.message || "This official receipt could not be loaded.");
    } finally {
      setReceiptLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      const evidenceNote = form.imgbbUrl ? `\n[Payment evidence: ${form.imgbbUrl}]` : "";
      await userService.submitGiving({
        paymentMethodId: form.paymentMethodId,
        campaignPaymentAccountId: giveType === "fundraising" ? form.paymentMethodId : null,
        categoryCode: giveType === "regular" ? form.categoryCode : null,
        categoryId: null,
        campaignId: giveType === "fundraising" ? form.campaignId || null : null,
        otherPurpose: giveType === "regular" && form.categoryCode === "OTHER" ? form.otherPurpose : "",
        payerMode: form.payerMode,
        recipientName: form.payerMode === "OTHER" ? form.recipientName : "",
        recipientPhone: form.payerMode === "OTHER" ? form.recipientPhone : "",
        recipientMemberId: form.payerMode === "OTHER" ? form.recipientMemberId || null : null,
        amount: form.amount,
        paymentReference: form.paymentReference,
        transferDate: form.transferDate,
        note: `${form.note}${evidenceNote}`.trim(),
        accuracyConfirmed: form.accuracyConfirmed,
        supersedesDonationId: resubmissionId || undefined,
      });
      setSubmitted(true);
      setResubmissionId("");
      setCorrectionReason("");
      setRecordsVersion((version) => version + 1);
      success("Contribution submitted for review");
    } catch (error) {
      setSubmitError(error.message || "Your contribution details could not be submitted. Please check them and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const approvedRecords = records.filter((record) => record.status === "APPROVED" || record.status === "VERIFIED");
  const emptyHistory = (
    <EmptyState icon={<History size={30} />} title="No contributions yet" description="Your contribution submissions and their review status will appear here." />
  );

  return (
    <main className="giving-page">
      <section className="giving-page-intro">
        <div className="container">
          <span className="giving-eyebrow"><span /> Giving &amp; fundraising</span>
          <h1>Give with purpose</h1>
          <p>Choose a church account, make your contribution, and submit the transaction details for finance-team verification. Official receipts are available only after approval.</p>
        </div>
      </section>

      <section className="section giving-public-section">
        <div className="container">
          <div className="giving-section-heading">
            <div>
              <span className="giving-section-kicker"><Landmark size={15} /> Church giving accounts</span>
              <h2>Verified payment details</h2>
            </div>
            {methods.length > 1 ? <span className="giving-method-count">{methods.length} available accounts</span> : null}
          </div>
          {bank.loading ? (
            <div className="giving-account-grid">{[1, 2].map((key) => <div className="giving-account-skeleton" key={key} />)}</div>
          ) : bank.error ? (
            <ErrorMessage error={bank.error} onRetry={bank.reload} title="Payment accounts could not be loaded" />
          ) : methods.length ? (
            <div className="giving-account-grid">
              {methods.map((method) => (
                <PaymentMethodCard
                  key={method.id}
                  method={method}
                  isSelected={String(form.paymentMethodId) === String(method.id)}
                  onSelect={user ? (id) => chooseCampaignAccount(campaign.id, id) : undefined}
                  onSignIn={!user && !authLoading ? () => setSignInOpen(true) : undefined}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Banknote size={30} />} title="No payment accounts published" description="The finance team has not published a giving account yet. Please check back later or contact the church office." />
          )}
          <p className="giving-safety-note">Please confirm the account holder and account details before transferring. This site records your payment information but does not process transfers.</p>
        </div>
      </section>

      <section className="section giving-campaign-section">
        <div className="container">
          <div className="giving-section-heading">
            <div>
              <span className="giving-section-kicker"><Building2 size={15} /> Special projects</span>
              <h2>Fundraising campaigns</h2>
            </div>
          </div>
          {campaigns.loading ? (
            <div className="giving-campaign-grid">{[1, 2].map((key) => <div className="giving-campaign-skeleton" key={key} />)}</div>
          ) : campaigns.error ? (
            <ErrorMessage error={campaigns.error} onRetry={campaigns.reload} title="Campaigns could not be loaded" />
          ) : campaigns.data?.length ? (
            <div className="giving-campaign-grid">
              {campaigns.data.map((campaign) => (
                <article className="giving-campaign-card" key={campaign.id}>
                  {campaign.bannerUrl ? <ReliableImage src={campaign.bannerUrl} alt={`${campaign.title || 'Campaign'} banner`} /> : null}
                  <div className="giving-campaign-body">
                    <span>{campaign.category || "Fundraising"}</span>
                    <h3>{campaign.title}</h3>
                    {campaign.description ? <p>{campaign.description}</p> : null}
                    {Number(campaign.goalAmount) > 0 ? (
                      <div className="giving-campaign-progress">
                        <div><span>Verified progress</span><strong>{formatMoney(campaign.raisedAmount || 0, campaign.currency)}</strong></div>
                        <progress value={Math.min(Number(campaign.raisedAmount || 0), Number(campaign.goalAmount))} max={Number(campaign.goalAmount)} />
                        <small>Goal {formatMoney(campaign.goalAmount, campaign.currency)}</small>
                      </div>
                    ) : null}
                    {campaign.paymentAccounts?.length ? (
                      <div className="giving-campaign-accounts">
                        <h4>Campaign payment accounts</h4>
                        {campaign.paymentAccounts.map((method) => (
                          <PaymentMethodCard
                            key={method.id}
                            method={method}
                            isSelected={String(form.paymentMethodId) === String(method.id) && String(form.campaignId) === String(campaign.id)}
                            onSelect={user ? chooseMethod : undefined}
                            onSignIn={!user && !authLoading ? () => setSignInOpen(true) : undefined}
                          />
                        ))}
                      </div>
                    ) : <p className="muted">Campaign payment details are not available yet.</p>}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      iconRight={<ArrowRight size={15} />}
                      onClick={() => {
                        if (!user) {
                          setSignInOpen(true);
                          return;
                        }
                        setGiveType("fundraising");
                        set("categoryCode", "");
                        set("campaignId", String(campaign.id));
                        set("paymentMethodId", "");
                        setActiveTab("submit");
                        window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                      }}
                    >
                      Support this campaign
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Building2 size={30} />} title="No active campaigns" description="When a campaign is available, it will appear here." />
          )}
        </div>
      </section>

      <section className="section giving-category-section">
        <div className="container">
          <div className="giving-section-heading">
            <div>
              <span className="giving-section-kicker"><Coins size={15} /> Regular giving</span>
              <h2>Giving purposes</h2>
            </div>
          </div>
          <div className="giving-category-list">
            {GIVING_CATEGORIES.map((category) => <span key={category.code}>{category.label}</span>)}
          </div>
        </div>
      </section>

      <section className="section giving-member-section" ref={formRef}>
        <div className="container giving-member-container">
          <div className="giving-section-heading">
            <div>
              <span className="giving-section-kicker"><UserRound size={15} /> Your contribution</span>
              <h2>{user ? `Welcome, ${user.name?.split(/\s+/)[0] || "member"}` : "Submit a contribution"}</h2>
            </div>
          </div>

          {authLoading ? <div className="giving-member-skeleton" /> : !user ? (
            <div className="giving-sign-in-prompt">
              <div className="giving-sign-in-icon"><Receipt size={23} /></div>
              <div>
                <h3>Track your giving and request official receipts</h3>
                <p>You can browse and copy account details without signing in. Sign in or register to submit a contribution and view your personal history and receipts.</p>
              </div>
              <Button type="button" onClick={() => setSignInOpen(true)} iconRight={<ArrowRight size={16} />}>Sign in to continue</Button>
            </div>
          ) : (
            <>
              <nav className="giving-tabs" aria-label="Giving account">
                <button type="button" className={activeTab === "submit" ? "is-active" : ""} aria-current={activeTab === "submit" ? "page" : undefined} onClick={() => setActiveTab("submit")}><Send size={16} /> Submit contribution</button>
                <button type="button" className={activeTab === "history" ? "is-active" : ""} aria-current={activeTab === "history" ? "page" : undefined} onClick={() => setActiveTab("history")}><History size={16} /> My giving history</button>
                <button type="button" className={activeTab === "receipts" ? "is-active" : ""} aria-current={activeTab === "receipts" ? "page" : undefined} onClick={() => setActiveTab("receipts")}><Receipt size={16} /> Receipts</button>
              </nav>

              {activeTab === "submit" ? (
                submitted ? (
                  <div className="giving-submitted-card">
                    <CheckCircle2 size={27} />
                    <div>
                      <h3>Submitted for review</h3>
                      <p>Your contribution is pending finance-team verification. Submitting payment details does not mean the payment has been verified or approved.</p>
                    </div>
                    <div className="giving-submitted-actions">
                      <Button type="button" variant="secondary" onClick={() => { setSubmitted(false); setForm((current) => ({ ...current, amount: "", paymentReference: "", imgbbUrl: "", note: "", accuracyConfirmed: false })); }}>Submit another</Button>
                      <Button type="button" onClick={() => { setActiveTab("history"); setRecordsVersion((version) => version + 1); }}>View status</Button>
                    </div>
                  </div>
                ) : (
                  <form className="giving-contribution-form" onSubmit={handleSubmit}>
                    {submitError ? <Alert variant="danger">{submitError}</Alert> : null}
                    {resubmissionId ? (
                      <Alert variant="warning">
                        This is a correction to a rejected submission. A new review record will be created and the earlier record remains in your history.
                        {correctionReason ? <span> Finance note: {correctionReason}</span> : null}
                      </Alert>
                    ) : null}

                    <div className="giving-form-purpose-toggle" role="group" aria-label="Contribution type">
                      <button type="button" className={giveType === "regular" ? "is-active" : ""} onClick={() => { setGiveType("regular"); set("campaignId", ""); set("paymentMethodId", ""); }}>
                        <Coins size={17} /> Regular giving
                      </button>
                      <button type="button" className={giveType === "fundraising" ? "is-active" : ""} onClick={() => { setGiveType("fundraising"); set("categoryCode", ""); set("otherPurpose", ""); set("paymentMethodId", ""); }}>
                        <Building2 size={17} /> Fundraising campaign
                      </button>
                    </div>

                    {giveType === "regular" ? (
                      <>
                        <div className="giving-form-grid">
                          <label className="field">
                            <span>Giving purpose <span className="req" aria-hidden="true">*</span></span>
                            <select value={form.categoryCode} onChange={(event) => { set("categoryCode", event.target.value); if (event.target.value !== "OTHER") set("otherPurpose", ""); }} required>
                              <option value="">Select a purpose</option>
                              {GIVING_CATEGORIES.map((category) => <option value={category.code} key={category.code}>{category.label}</option>)}
                            </select>
                          </label>
                          {form.categoryCode === "OTHER" ? (
                            <Input label="Describe the giving purpose" value={form.otherPurpose} onChange={(event) => set("otherPurpose", event.target.value)} maxLength={500} required />
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <label className="field">
                        <span>Active fundraising campaign <span className="req" aria-hidden="true">*</span></span>
                        <select value={form.campaignId} onChange={(event) => { set("campaignId", event.target.value); set("paymentMethodId", ""); }} required>
                          <option value="">Select a campaign</option>
                          {(campaigns.data ?? []).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
                        </select>
                      </label>
                    )}

                    <div className="giving-payer-choice">
                      <span className="giving-field-heading">Who is this contribution for?</span>
                      <div>
                        <button type="button" className={form.payerMode === "SELF" ? "is-active" : ""} aria-pressed={form.payerMode === "SELF"} onClick={() => { set("payerMode", "SELF"); set("recipientName", ""); set("recipientPhone", ""); set("recipientMemberId", ""); }}>
                          <UserRound size={16} /> For myself
                        </button>
                        <button type="button" className={form.payerMode === "OTHER" ? "is-active" : ""} aria-pressed={form.payerMode === "OTHER"} onClick={() => set("payerMode", "OTHER")}>
                          <UserRoundPlus size={16} /> Paying for someone else
                        </button>
                      </div>
                      {form.payerMode === "SELF" ? (
                        <p>Receipt contributor: <strong>{user.name || "Your member profile"}</strong>{user.phone ? ` · ${user.phone}` : ""}</p>
                      ) : (
                        <div className="giving-form-grid">
                          <Input label="Recipient full name" value={form.recipientName} onChange={(event) => set("recipientName", event.target.value)} maxLength={160} required />
                          <Input label="Recipient phone number" type="tel" value={form.recipientPhone} onChange={(event) => set("recipientPhone", event.target.value)} maxLength={40} required />
                          <Input label="Recipient member ID (optional)" value={form.recipientMemberId} onChange={(event) => set("recipientMemberId", event.target.value)} inputMode="numeric" />
                        </div>
                      )}
                    </div>

                    <div className="giving-form-grid">
                      <label className="field">
                        <span>Payment account used <span className="req" aria-hidden="true">*</span></span>
                        <select value={form.paymentMethodId} onChange={(event) => set("paymentMethodId", event.target.value)} required>
                          <option value="">Select a configured account</option>
                          {activeMethods.map((method) => <option key={method.id} value={method.id}>{method.name}{method.accountHolder ? ` · ${method.accountHolder}` : ""}</option>)}
                        </select>
                      </label>
                      <Input label={`Amount (${activeMethods.find((method) => String(method.id) === String(form.paymentMethodId))?.currency || selectedCampaign?.currency || "ETB"})`} type="number" min="0.01" max="1000000000" step="0.01" value={form.amount} onChange={(event) => set("amount", event.target.value)} required />
                      <Input label="Actual payment date" type="date" max={localToday()} value={form.transferDate} onChange={(event) => set("transferDate", event.target.value)} required />
                      <Input label="Transaction reference / ID" value={form.paymentReference} onChange={(event) => set("paymentReference", event.target.value)} minLength={3} maxLength={200} required />
                    </div>

                    <Input label="Payment evidence link (optional)" type="url" placeholder="https://…" value={form.imgbbUrl} onChange={(event) => set("imgbbUrl", event.target.value)} hint="Only add a link to evidence you are comfortable sharing with the finance team." />
                    <Input label="Additional notes (optional)" type="textarea" rows={3} value={form.note} onChange={(event) => set("note", event.target.value)} maxLength={2000} />
                    <label className="giving-confirm-check">
                      <input type="checkbox" checked={form.accuracyConfirmed} onChange={(event) => set("accuracyConfirmed", event.target.checked)} required />
                      <span>I confirm these payment details are accurate. I understand this submission remains pending until verified by the finance team.</span>
                    </label>

                    <div className="giving-form-footer">
                      <p>Official receipts are issued only after authorized approval.</p>
                      <Button type="submit" loading={submitting} disabled={!activeMethods.length} iconRight={<Send size={15} />}>Submit for review</Button>
                    </div>
                  </form>
                )
              ) : null}

              {activeTab === "history" ? (
                <div className="giving-records-panel">
                  <div className="giving-panel-title">
                    <div><h3>My giving history</h3><p>Each contribution is shown with its current review status.</p></div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setRecordsVersion((version) => version + 1)}>Refresh</Button>
                  </div>
                  {recordsLoading ? <div className="giving-record-skeleton" /> : recordsError ? <ErrorMessage error={recordsError} onRetry={() => setRecordsVersion((version) => version + 1)} title="Giving history could not be loaded" /> : records.length ? (
                    <div className="giving-record-list">{records.map((record) => <GivingRecordCard key={record.id} record={record} onOpenReceipt={openReceipt} onResubmit={startResubmission} />)}</div>
                  ) : emptyHistory}
                </div>
              ) : null}

              {activeTab === "receipts" ? (
                <div className="giving-records-panel">
                  <div className="giving-panel-title">
                    <div><h3>Official receipts</h3><p>Only contributions approved by authorized finance staff appear here.</p></div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setRecordsVersion((version) => version + 1)}>Refresh</Button>
                  </div>
                  {recordsLoading ? <div className="giving-record-skeleton" /> : recordsError ? <ErrorMessage error={recordsError} onRetry={() => setRecordsVersion((version) => version + 1)} title="Receipts could not be loaded" /> : approvedRecords.length ? (
                    <div className="giving-record-list">{approvedRecords.map((record) => <GivingRecordCard key={record.id} record={record} onOpenReceipt={openReceipt} onResubmit={startResubmission} />)}</div>
                  ) : (
                    <EmptyState icon={<Receipt size={30} />} title="No official receipts yet" description="When a finance reviewer approves a contribution, its official receipt will appear here." />
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
      <Modal
        open={Boolean(selectedReceiptRecord)}
        onClose={() => { setSelectedReceiptRecord(null); setReceipt(null); setReceiptError(""); }}
        title="Official contribution receipt"
        description="This receipt is available because the contribution has been approved."
        size="lg"
        footer={receipt && !receiptLoading && !receiptError ? (
          <Button type="button" variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>Print / save as PDF</Button>
        ) : null}
      >
        <ReceiptPreview
          receipt={receipt}
          loading={receiptLoading}
          error={receiptError}
          onRetry={() => selectedReceiptRecord && openReceipt(selectedReceiptRecord)}
        />
      </Modal>
    </main>
  );
}
