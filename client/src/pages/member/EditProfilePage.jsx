import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { userService, publicService, unwrap } from '../../services/api.js';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

const pad = (n) => String(n).padStart(2, '0');

export default function EditProfilePage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { success } = useToast();

  const [options, setOptions] = useState(null);
  const [form, setForm] = useState({
    name: '', phone: '', birthDay: '', birthMonth: '', birthYear: '',
    location: '', otherLocation: '', preferredLanguage: 'en',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const opts = unwrap(await publicService.registrationOptions());
        if (active) setOptions(opts);
      } catch { /* options are optional for editing */ }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    const [y, m, d] = (user.birthDateEc || '').split('-');
    setForm((f) => ({
      ...f,
      name: user.name ?? '',
      phone: user.phone ?? '',
      birthYear: y ?? '', birthMonth: m ?? '', birthDay: d ?? '',
      location: user.location ?? '',
      otherLocation: user.otherLocation ?? '',
      preferredLanguage: user.preferredLanguage ?? 'en',
    }));
  }, [user]);

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((err) => ({ ...err, [key]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const next = {};
    if (!form.name.trim() || form.name.trim().length < 2) next.name = 'Name must be at least 2 characters.';
    if (!form.phone.trim()) next.phone = 'Phone is required.';
    if (!form.location) next.location = 'Select your location.';
    if (form.location === 'Other' && !form.otherLocation.trim()) next.otherLocation = 'Please describe your location.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        location: form.location,
        otherLocation: form.location === 'Other' ? form.otherLocation.trim() : undefined,
        preferredLanguage: form.preferredLanguage,
      };
      if (form.birthYear && form.birthMonth && form.birthDay) {
        payload.birthDateEc = `${form.birthYear}-${pad(Number(form.birthMonth))}-${pad(Number(form.birthDay))}`;
      }
      const res = await userService.updateProfile(payload);
      const updated = res?.data?.data ?? res?.data?.user;
      if (updated && setUser) setUser(updated);
      success('Profile updated', 'Your details have been saved.');
      navigate('/me/profile');
    } catch (err) {
      setFormError(err?.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  const months = options?.ethiopianMonths ?? [];
  const locations = options?.locations ?? [];
  const languages = options?.languages ?? [];

  return (
    <div className="stack-lg" style={{ maxWidth: '44rem' }}>
      <div className="page-head">
        <div>
          <h1>Edit profile</h1>
          <p>Update your personal details. Email changes are handled separately in account settings.</p>
        </div>
      </div>

      {formError ? <Alert variant="danger">{formError}</Alert> : null}

      <form className="card card-pad-lg form-grid" onSubmit={handleSubmit} noValidate>
        <Input label="Full name" value={form.name} onChange={set('name')} error={errors.name} required />
        <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} required />

        <div className="field">
          <label>Date of birth (Ethiopian calendar)</label>
          <div className="dual-fields" style={{ gridTemplateColumns: '1fr 1.4fr 1fr' }}>
            <select className="select" value={form.birthYear} onChange={set('birthYear')} aria-label="Birth year">
              <option value="">Year</option>
              {Array.from({ length: 90 }, (_, i) => new Date().getFullYear() - 7 - i).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="select" value={form.birthMonth} onChange={set('birthMonth')} aria-label="Birth month">
              <option value="">Month</option>
              {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="select" value={form.birthDay} onChange={set('birthDay')} aria-label="Birth day">
              <option value="">Day</option>
              {Array.from({ length: 35 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Location</label>
          <select className="select" value={form.location} onChange={set('location')} aria-label="Location">
            <option value="">Select your location</option>
            {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
          </select>
          {errors.location ? <span className="field-error">{errors.location}</span> : null}
        </div>
        {form.location === 'Other' ? (
          <Input label="Tell us your location" value={form.otherLocation} onChange={set('otherLocation')} error={errors.otherLocation} required />
        ) : null}

        <div className="field">
          <label>Preferred language</label>
          <select className="select" value={form.preferredLanguage} onChange={set('preferredLanguage')} aria-label="Preferred language">
            {languages.map((lang) => <option key={lang.code} value={lang.code}>{lang.label}</option>)}
            {languages.length === 0 ? <option value="en">English</option> : null}
          </select>
        </div>

        <div className="row" style={{ marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.7rem' }}>
          <Button type="submit" loading={saving} iconRight={<Save size={15} />}>Save changes</Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/me/profile')} iconLeft={<ArrowLeft size={15} />}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

