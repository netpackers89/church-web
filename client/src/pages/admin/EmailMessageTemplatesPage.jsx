import { useEffect, useState } from "react";
import { Eye, ImagePlus, Mail, Plus, Save, Sparkles } from "lucide-react";
import { adminService, contentService } from "../../services/index.js";
import Button from "../../components/ui/Button.jsx";
import Alert from "../../components/ui/Alert.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import Input from "../../components/ui/Input.jsx";
import { useToast } from "../../components/feedback/ToastProvider.jsx";

const CATEGORIES = [
  ["WELCOME", "Welcome"],
  ["SUNDAY_SERVICE", "Sunday service"],
  ["CONFERENCE", "Conference"],
  ["CAMPAIGN", "Campaign"],
  ["FUNDRAISING", "Fundraising"],
  ["ANNOUNCEMENT", "Announcement"],
  ["NEW_EVENT", "New event"],
  ["REGULAR_PROGRAM", "Regular program"],
  ["NEW_CHRISTIAN_FOLLOW_UP", "New Christian follow-up"],
  ["GENERAL", "General church message"],
  ["OTHER", "Other"],
];

const EMPTY_TEMPLATE = {
  id: null,
  code: "",
  channel: "EMAIL",
  name: "",
  category: "WELCOME",
  title: "",
  subject: "",
  greeting: "Dear {{firstName}},",
  body: "",
  signature: "With care,\n{{churchName}}",
  bannerUrl: "",
  ctaUrl: "",
  ctaLabel: "",
  isArchived: false,
};

const PLACEHOLDERS = [
  "{{firstName}}",
  "{{name}}",
  "{{churchName}}",
  "{{title}}",
  "{{message}}",
  "{{eventDate}}",
  "{{eventTime}}",
  "{{eventLocation}}",
];

