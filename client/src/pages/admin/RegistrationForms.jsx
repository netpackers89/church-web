import { useState } from "react";
import { adminService, unwrap } from "../../services/api.js";
import useAsync from "../../hooks/useAsync.js";
import Alert from "../../components/ui/Alert.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import ImageUploadField from "../../components/ui/ImageUploadField.jsx";
import { contentService } from "../../services/index.js";
import { useToast } from "../../components/feedback/ToastProvider.jsx";

const blankDepartment = {
  name: "",
  category: "",
  description: "",
  logoUrl: "",
  bannerUrl: "",
  leaderName: "",
  leaderPhone: "",
  contactEmail: "",
  visibility: "PUBLIC",
  isActive: true,
  telegramType: "none",
  telegramUsername: "",
  telegramPublicLink: "",
  telegramInviteLink: "",
};

const blankGroup = {
  name: "",
  description: "",
  groupEmail: "",
  leaderName: "",
  leaderPhone: "",
  locationText: "",
  googleMapsLink: "",
  meetingSchedule: "",
  currentStudy: "",
  capacity: "",
  groupProfileImage: "",
  bannerImage: "",
  isPublic: true,
  isActive: true,
  telegramType: "none",
  telegramUsername: "",
  telegramPublicLink: "",
  telegramInviteLink: "",
};

function uploadLogo(file, name) {
  return contentService.uploadImage(file, {
    mediaType: "LOGO",
    title: name || "Logo",
  });
}
function uploadBanner(file, name) {
  return contentService.uploadImage(file, {
    mediaType: "BANNER",
    title: name || "Banner",
  });
}
function uploadProfile(file, name) {
  return contentService.uploadImage(file, {
    mediaType: "PROFILE",
    title: name || "Profile",
  });
}

