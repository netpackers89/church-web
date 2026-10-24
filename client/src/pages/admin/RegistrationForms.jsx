import { useEffect, useRef, useState } from "react";
import { adminService, unwrap } from "../../services/api.js";
import useAsync from "../../hooks/useAsync.js";
import Alert from "../../components/ui/Alert.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import ImageUploadField from "../../components/ui/ImageUploadField.jsx";
import { contentService } from "../../services/index.js";
import CommunityLinksFields from "../../components/groups/CommunityLinksFields.jsx";

const blankDepartment = {
  name: "",
  category: "",
  description: "",
  logoUrl: "",
  bannerUrl: "",
  leaderUserId: "",
  contactEmail: "",
  meetingLocation: "",
  meetingSchedule: "",
  visibility: "PUBLIC",
  isActive: true,
  telegramType: "none",
  telegramUsername: "",
  telegramPublicLink: "",
  telegramInviteLink: "",
  communityLinks: [],
};

const blankGroup = {
  name: "",
  description: "",
  groupEmail: "",
  leaderUserId: "",
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
  communityLinks: [],
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

function leaderLoadMessage(error) {
  if (error?.status === 401) return "Your session has expired. Sign in again to search member accounts.";
  if (error?.status === 403) return "Your account does not have permission to assign a leader.";
  if (error?.status >= 500) return "The server could not load member accounts. Please retry in a moment.";
  if (!error?.status) return "Could not connect to the server. Check your connection and retry.";
  return error.message || "Member accounts could not be loaded.";
}

function RegistrationForm({ kind, onSaved, initialValue = null, onCancel }) {
  const isDepartment = kind === "department";
  const blankForm = isDepartment ? blankDepartment : blankGroup;
  const [form, setForm] = useState(() => ({
    ...blankForm,
    ...(initialValue || {}),
    leaderUserId: initialValue?.leaderUserId ?? "",
    meetingLocation: initialValue?.meetingLocation ?? initialValue?.locationText ?? initialValue?.location ?? "",
    groupProfileImage: initialValue?.groupProfileImage ?? initialValue?.logoUrl ?? "",
    bannerImage: initialValue?.bannerImage ?? initialValue?.bannerUrl ?? "",
  }));
  const [leaderQuery, setLeaderQuery] = useState("");
  const [leaderSearch, setLeaderSearch] = useState("");
  const [isLeaderMenuOpen, setIsLeaderMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [mapsPreview, setMapsPreview] = useState("");
  const leaderSelectRef = useRef(null);
  const leaders = useAsync(async () => (
    unwrap(await adminService.groupLeaderCandidates({ search: leaderSearch })) ?? []
  ), [leaderSearch]);
  const leaderLabel = (leader) => {
    const name = leader.name || "Unnamed account";
    const accountType = String(leader.role ?? "MEMBER").toUpperCase() === "MEMBER"
      ? "Member"
      : "Staff";
    return `${name} · ${accountType}`;
  };
  const candidates = Array.isArray(leaders.data) ? leaders.data : [];
  const selectedLeader = candidates.find(
    (leader) => String(leader.id) === String(form.leaderUserId),
  ) || (initialValue?.leaderUserId && String(initialValue.leaderUserId) === String(form.leaderUserId)
    ? { id: initialValue.leaderUserId, name: initialValue.leaderName, role: initialValue.leaderRole }
    : null);

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaderSearch(leaderQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [leaderQuery]);

  useEffect(() => {
    if (!isLeaderMenuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!leaderSelectRef.current?.contains(event.target)) setIsLeaderMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [isLeaderMenuOpen]);

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
    let saveConfirmed = false;
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([key]) => !["leaderPhone", "leaderEmail"].includes(key)),
      );
      if (!isDepartment)
        payload.capacity =
          payload.capacity === "" ? null : Number(payload.capacity);
      const result = isDepartment
        ? initialValue
          ? await adminService.updateDepartment(initialValue.id, payload)
          : await adminService.createDepartment(payload)
        : initialValue
          ? await adminService.updateBibleStudyGroup(initialValue.id, payload)
          : await adminService.createBibleStudyGroup(payload);
      const record = unwrap(result);
      saveConfirmed = true;
      setSaved(`${isDepartment ? "Department" : "Bible study group"} “${record?.name || form.name}” ${initialValue ? "updated" : "created"}.`);
      if (!initialValue) {
        setForm({ ...blankForm });
        setLeaderQuery("");
        setLeaderSearch("");
      }
      if (onSaved) await onSaved();
    } catch (submitError) {
      setError(saveConfirmed
        ? `Saved successfully, but the list could not refresh. ${submitError.message || "Refresh the page to see the saved item."}`
        : submitError.message ||
          `Could not create the ${isDepartment ? "department" : "Bible study group"}.`);
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

        <div className="reg-field">
          <label htmlFor="group-leader-search">Assigned leader</label>
          <div className="relative" ref={leaderSelectRef}>
            <button
              id="group-leader-search"
              type="button"
              className="select flex w-full items-center justify-between gap-3 text-left"
              aria-haspopup="listbox"
              aria-expanded={isLeaderMenuOpen}
              onClick={() => {
                setLeaderQuery("");
                setLeaderSearch("");
                setIsLeaderMenuOpen((open) => !open);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && isLeaderMenuOpen) {
                  event.stopPropagation();
                  setIsLeaderMenuOpen(false);
                }
              }}
            >
              <span className={selectedLeader ? "truncate" : "truncate text-slate-500"}>
                {selectedLeader ? leaderLabel(selectedLeader) : "Choose a registered member or staff"}
              </span>
              <span aria-hidden="true" className="text-slate-500">{isLeaderMenuOpen ? "⌃" : "⌄"}</span>
            </button>

            {isLeaderMenuOpen ? (
              <div
                className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setIsLeaderMenuOpen(false);
                  }
                }}
              >
                <div className="border-b border-slate-100 p-3">
                  <Input
                    label="Search members or staff"
                    type="search"
                    placeholder="Type a name to search"
                    value={leaderQuery}
                    onChange={(event) => setLeaderQuery(event.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1.5" role="listbox" aria-label="Registered members and staff">
                  <button
                    type="button"
                    role="option"
                    aria-selected={!form.leaderUserId}
                    className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                    onClick={() => {
                      setField("leaderUserId", "");
                      setIsLeaderMenuOpen(false);
                    }}
                  >
                    No leader assigned
                  </button>
                  {leaders.loading ? (
                    <p className="px-3 py-4 text-sm text-slate-500" role="status">Searching registered accounts…</p>
                  ) : leaders.error ? (
                    <div className="space-y-2 px-3 py-4 text-sm">
                      <p className="text-amber-800">Registered accounts could not be loaded: {leaderLoadMessage(leaders.error)}</p>
                      <Button type="button" size="sm" variant="secondary" onClick={leaders.reload}>Try again</Button>
                    </div>
                  ) : candidates.length ? (
                    <>
                      {candidates.map((leader) => (
                        <button
                          key={leader.id}
                          type="button"
                          role="option"
                          aria-selected={String(leader.id) === String(form.leaderUserId)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50"
                          onClick={() => {
                            setField("leaderUserId", String(leader.id));
                            setIsLeaderMenuOpen(false);
                          }}
                        >
                          <span className="truncate">{leaderLabel(leader)}</span>
                          {String(leader.id) === String(form.leaderUserId) ? <span aria-hidden="true" className="text-blue-700">✓</span> : null}
                        </button>
                      ))}
                      {leaderSearch && candidates.length === 100 ? (
                        <p className="px-3 py-2 text-xs text-slate-500">Showing the first 100 matches. Add more letters to narrow your search.</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="px-3 py-4 text-sm text-slate-500">
                      {leaderSearch ? "No registered accounts match that search." : "No active registered accounts are available."}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <span className="hint">Select an existing member or staff account. Search by name if the list is long.</span>
          {leaders.error && !isLeaderMenuOpen ? <Alert variant="warning">Registered accounts could not be loaded: {leaderLoadMessage(leaders.error)}</Alert> : null}
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
                <Input
                  label="Department meeting location"
                  placeholder="Church hall / neighborhood"
                  value={form.meetingLocation}
                  onChange={(e) => setField("meetingLocation", e.target.value)}
                />
              </div>
              <div className="reg-field">
                <Input
                  label="Department meeting schedule"
                  placeholder="Every Saturday at 10:00"
                  value={form.meetingSchedule}
                  onChange={(e) => setField("meetingSchedule", e.target.value)}
                />
              </div>
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
          <CommunityLinksFields
            value={form.communityLinks}
            onChange={(communityLinks) => setField("communityLinks", communityLinks)}
          />
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
            {saving ? (initialValue ? "Saving…" : "Creating…") : `${initialValue ? "Save" : "Create"} ${isDepartment ? "Department" : "Bible study group"}`}
          </Button>
          {onCancel ? <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button> : null}
        </div>
      </div>
    </form>
  );
}

export function DepartmentRegistrationForm(props) {
  return <RegistrationForm kind="department" {...props} />;
}

export function BibleStudyGroupRegistrationForm(props) {
  return <RegistrationForm kind="group" {...props} />;
}

export function OrganizationRegistrationForm({ onSaved }) {
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