export default function EmailMessageTemplatesPage() {
  const { success } = useToast();
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [error, setError] = useState("");

  async function loadTemplates(preferredId = null) {
    setLoading(true);
    setError("");
    try {
      const response = await adminService.emailTemplates();
      const list = response.data?.data ?? [];
      setTemplates(list);
      const chosen =
        list.find((template) => String(template.id) === String(preferredId)) ||
        list[0];
      setSelectedId(chosen?.id ?? null);
      setForm(chosen ? { ...EMPTY_TEMPLATE, ...chosen } : EMPTY_TEMPLATE);
      setPreviewHtml("");
    } catch (failure) {
      setError(failure.message || "Email templates could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  function selectTemplate(template) {
    setSelectedId(template.id);
    setForm({ ...EMPTY_TEMPLATE, ...template });
    setError("");
    setPreviewHtml("");
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setPreviewHtml("");
    setError("");
  }

  function startNew() {
    setSelectedId(null);
    setForm({ ...EMPTY_TEMPLATE });
    setPreviewHtml("");
    setError("");
  }

  async function uploadBanner(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const response = await contentService.uploadImage(file, {
        mediaType: "IMAGE",
        title: form.name || "Email message banner",
        isThumbnail: true,
      });
      const payload = response.data?.data ?? response.data ?? {};
      const url = payload.url || payload.imageUrl || payload.mediaUrl;
      if (!url)
        throw new Error("The image service did not return an image URL.");
      update("bannerUrl", url);
    } catch (failure) {
      setError(failure.message || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function saveTemplate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };
      const response = selectedId
        ? await adminService.updateEmailTemplate(selectedId, payload)
        : await adminService.createEmailTemplate(payload);
      const saved = response.data?.data;
      success("Email template saved");
      await loadTemplates(saved?.id ?? selectedId);
    } catch (failure) {
      setError(failure.message || "Email template could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function previewTemplate() {
    setPreviewing(true);
    setError("");
    try {
      const response = await adminService.previewEmailTemplate({
        ...form,
        channel: form.channel,
      });
      setPreviewHtml(response.data?.data?.html ?? "");
    } catch (failure) {
      setError(failure.message || "Preview could not be generated.");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="stack-lg email-template-studio">
      <div className="page-head">
        <div>
          <span className="eyebrow blue">
            <span className="dot" /> Communications
          </span>
          <h1>Communication templates</h1>
          <p>
            Create reusable email and Telegram wording, imagery, and action links.
          </p>
        </div>
        <Button type="button" iconRight={<Plus size={15} />} onClick={startNew}>
          New template
        </Button>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      <div className="email-template-layout">
        <aside
          className="card email-template-list"
          aria-label="Saved email templates"
        >
          <div className="email-template-list-heading">
            <h2>Saved templates</h2>
            <span>{templates.length}</span>
          </div>
          {loading ? (
            <p className="muted">Loading templates…</p>
          ) : templates.length ? (
            <div className="email-template-list-items">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`email-template-list-item${String(selectedId) === String(template.id) ? " is-selected" : ""}`}
                  onClick={() => selectTemplate(template)}
                >
                  <span className="email-template-item-icon">
                    <Mail size={16} />
                  </span>
                  <span>
                    <strong>{template.name}</strong>
                    <small>
                      {template.category?.replaceAll("_", " ")}
                      {template.isArchived ? " · Archived" : ""}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Mail}
              title="No email templates yet"
              description="Create a reusable message template to get started."
            />
          )}
        </aside>

        <form className="card email-template-editor" onSubmit={saveTemplate}>
          <div className="email-template-editor-head">
            <div>
              <h2>{selectedId ? "Edit template" : "Create template"}</h2>
              <p>Use placeholders to personalize each message.</p>
            </div>
            <span className="email-template-channel">
              <Mail size={14} /> {form.channel === "BOTH" ? "Email & Telegram" : form.channel === "TELEGRAM" ? "Telegram" : "Email"}
            </span>
          </div>

          <div className="email-template-fields">
            <Input
              label="Template name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              required
              maxLength={150}
            />
            <div className="field">
              <label htmlFor="email-template-category">Category</label>
              <select
                id="email-template-category"
                className="select"
                value={form.category}
                onChange={(event) => update("category", event.target.value)}
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Delivery channel"
              type="select"
              value={form.channel}
              onChange={(event) => update("channel", event.target.value)}
              options={[{ value: "EMAIL", label: "Email" }, { value: "TELEGRAM", label: "Telegram" }, { value: "BOTH", label: "Email and Telegram" }]}
            />
            <Input
              label="Template key"
              value={form.code}
              onChange={(event) => update("code", event.target.value)}
              required
              maxLength={80}
              hint="Lowercase identifier, e.g. email_welcome_default"
              disabled={Boolean(selectedId)}
            />
            <Input
              label="Email subject"
              value={form.subject}
              onChange={(event) => update("subject", event.target.value)}
              required
              maxLength={255}
            />
            <div className="email-template-wide field">
              <label htmlFor="email-template-banner-url">
                Hero banner image URL
              </label>
              <div className="email-template-banner-controls">
                <input
                  id="email-template-banner-url"
                  className="input"
                  type="url"
                  value={form.bannerUrl || ""}
                  onChange={(event) => update("bannerUrl", event.target.value)}
                  placeholder="https://…"
                />
                <label className="email-template-upload">
                  <ImagePlus size={16} />
                  {uploading ? "Uploading…" : "Upload"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={uploadBanner}
                    disabled={uploading}
                  />
                </label>
              </div>
              {form.bannerUrl ? (
                <img
                  className="email-template-banner-preview"
                  src={form.bannerUrl}
                  alt="Email banner preview"
                />
              ) : (
                <span className="hint">
                  Upload via the configured image service or paste a trusted
                  HTTPS image URL.
                </span>
              )}
            </div>
            <Input
              label="Greeting"
              value={form.greeting || ""}
              onChange={(event) => update("greeting", event.target.value)}
              maxLength={300}
            />
            <Input
              label="Main title"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              required
              maxLength={200}
            />
            <label className="email-template-wide field">
              <span>Message body</span>
              <textarea
                className="textarea"
                rows={8}
                value={form.body}
                onChange={(event) => update("body", event.target.value)}
                required
                maxLength={12000}
              />
            </label>
            <Input
              label="Button label (optional)"
              value={form.ctaLabel || ""}
              onChange={(event) => update("ctaLabel", event.target.value)}
              maxLength={80}
            />
            <Input
              label="Button URL (optional)"
              type="url"
              value={form.ctaUrl || ""}
              onChange={(event) => update("ctaUrl", event.target.value)}
              maxLength={1000}
            />
            <label className="email-template-wide field">
              <span>Signature</span>
              <textarea
                className="textarea"
                rows={3}
                value={form.signature || ""}
                onChange={(event) => update("signature", event.target.value)}
                maxLength={500}
              />
            </label>
            <div className="email-template-wide email-template-placeholder-bar">
              <strong>Personalization</strong>
              <span>
                {PLACEHOLDERS.map((placeholder) => (
                  <code key={placeholder}>{placeholder}</code>
                ))}
              </span>
              <small>
                Unknown placeholders remain visible in preview so they can be
                corrected before sending.
              </small>
            </div>
            <label className="email-template-wide email-template-archive">
              <input
                type="checkbox"
                checked={Boolean(form.isArchived)}
                onChange={(event) => update("isArchived", event.target.checked)}
              />{" "}
              Archive this template so it is no longer offered for selection.
            </label>
          </div>

          <div className="email-template-actions">
            <Button
              type="button"
              variant="secondary"
              loading={previewing}
              iconLeft={<Eye size={15} />}
              onClick={previewTemplate}
            >
              Preview email
            </Button>
            <Button
              type="submit"
              loading={saving}
              iconLeft={<Save size={15} />}
            >
              Save template
            </Button>
          </div>
        </form>

        <section
          className="card email-template-preview"
          aria-label="Email preview"
        >
          <div className="email-template-preview-head">
            <span className="email-template-preview-icon">
              <Sparkles size={16} />
            </span>
            <div>
              <h2>Live preview</h2>
              <p>Sample member: Amanuel Desta</p>
            </div>
          </div>
          {previewHtml ? (
            <iframe
              title="Rendered email template preview"
              sandbox=""
              srcDoc={previewHtml}
            />
          ) : (
            <div className="email-template-preview-empty">
              <Mail size={24} />
              <p>
                Preview your template to see the branded email layout and sample
                personalization.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
