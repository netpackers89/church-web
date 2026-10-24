import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  KeyRound,
  Mail,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { publicService, unwrap, userService } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../feedback/ToastProvider.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";
import Alert from "../ui/Alert.jsx";
import TelegramIntegrationPanel from "../layout/TelegramIntegrationPanel.jsx";
import ProfileAvatar from "../ui/ProfileAvatar.jsx";
import "./AccountDrawer.css";

const TABS = [
  { id: "profile", label: "Profile info", Icon: UserRound },
  { id: "security", label: "Security", Icon: Shield },
  { id: "notifications", label: "Notifications", Icon: Bell },
];
const BIRTH_YEAR_OPTIONS = Array.from({ length: 100 }, (_, index) => new Date().getFullYear() - 7 - index);

function userProfile(response) {
  return response?.data?.data ?? response?.data?.user ?? response?.data ?? {};
}

export default function AccountDrawer({ open, onClose, initialTab = "profile" }) {
  const { user, setUser } = useAuth();
  const { success, error: toastError } = useToast();
  const panelRef = useRef(null);
  const previousFocus = useRef(null);
  const [tab, setTab] = useState(initialTab);
  const [profile, setProfile] = useState(null);
  const [birthDateParts, setBirthDateParts] = useState({ year: "", month: "", day: "" });
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [profileErrors, setProfileErrors] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [photoSelection, setPhotoSelection] = useState(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [email, setEmail] = useState({ next: "", currentPassword: "" });
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [preferences, setPreferences] = useState({ notifyEmail: false });
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus?.();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    Promise.all([userService.profile(), publicService.registrationOptions()])
      .then(([profileResponse, optionsResponse]) => {
        if (!active) return;
        const nextProfile = userProfile(profileResponse);
        setProfile(nextProfile);
        const [year = "", month = "", day = ""] = (nextProfile.birthDateEc || "").split("-");
        setBirthDateParts({ year, month: month ? String(Number(month)) : "", day: day ? String(Number(day)) : "" });
        setPreferences({ notifyEmail: Boolean(nextProfile.notifyEmail) });
        setOptions(unwrap(optionsResponse) ?? {});
      })
      .catch((error) => {
        if (active) setLoadError(error.message || "Account information could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [open]);

  useEffect(() => () => {
    if (photoSelection?.previewUrl) URL.revokeObjectURL(photoSelection.previewUrl);
  }, [photoSelection]);

  function updateProfileField(key, value) {
    setProfile((current) => ({ ...current, [key]: value }));
    setProfileErrors((current) => ({ ...current, [key]: undefined }));
    setProfileSaved(false);
  }

  async function saveProfile(event) {
    event.preventDefault();
    const errors = {};
    if (!profile?.name?.trim() || profile.name.trim().length < 2) errors.name = "Enter your full name.";
    if (!profile?.phone?.trim()) errors.phone = "Enter your phone number.";
    if (!profile?.location) errors.location = "Select your location.";
    if (profile?.location === "Other" && !profile.otherLocation?.trim()) errors.otherLocation = "Describe your location.";
    const hasBirthDatePart = Object.values(birthDateParts).some(Boolean);
    const hasCompleteBirthDate = Object.values(birthDateParts).every(Boolean);
    if (hasBirthDatePart && !hasCompleteBirthDate) errors.birthDateEc = "Choose a year, month, and day, or leave the date unchanged.";
    setProfileErrors(errors);
    if (Object.keys(errors).length) return;

    setProfileSaving(true);
    try {
      const payload = {
        name: profile.name.trim(),
        phone: profile.phone.trim(),
        location: profile.location,
        otherLocation: profile.location === "Other" ? profile.otherLocation.trim() : undefined,
        preferredLanguage: profile.preferredLanguage || "en",
      };
      if (hasCompleteBirthDate) {
        payload.birthDateEc = `${birthDateParts.year}-${String(birthDateParts.month).padStart(2, "0")}-${String(birthDateParts.day).padStart(2, "0")}`;
      }
      const response = await userService.updateProfile(payload);
      const updated = userProfile(response);
      setProfile((current) => ({ ...current, ...updated }));
      if (updated && setUser) setUser((current) => ({ ...(current ?? user ?? {}), ...updated }));
      setProfileSaved(true);
      success("Profile updated", "Your details have been saved.");
    } catch (error) {
      setProfileErrors((current) => ({ ...current, form: error.message || "Could not save your profile." }));
    } finally {
      setProfileSaving(false);
    }
  }

  function selectPhoto(event) {
    const [file] = event.target.files ?? [];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setPhotoError("Choose a JPG, PNG, WebP, or GIF image.");
      setPhotoSelection(null);
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setPhotoError("Choose an image smaller than 5 MB.");
      setPhotoSelection(null);
      return;
    }
    setPhotoError("");
    setPhotoSelection({ file, previewUrl: URL.createObjectURL(file) });
  }

  async function savePhoto() {
    if (!photoSelection) return;
    setPhotoSaving(true);
    setPhotoError("");
    try {
      const response = await userService.uploadProfileImage(photoSelection.file);
      const updated = userProfile(response);
      setProfile((current) => ({ ...current, ...updated }));
      if (updated && setUser) setUser((current) => ({ ...(current ?? user ?? {}), ...updated }));
      setPhotoSelection(null);
      success("Profile photo updated");
    } catch (error) {
      setPhotoError(error.message || "Could not upload your profile photo. Please try again.");
    } finally {
      setPhotoSaving(false);
    }
  }

  function cancelPhoto() {
    setPhotoError("");
    setPhotoSelection(null);
  }

  async function savePassword(event) {
    event.preventDefault();
    const errors = {};
    if (!password.current) errors.current = "Enter your current password.";
    if (password.next.length < 10) errors.next = "Use at least 10 characters.";
    if (password.next !== password.confirm) errors.confirm = "Passwords do not match.";
    setPasswordErrors(errors);
    if (Object.keys(errors).length) return;

    setPasswordSaving(true);
    try {
      await userService.updatePassword({ currentPassword: password.current, newPassword: password.next });
      setPassword({ current: "", next: "", confirm: "" });
      success("Password updated");
    } catch (error) {
      setPasswordErrors({ form: error.message || "Could not update your password." });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function requestEmailChange(event) {
    event.preventDefault();
    setEmailSaving(true);
    setEmailSent(false);
    try {
      await userService.requestEmailChange({ email: email.next.trim(), currentPassword: email.currentPassword });
      setEmailSent(true);
      setEmail({ next: "", currentPassword: "" });
      success("Verification sent", "Check your new inbox to confirm the address.");
    } catch (error) {
      toastError("Could not request email change", error.message);
    } finally {
      setEmailSaving(false);
    }
  }

  async function savePreferences(event) {
    event.preventDefault();
    setPreferencesSaving(true);
    try {
      await userService.updateNotificationPreferences({ notifyEmail: preferences.notifyEmail });
      success("Notification preferences saved");
    } catch (error) {
      toastError("Could not save preferences", error.message);
    } finally {
      setPreferencesSaving(false);
    }
  }

  if (!open) return null;
  const months = options?.ethiopianMonths ?? [];
  const locations = options?.locations ?? [];
  const languages = options?.languages ?? [];

  return createPortal(
    <div className="account-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="account-drawer" role="dialog" aria-modal="true" aria-labelledby="account-drawer-title" tabIndex={-1} ref={panelRef}>
        <header className="account-drawer-header">
          <div>
            <span className="account-drawer-eyebrow">Your account</span>
            <h2 id="account-drawer-title">Profile &amp; settings</h2>
            <p>{user?.name || "Member"}{profile?.email ? ` · ${profile.email}` : ""}</p>
          </div>
          <button type="button" className="account-drawer-close" onClick={onClose} aria-label="Close account drawer"><X size={19} /></button>
        </header>

        <nav className="account-drawer-tabs" aria-label="Account sections">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} type="button" className={tab === id ? "is-active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
              <Icon size={16} />{label}
            </button>
          ))}
        </nav>

        <div className="account-drawer-content">
          {loading ? <div className="account-drawer-loading" aria-label="Loading account details" /> : null}
          {loadError ? <Alert variant="danger">{loadError}</Alert> : null}

          {!loading && !loadError && tab === "profile" && profile ? (
            <form className="account-drawer-form" onSubmit={saveProfile}>
              {profileErrors.form ? <Alert variant="danger">{profileErrors.form}</Alert> : null}
              {profileSaved ? <Alert variant="success">Your profile details have been saved.</Alert> : null}
              <div className="account-drawer-photo-row">
                <ProfileAvatar
                  src={photoSelection?.previewUrl || profile.profileImageUrl || profile.avatarUrl}
                  name={profile.name}
                  alt={`${profile.name || "Member"} profile picture`}
                  imageClassName="account-drawer-avatar"
                  fallbackClassName="account-drawer-avatar account-drawer-avatar-fallback"
                />
                <div><strong>{profile.name || "Member"}</strong><small>{profile.role || "Member"}</small></div>
                <label className="account-drawer-upload">{photoSelection ? "Choose another" : "Change photo"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={photoSaving} onChange={selectPhoto} /></label>
              </div>
              {photoError ? <Alert variant="danger">{photoError}</Alert> : null}
              {photoSelection ? <div className="row" style={{ gap: "0.5rem" }}>
                <Button type="button" loading={photoSaving} onClick={savePhoto}>Save photo</Button>
                <Button type="button" variant="secondary" disabled={photoSaving} onClick={cancelPhoto}>Cancel</Button>
              </div> : null}
              <Input label="Full name" value={profile.name || ""} onChange={(event) => updateProfileField("name", event.target.value)} error={profileErrors.name} maxLength={160} required />
              <div className="account-drawer-readonly"><span>Email address</span><strong>{profile.email || "—"}</strong><small>Change your email under Security.</small></div>
              <Input label="Phone number" type="tel" value={profile.phone || ""} onChange={(event) => updateProfileField("phone", event.target.value)} error={profileErrors.phone} required />
              <div className="field">
                <label htmlFor="account-location">Location<span className="req" aria-hidden="true">*</span></label>
                <select id="account-location" className="select" value={profile.location || ""} onChange={(event) => updateProfileField("location", event.target.value)} required>
                  <option value="">Select your location</option>
                  {locations.map((location) => <option key={location} value={location}>{location}</option>)}
                </select>
                {profileErrors.location ? <span className="field-error">{profileErrors.location}</span> : null}
              </div>
              {profile.location === "Other" ? <Input label="Other location" value={profile.otherLocation || ""} onChange={(event) => updateProfileField("otherLocation", event.target.value)} error={profileErrors.otherLocation} required /> : null}
              <div className="field">
                <label>Date of birth (Ethiopian calendar)</label>
                <div className="account-drawer-birthdate">
                  <select className="select" aria-label="Birth year" value={birthDateParts.year} onChange={(event) => setBirthDateParts((current) => ({ ...current, year: event.target.value }))}>
                    <option value="">Year</option>
                    {BIRTH_YEAR_OPTIONS.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                  <select className="select" aria-label="Birth month" value={birthDateParts.month} onChange={(event) => setBirthDateParts((current) => ({ ...current, month: event.target.value }))}>
                    <option value="">Month</option>
                    {months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                  </select>
                  <select className="select" aria-label="Birth day" value={birthDateParts.day} onChange={(event) => setBirthDateParts((current) => ({ ...current, day: event.target.value }))}>
                    <option value="">Day</option>
                    {Array.from({ length: 35 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
                  </select>
                </div>
                {profileErrors.birthDateEc ? <span className="field-error">{profileErrors.birthDateEc}</span> : null}
                <small className="hint">Leave all date fields blank to keep your current birthday unchanged.</small>
              </div>
              <div className="field">
                <label htmlFor="account-language">Preferred language</label>
                <select id="account-language" className="select" value={profile.preferredLanguage || "en"} onChange={(event) => updateProfileField("preferredLanguage", event.target.value)}>
                  {languages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
                  {!languages.length ? <option value="en">English</option> : null}
                </select>
              </div>
              <Button type="submit" loading={profileSaving}>Save profile</Button>
            </form>
          ) : null}

          {!loading && !loadError && tab === "security" ? (
            <div className="account-drawer-sections">
              <form className="account-drawer-form" onSubmit={savePassword}>
                <div className="account-drawer-section-title"><KeyRound size={17} /><div><h3>Change password</h3><p>Confirm your current password to update it.</p></div></div>
                {passwordErrors.form ? <Alert variant="danger">{passwordErrors.form}</Alert> : null}
                <Input label="Current password" type="password" autoComplete="current-password" value={password.current} onChange={(event) => setPassword((current) => ({ ...current, current: event.target.value }))} error={passwordErrors.current} required />
                <Input label="New password" type="password" autoComplete="new-password" value={password.next} onChange={(event) => setPassword((current) => ({ ...current, next: event.target.value }))} error={passwordErrors.next} hint="At least 10 characters" required />
                <Input label="Confirm new password" type="password" autoComplete="new-password" value={password.confirm} onChange={(event) => setPassword((current) => ({ ...current, confirm: event.target.value }))} error={passwordErrors.confirm} required />
                <Button type="submit" loading={passwordSaving}>Update password</Button>
              </form>

              <form className="account-drawer-form account-drawer-email-form" onSubmit={requestEmailChange}>
                <div className="account-drawer-section-title"><Mail size={17} /><div><h3>Change email address</h3><p>A confirmation link will be sent to your new address.</p></div></div>
                {emailSent ? <Alert variant="success">Check your new inbox to verify the address.</Alert> : null}
                <Input label="New email address" type="email" autoComplete="email" value={email.next} onChange={(event) => setEmail((current) => ({ ...current, next: event.target.value }))} required />
                <Input label="Confirm with current password" type="password" autoComplete="current-password" value={email.currentPassword} onChange={(event) => setEmail((current) => ({ ...current, currentPassword: event.target.value }))} required />
                <Button type="submit" variant="secondary" loading={emailSaving}>Send verification</Button>
              </form>
            </div>
          ) : null}

          {!loading && !loadError && tab === "notifications" ? (
            <div className="account-drawer-sections">
              <form className="account-drawer-form" onSubmit={savePreferences}>
                <div className="account-drawer-section-title"><Bell size={17} /><div><h3>Email preferences</h3><p>Control general church updates sent to your email.</p></div></div>
                <label className="account-drawer-preference">
                  <input type="checkbox" checked={preferences.notifyEmail} onChange={(event) => setPreferences({ notifyEmail: event.target.checked })} />
                  <span>Email me about church events, announcements, and updates.</span>
                </label>
                <Button type="submit" loading={preferencesSaving}>Save preferences</Button>
              </form>
              <div className="account-drawer-form">
                <div className="account-drawer-section-title"><Shield size={17} /><div><h3>Telegram</h3><p>Link your account and manage Telegram delivery.</p></div></div>
                <TelegramIntegrationPanel compact />
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