function RegistrationForm({ kind, onSaved }) {
  const isDepartment = kind === "department";
  const { success } = useToast();
  const [form, setForm] = useState(
    isDepartment ? { ...blankDepartment } : { ...blankGroup },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [mapsPreview, setMapsPreview] = useState("");

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const uploadLogoField = async (file) => {
    const res = await uploadLogo(file, form.name);
    const url =
      res?.data?.data?.url || res?.data?.data?.imageUrl || res?.data?.url || "";
    if (!url)
      throw new Error("The upload service did not return a public URL.");
    setForm((c) => ({ ...c, logoUrl: url }));
    return res;
  };
  const uploadBannerField = async (file) => {
    const res = await uploadBanner(file, form.name);
    const url =
      res?.data?.data?.url || res?.data?.data?.imageUrl || res?.data?.url || "";
    if (!url)
      throw new Error("The upload service did not return a public URL.");
    setForm((c) => ({ ...c, bannerUrl: url }));
    return res;
  };
  const uploadProfileField = async (file) => {
    const res = await uploadProfile(file, form.name);
    const url =
      res?.data?.data?.url || res?.data?.data?.imageUrl || res?.data?.url || "";
    if (!url)
      throw new Error("The upload service did not return a public URL.");
    setForm((c) => ({ ...c, groupProfileImage: url }));
    return res;
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const payload = { ...form };
      if (!isDepartment)
        payload.capacity =
          payload.capacity === "" ? null : Number(payload.capacity);
      const result = isDepartment
        ? await adminService.createDepartment(payload)
        : await adminService.createBibleStudyGroup(payload);
      const record = unwrap(result);
      setSaved(
        `${isDepartment ? "Department" : "Bible study group"} “${record?.name || form.name}” created.`,
      );
      setForm(isDepartment ? { ...blankDepartment } : { ...blankGroup });
      if (onSaved) onSaved();
    } catch (submitError) {
      setError(
        submitError.message ||
          `Could not create the ${isDepartment ? "department" : "Bible study group"}.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const validatedMapsUrl = (value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        (url.hostname === "maps.app.goo.gl" ||
          url.hostname === "maps.google.com" ||
          (url.hostname === "www.google.com" &&
            url.pathname.startsWith("/maps")))
      );
    } catch {
      return false;
    }
  };

  return (
    <form className="reg-form" onSubmit={submit}>
      <div className="reg-card">
        <div className="reg-card-head">
          <h3 className="reg-title">
            {isDepartment ? "Department details" : "Group details"}
          </h3>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          {saved ? <Alert variant="success">{saved}</Alert> : null}
        </div>

        <div className="reg-grid">
          <div className="reg-field">
            <Input
              label={isDepartment ? "Department name" : "Group name"}
              placeholder="e.g. Youth Ministry"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              required
            />
          </div>
          {isDepartment ? (
            <Input
              label="Category"
              placeholder="e.g. Youth"
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
            />
          ) : (
            <div className="reg-field">
              <Input
                label="Group email"
                type="email"
                placeholder="biblestudy@church.example"
                value={form.groupEmail}
                onChange={(e) => setField("groupEmail", e.target.value)}
              />
            </div>
          )}
        </div>

        <Input
          type="textarea"
          label="Description"
          placeholder="Describe the community and its purpose."
          rows={4}
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
        />

        <div className="reg-grid">
          <div className="reg-field">
            <Input
              label="Leader name"
              placeholder="Community leader"
              value={form.leaderName}
              onChange={(e) => setField("leaderName", e.target.value)}
            />
          </div>
          <div className="reg-field">
            <Input
              label="Leader phone"
              type="tel"
              placeholder="+251912345678"
              value={form.leaderPhone}
              onChange={(e) => setField("leaderPhone", e.target.value)}
            />
          </div>
        </div>

        {isDepartment ? (
          <>
            <div className="reg-field">
              <Input
                label="Department email"
                type="email"
                placeholder="youth@church.example"
                value={form.contactEmail}
                onChange={(e) => setField("contactEmail", e.target.value)}
              />
            </div>
            <div className="reg-grid">
              <div className="reg-field">
                <ImageUploadField
                  label="Logo image"
                  value={form.logoUrl}
                  onChange={(value) => setField("logoUrl", value)}
                  onUpload={uploadLogoField}
                  required={false}
                  hint="Upload a logo (optional)."
                />
              </div>
              <div className="reg-field">
                <ImageUploadField
                  label="Banner image"
                  value={form.bannerUrl}
                  onChange={(value) => setField("bannerUrl", value)}
                  onUpload={uploadBannerField}
                  required={false}
                  hint="Upload a banner (optional)."
                />
              </div>
            </div>
            <Input
              type="select"
              label="Visibility"
              options={[
                { value: "PUBLIC", label: "Public" },
                { value: "PRIVATE", label: "Private" },
              ]}
              value={form.visibility}
              onChange={(e) => setField("visibility", e.target.value)}
            />
          </>
        ) : (
          <>
            <div className="reg-grid">
              <div className="reg-field">
                <Input
                  label="Physical meeting location"
                  placeholder="Church hall / address"
                  value={form.locationText}
                  onChange={(e) => setField("locationText", e.target.value)}
                />
              </div>
              <div className="reg-field">
                <Input
                  label="Meeting schedule"
                  placeholder="Every Wednesday at 18:30"
                  value={form.meetingSchedule}
                  onChange={(e) => setField("meetingSchedule", e.target.value)}
                />
              </div>
            </div>
            <div className="reg-field">
              <Input
                label="Google Maps sharing link"
                type="url"
                placeholder="https://maps.google.com/maps?..."
                value={form.googleMapsLink}
                onChange={(e) => setField("googleMapsLink", e.target.value)}
                onBlur={(e) =>
                  setMapsPreview(
                    validatedMapsUrl(e.target.value) ? e.target.value : "",
                  )
                }
              />
              {mapsPreview ? (
                <p>
                  <a href={mapsPreview} target="_blank" rel="noreferrer">
                    Open location in Google Maps
                  </a>
                </p>
              ) : null}
            </div>
            <div className="reg-grid">
              <div className="reg-field">
                <Input
                  label="Maximum members"
                  type="number"
                  min="1"
                  placeholder="Leave blank for no limit"
                  value={form.capacity}
                  onChange={(e) => setField("capacity", e.target.value)}
                />
              </div>
              <div className="reg-field">
                <Input
                  label="Current Bible book / topic"
                  placeholder="Romans 12"
                  value={form.currentStudy}
                  onChange={(e) => setField("currentStudy", e.target.value)}
                />
              </div>
            </div>
            <div className="reg-grid">
              <div className="reg-field">
                <ImageUploadField
                  label="Group profile image"
                  value={form.groupProfileImage}
                  onChange={(value) => setField("groupProfileImage", value)}
                  onUpload={uploadProfileField}
                  required={false}
                  hint="Upload a profile picture (optional)."
                />
              </div>
              <div className="reg-field">
                <ImageUploadField
                  label="Banner image"
                  value={form.bannerImage}
                  onChange={(value) => setField("bannerImage", value)}
                  onUpload={uploadBannerField}
                  required={false}
                  hint="Upload a banner (optional)."
                />
              </div>
            </div>
          </>
        )}

        <div className="reg-note">
          <label className="check">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField("isActive", e.target.checked)}
            />
            <span>Active</span>
          </label>
          {!isDepartment ? (
            <label className="check">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => setField("isPublic", e.target.checked)}
              />
              <span>Publicly visible</span>
            </label>
          ) : null}
        </div>

        <div className="reg-note">
          <h3 className="reg-title" style={{ marginBottom: "0.3rem" }}>
            Telegram destination
          </h3>
          <p
            className="muted"
            style={{ marginTop: "0.2rem", marginBottom: "0.6rem" }}
          >
            A saved destination remains unverified until the church bot confirms
            access.
          </p>
          <Input
            type="select"
            label="Destination type"
            options={[
              { value: "none", label: "Not connected" },
              { value: "group", label: "Group" },
              { value: "channel", label: "Channel" },
            ]}
            value={form.telegramType}
            onChange={(e) => setField("telegramType", e.target.value)}
          />
          {form.telegramType !== "none" ? (
            <div className="reg-grid">
              <div className="reg-field">
                <Input
                  label="Public username"
                  placeholder="@YouthMinistryAddis"
                  value={form.telegramUsername}
                  onChange={(e) => setField("telegramUsername", e.target.value)}
                />
              </div>
              <div className="reg-field">
                <Input
                  label="Public link"
                  type="url"
                  placeholder="https://t.me/…"
                  value={form.telegramPublicLink}
                  onChange={(e) =>
                    setField("telegramPublicLink", e.target.value)
                  }
                />
              </div>
              <div className="reg-field">
                <Input
                  label="Private invitation link"
                  type="url"
                  placeholder="https://t.me/…"
                  value={form.telegramInviteLink}
                  onChange={(e) =>
                    setField("telegramInviteLink", e.target.value)
                  }
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="reg-actions">
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            disabled={saving}
          >
            {saving
              ? "Creating…"
              : `Create ${isDepartment ? "Department" : "Bible study group"}`}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function DepartmentRegistrationForm() {
  return <RegistrationForm kind="department" />;
}

export function BibleStudyGroupRegistrationForm() {
  return <RegistrationForm kind="group" />;
}

export function OrganizationRegistrationForm({ onSaved }) {
  const { success } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const result = unwrap(
        await adminService.createOrganization({
          name: name.trim(),
          description: description.trim(),
          imageUrl,
          isPublic,
          isActive,
        }),
      );
      setSaved(`Organization “${result?.name || name}” created.`);
      setName("");
      setDescription("");
      setImageUrl("");
      if (onSaved) onSaved(result);
    } catch (failure) {
      setError(failure.message || "Could not create the organization.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="reg-form" onSubmit={submit}>
      <div className="reg-card">
        <div className="reg-card-head">
          <h3 className="reg-title">Organization details</h3>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          {saved ? <Alert variant="success">{saved}</Alert> : null}
        </div>
        <div className="reg-grid">
          <div className="reg-field">
            <Input
              label="Organization name"
              placeholder="e.g. Youth Fellowship"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={150}
              required
            />
          </div>
        </div>
        <Input
          type="textarea"
          label="Description"
          placeholder="Describe this organization and its purpose."
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <ImageUploadField
          label="Organization image"
          value={imageUrl}
          onChange={setImageUrl}
          onUpload={(file) => uploadBanner(file, name)}
          hint="Optional. Upload an image or paste a public HTTPS image URL."
        />
        <div className="reg-grid">
          <div className="reg-field">
            <label className="check">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span>Publicly visible on the website</span>
            </label>
          </div>
          <div className="reg-field">
            <label className="check">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Active</span>
            </label>
          </div>
        </div>
        <div className="reg-actions">
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            disabled={saving}
          >
            {saving ? "Creating…" : "Create organization"}
          </Button>
        </div>
      </div>
    </form>
  );
}
