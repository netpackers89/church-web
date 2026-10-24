import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  UserRound,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  ImagePlus,
  Church,
} from 'lucide-react';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Brand from '../../components/ui/Brand.jsx';
import { publicService, unwrap, userService } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const pad = (number) => String(number).padStart(2, '0');
const CURRENT_ETHIOPIAN_YEAR = Number(new Intl.DateTimeFormat('en-u-ca-ethiopic-nu-latn', {
  timeZone: 'Africa/Addis_Ababa',
  year: 'numeric',
}).formatToParts(new Date()).find(({ type }) => type === 'year')?.value);

function splitName(value) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', fatherName: parts[1] ?? '', grandfatherName: parts.slice(2).join(' ') };
}

function ethiopianDateToGregorian(year, month, day) {
  const julianDay = 1724221 + (year - 1) * 365 + Math.floor(year / 4) + (month - 1) * 30 + day - 1;
  return new Date((julianDay - 2440588) * 86400000).toISOString().slice(0, 10);
}

function ageOnDate(value) {
  if (!value) return null;
  const birth = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const today = Object.fromEntries(todayParts.map(({ type, value }) => [type, value]));
  const todayDate = `${today.year}-${today.month}-${today.day}`;
  if (value > todayDate) return null;
  let age = Number(today.year) - birth.getUTCFullYear();
  if (Number(today.month) < birth.getUTCMonth() + 1 || (Number(today.month) === birth.getUTCMonth() + 1 && Number(today.day) < birth.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

const FALLBACK_LOCATIONS = [
  'Gedera (Church Location)',
  'Tafo Adebabaye',
  'Yeka Abado Kela',
  'G7',
  '13',
  'Arcema',
  'Zoble Mikayele',
  'Ayat Tafo',
  'Lega Tafo',
  '140',
  'Other',
];

const FALLBACK_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'am', label: 'Amharic' },
  { code: 'om', label: 'Afaan Oromoo' },
  { code: 'ti', label: 'Tigrinya' },
];

const ETHIOPIAN_MONTHS = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miazia',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
];

function isEthiopianLeapYear(year) {
  return Number.isInteger(year) && (year + 1) % 4 === 0;
}

function ethiopianMonthLength(year, month) {
  if (Number(month) <= 12) return 30;
  return isEthiopianLeapYear(Number(year)) ? 6 : 5;
}

export default function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const isNewToFaith = new URLSearchParams(search).get('journey') === 'new-to-faith';

  const [options, setOptions] = useState(null);
  const [optionsError, setOptionsError] = useState(null);

  const [form, setForm] = useState(() => {
    const prefill = new URLSearchParams(search);
    const nameParts = splitName(prefill.get('name') ?? '');
    return {
      ...nameParts,
      email: prefill.get('email')?.slice(0, 320) || '',
      phone: '',
      password: '',
      confirm: '',
      birthCalendar: 'ethiopian',
      birthDay: '',
      birthMonth: '',
      birthYear: '',
      birthDateGregorian: '',
      location: '',
      otherLocation: '',
      maritalStatus: '',
      profileImageUrl: '',
      preferredLanguage: 'en',
      notifyEmail: true,
      privacyAccepted: false,
    };
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [registrationCreated, setRegistrationCreated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [telegramLink, setTelegramLink] = useState(null);
  const [telegramStatus, setTelegramStatus] = useState('NOT_CONNECTED');
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramError, setTelegramError] = useState('');
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState('');
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [imageError, setImageError] = useState('');

  useEffect(() => () => {
    if (profileImagePreview) URL.revokeObjectURL(profileImagePreview);
  }, [profileImagePreview]);

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      try {
        const result = unwrap(await publicService.registrationOptions());

        if (active) setOptions(result);
      } catch (error) {
        if (active) setOptionsError(error.message);
      }
    }

    loadOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!telegramLink || !sessionReady) return undefined;
    let active = true;
    let checking = false;
    const checkConnection = async () => {
      if (checking) return;
      if (Date.now() >= telegramLink.expiresAt) {
        setTelegramStatus('EXPIRED');
        setTelegramLink(null);
        return;
      }
      checking = true;
      try {
        const response = await userService.telegramLinkStatus(telegramLink.token);
        const status = response.data?.data?.status ?? response.data?.status;
        if (!active) return;
        if (status === 'CONNECTED') {
          setTelegramStatus('CONNECTED');
          setTelegramLink(null);
        } else if (status === 'EXPIRED') {
          setTelegramStatus('EXPIRED');
          setTelegramLink(null);
        }
      } catch {
        // A temporary status request failure should not falsely mark the link as failed.
      } finally {
        checking = false;
      }
    };
    void checkConnection();
    const timer = window.setInterval(checkConnection, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionReady, telegramLink]);

  async function createTelegramConnection() {
    setTelegramBusy(true);
    setTelegramError('');
    try {
      const response = await userService.telegramLinkToken();
      const url = response.data?.url;
      const token = response.data?.token;
      if (!url || !token) throw new Error('The church bot did not return a secure connection link.');
      setTelegramLink({ url, token, expiresAt: Date.now() + (response.data.expiresInSeconds ?? 300) * 1000 });
      setTelegramStatus('WAITING');
    } catch (failure) {
      setTelegramStatus('FAILED');
      setTelegramError(failure.message || 'Telegram could not be connected right now.');
    } finally {
      setTelegramBusy(false);
    }
  }

  async function disconnectTelegram() {
    const password = window.prompt('Enter your current church-account password to disconnect Telegram.');
    if (!password) return;
    setTelegramBusy(true);
    setTelegramError('');
    try {
      await userService.telegramUnlink(password);
      setTelegramStatus('NOT_CONNECTED');
      setTelegramLink(null);
    } catch (failure) {
      setTelegramError(failure.message || 'Telegram could not be disconnected.');
    } finally {
      setTelegramBusy(false);
    }
  }

  function set(key) {
    return (event) => {
      const value =
        event?.target?.type === 'checkbox'
          ? event.target.checked
          : event?.target
            ? event.target.value
            : event;

      setForm((previous) => {
        const next = { ...previous, [key]: value };

        if (key === 'birthCalendar') {
          next.birthDay = '';
          next.birthMonth = '';
          next.birthYear = '';
          next.birthDateGregorian = '';
        }

        if (key === 'birthMonth' || key === 'birthYear') {
          const year =
            key === 'birthYear' ? value : previous.birthYear;

          const month =
            key === 'birthMonth' ? value : previous.birthMonth;

          const maxDay = ethiopianMonthLength(year, month);

          if (Number(next.birthDay) > maxDay) {
            next.birthDay = '';
          }
        }

        return next;
      });

      setErrors((previous) => ({
        ...previous,
        [key]: undefined,
        ...(['firstName', 'fatherName', 'grandfatherName'].includes(key) ? { names: undefined } : {}),
        ...(key.startsWith('birth')
          ? { birth: undefined }
          : {}),
      }));
    };
  }

  function validate() {
    const next = {};

    if ([form.firstName, form.fatherName, form.grandfatherName].some((part) => !part.trim() || part.trim().length > 80)) {
      next.names = 'Enter your first, father, and grandfather names (80 characters or fewer each).';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = 'Enter a valid email address.';
    }

    if (!form.phone.trim()) {
      next.phone = 'Phone number is required.';
    }

    if (form.password.length < 10) {
      next.password = 'Use at least 10 characters.';
    }

    if (form.password !== form.confirm) {
      next.confirm = 'Passwords do not match.';
    }

    if (form.birthCalendar === 'ethiopian' && (!form.birthDay || !form.birthMonth || !form.birthYear)) {
      next.birth = 'Please complete your date of birth.';
    } else if (form.birthCalendar === 'gregorian' && !form.birthDateGregorian) {
      next.birth = 'Please complete your date of birth.';
    }

    if (!form.location) {
      next.location = 'Please select your location.';
    }

    if (!['Single', 'Married', 'Rather not say'].includes(form.maritalStatus)) {
      next.maritalStatus = 'Please select a marital status.';
    }

    if (form.location === 'Other' && !form.otherLocation.trim()) {
      next.otherLocation = 'Please enter your location.';
    }

    if (!form.privacyAccepted) {
      next.privacyAccepted = 'Please accept the privacy policy.';
    }

    if (form.profileImageUrl.trim()) {
      try {
        const imageUrl = new URL(form.profileImageUrl.trim());
        if (
          imageUrl.protocol !== 'https:' ||
          imageUrl.username ||
          imageUrl.password ||
          !/\.(png|jpe?g|webp|gif)$/i.test(imageUrl.pathname)
        ) throw new Error();
      } catch {
        next.profileImageUrl = 'Enter an HTTPS URL ending in .jpg, .png, .webp, or .gif.';
      }
    }

    if (profileImageFile) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(profileImageFile.type)) {
        next.profileImageUrl = 'Choose a JPG, PNG, WebP, or GIF image.';
      } else if (profileImageFile.size < 1 || profileImageFile.size > 5 * 1024 * 1024) {
        next.profileImageUrl = 'Choose an image no larger than 5 MB.';
      }
    }

    setErrors(next);

    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);

    if (!validate()) return;

    setSubmitting(true);
    let accountCreated = false;

    try {
      const payload = {
        firstName: form.firstName.trim(),
        fatherName: form.fatherName.trim(),
        grandfatherName: form.grandfatherName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
        confirmPassword: form.confirm,
        ...(form.birthCalendar === 'ethiopian'
          ? { birthDateEc: `${form.birthYear}-${pad(Number(form.birthMonth))}-${pad(Number(form.birthDay))}` }
          : { birthDateGregorian: form.birthDateGregorian }),
        location: form.location,
        maritalStatus: form.maritalStatus,
        otherLocation:
          form.location === 'Other'
            ? form.otherLocation.trim()
            : undefined,
        preferredLanguage: form.preferredLanguage,
        notifyEmail: form.notifyEmail,
        privacyAccepted: form.privacyAccepted,
        profileImageUrl: form.profileImageUrl.trim() || undefined,
      };

      await register(payload);
      accountCreated = true;
      setRegistrationCreated(true);
      await login(payload.email, payload.password);
      setSessionReady(true);

      if (profileImageFile) {
        try {
          await userService.uploadProfileImage(profileImageFile);
        } catch (failure) {
          setImageError(failure?.message || 'Your account is ready, but the profile image could not be uploaded.');
        }
      }
      return;
    } catch (error) {
      setFormError(accountCreated
        ? 'Your account was created, but sign-in could not be completed here. Sign in with your new account; it was not created a second time.'
        : error?.message || 'Registration failed. Please check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const months = options?.ethiopianMonths ?? ETHIOPIAN_MONTHS;
  const locations = options?.locations ?? FALLBACK_LOCATIONS;
  const languages = options?.languages ?? FALLBACK_LANGUAGES;

  const currentEthiopianYear = CURRENT_ETHIOPIAN_YEAR;

  const birthDays = form.birthMonth
    ? Array.from(
        {
          length: ethiopianMonthLength(
            form.birthYear,
            form.birthMonth
          ),
        },
        (_, index) => index + 1
      )
    : [];
  const birthGregorianDate = form.birthCalendar === 'gregorian'
    ? form.birthDateGregorian
    : form.birthDay && form.birthMonth && form.birthYear
      ? ethiopianDateToGregorian(Number(form.birthYear), Number(form.birthMonth), Number(form.birthDay))
      : '';
  const displayedAge = ageOnDate(birthGregorianDate);

  return (
    <main className="modern-register-page">
      <header className="modern-register-header">
        <Brand to="/" subtitle="Church Community" />

        <div className="modern-register-header-right">
          <span>Already a member?</span>
          <Link to="/login">Sign in <ArrowRight size={15} /></Link>
        </div>
      </header>

      <div className="modern-register-layout">
        <aside className="modern-register-intro">
          <div className="modern-register-intro-image" />

          <div className="modern-register-intro-content">
            <span className="modern-form-kicker">
              YOUR COMMUNITY. YOUR JOURNEY.
            </span>

            <h1>
              A place to grow
              <br />
              <span>together.</span>
            </h1>

            <p>
              Connect with your church family, explore Bible studies,
              discover upcoming programs, and be part of something meaningful.
            </p>

            <div className="modern-benefit-list">
              <div>
                <span className="modern-benefit-icon">
                  <UserRound size={18} />
                </span>
                <span>
                  <strong>Your own space</strong>
                  <small>Manage your member profile</small>
                </span>
              </div>

              <div>
                <span className="modern-benefit-icon">
                  <MapPin size={18} />
                </span>
                <span>
                  <strong>Stay connected</strong>
                  <small>Find services, events, and groups</small>
                </span>
              </div>

              <div>
                <span className="modern-benefit-icon">
                  <ShieldCheck size={18} />
                </span>
                <span>
                  <strong>Privacy matters</strong>
                  <small>Your account details stay protected</small>
                </span>
              </div>
            </div>
          </div>

          <div className="modern-register-verse">
            “For where two or three gather in my name, there am I with them.”
            <span>MATTHEW 18:20</span>
          </div>
        </aside>

        <section className="modern-register-form-panel">
          <div className="modern-register-form-inner">
            <div className="modern-form-heading">
              <span className="modern-form-kicker">CREATE YOUR ACCOUNT</span>
              <h2>{isNewToFaith ? 'Welcome — we’re glad you’re here.' : "Let's get you connected."}</h2>
              <p>
                A few details to get started. You can update your profile later.
              </p>
            </div>

            <div className="registration-progress" aria-label={`Step ${registrationCreated ? 2 : 1} of 2`}>
              <span className={!registrationCreated ? 'is-current' : 'is-complete'}>1 <span>Your information</span></span>
              <i aria-hidden="true" />
              <span className={registrationCreated ? 'is-current' : ''}>2 <span>Connect with Telegram</span></span>
            </div>

            {optionsError && (
              <div className="modern-alert">
                <Alert variant="warning">
                  Registration options could not be loaded. Default options
                  are being used.
                </Alert>
              </div>
            )}

            {isNewToFaith && (
              <div className="modern-alert">
                <Alert variant="info">
                  This is the existing member sign-up flow. If you are starting your journey of faith for the first time, use the dedicated <Link to="/new-christian">new Christian page</Link>.
                </Alert>
              </div>
            )}

            {formError && (
              <div className="modern-alert">
                <Alert variant="danger">{formError}</Alert>
              </div>
            )}

            {registrationCreated ? (
              <div className="modern-form modern-registration-complete">
                <Alert variant={formError ? 'warning' : 'success'}>{formError || 'Your member account has been created with regular member access.'}</Alert>
                <h3 className="registration-step-title">Step 2 of 2: Connect with Telegram</h3>
                {imageError ? <Alert variant="warning">{imageError}</Alert> : null}
                <section className="telegram-followup-connect" aria-labelledby="member-telegram-title">
                  <div>
                    <h3 id="member-telegram-title">Connect Telegram (optional)</h3>
                    <p className="muted">Receive your account welcome message, relevant church announcements, event reminders, and notifications. The church bot securely confirms the link; a username alone is never used to identify you.</p>
                  </div>
                  <p className="telegram-connection-state" role="status">{telegramStatus === 'CONNECTED' ? 'Connected successfully' : telegramStatus === 'WAITING' ? 'Waiting for Telegram confirmation' : telegramStatus === 'EXPIRED' ? 'Connection link expired' : telegramStatus === 'FAILED' ? 'Connection failed' : 'Not connected'}</p>
                  {telegramError ? <Alert variant="warning">{telegramError}</Alert> : null}
                  {telegramStatus === 'WAITING' && telegramLink ? <a className="btn btn-secondary" href={telegramLink.url} target="_blank" rel="noreferrer">Open church bot</a> : null}
                  {telegramStatus !== 'CONNECTED' && sessionReady && telegramStatus !== 'WAITING' ? <Button variant="secondary" loading={telegramBusy} onClick={createTelegramConnection}>{telegramStatus === 'EXPIRED' || telegramStatus === 'FAILED' ? 'Try connecting again' : 'Connect Telegram'}</Button> : null}
                  {telegramStatus === 'CONNECTED' && sessionReady ? <Button variant="secondary" loading={telegramBusy} onClick={disconnectTelegram}>Disconnect Telegram</Button> : null}
                </section>
                {sessionReady ? <Button variant="primary" size="lg" block onClick={() => navigate('/', { replace: true })}>Skip for now and continue</Button> : <Button to="/login" variant="primary" size="lg" block>Sign in to your account</Button>}
                <p className="modern-register-consent">You can skip Telegram and connect later from Account Settings.</p>
              </div>
            ) : <form className="modern-form" onSubmit={handleSubmit} noValidate>
              <div className="modern-section-heading">
                <span>01</span>
                <div>
                  <h3>Your details</h3>
                  <p>How can we identify and reach you?</p>
                </div>
              </div>

              <div className="modern-register-grid">
                <Input label="First name" autoComplete="given-name" placeholder="First name" value={form.firstName} onChange={set('firstName')} error={errors.names} required />
                <Input label="Father's name" autoComplete="additional-name" placeholder="Father's name" value={form.fatherName} onChange={set('fatherName')} required />
              </div>
              <Input label="Grandfather's name" autoComplete="family-name" placeholder="Grandfather's name" value={form.grandfatherName} onChange={set('grandfatherName')} required />

              <div className="modern-register-grid">
                <Input
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set('email')}
                  error={errors.email}
                  required
                />

                <Input
                  label="Phone number"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Your phone number"
                  value={form.phone}
                  onChange={set('phone')}
                  error={errors.phone}
                  required
                />
              </div>

              <Input
                label="Marital status"
                type="select"
                value={form.maritalStatus}
                onChange={set('maritalStatus')}
                options={[
                  { value: '', label: 'Select your marital status' },
                  { value: 'Single', label: 'Single' },
                  { value: 'Married', label: 'Married' },
                  { value: 'Rather not say', label: 'Rather not say' },
                ]}
                error={errors.maritalStatus}
                required
              />

              <div className="modern-field">
                <label>
                  Date of birth <span className="modern-required">*</span>
                </label>

                <div className="calendar-switch" role="group" aria-label="Calendar system">
                  <button type="button" aria-pressed={form.birthCalendar === 'ethiopian'} className={form.birthCalendar === 'ethiopian' ? 'is-active' : ''} onClick={() => set('birthCalendar')('ethiopian')}>Ethiopian</button>
                  <button type="button" aria-pressed={form.birthCalendar === 'gregorian'} className={form.birthCalendar === 'gregorian' ? 'is-active' : ''} onClick={() => set('birthCalendar')('gregorian')}>Gregorian</button>
                </div>

                {form.birthCalendar === 'ethiopian' ? <div className="modern-register-grid modern-birth-grid">
                  <select
                    id="register-birth-year"
                    className="modern-select"
                    value={form.birthYear}
                    onChange={set('birthYear')}
                    required
                  >
                    <option value="">Year</option>
                    {Array.from({ length: 90 }, (_, index) =>
                      currentEthiopianYear - index
                    ).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  <select
                    className="modern-select"
                    value={form.birthMonth}
                    onChange={set('birthMonth')}
                    aria-label="Birth month"
                    required
                  >
                    <option value="">Month</option>
                    {months.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </select>

                  <select
                    className="modern-select"
                    value={form.birthDay}
                    onChange={set('birthDay')}
                    aria-label="Birth day"
                    required
                  >
                    <option value="">Day</option>
                    {birthDays.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div> : <Input label="Gregorian date" type="date" value={form.birthDateGregorian} onChange={set('birthDateGregorian')} error={errors.birth} required />}

                {errors.birth && (
                  <span className="modern-field-error" role="alert">
                    {errors.birth}
                  </span>
                )}

                <span className="modern-field-hint">
                  {displayedAge === null ? 'Your age will be calculated from this date.' : `Age: ${displayedAge}`}
                </span>
              </div>

              <div className="profile-image-entry">
                <div className="profile-image-preview" role="img" aria-label="Profile image preview">
                  {(profileImagePreview || form.profileImageUrl) && !profileImageFailed ? <img src={profileImagePreview || form.profileImageUrl} alt="" referrerPolicy="no-referrer" onError={() => setProfileImageFailed(true)} /> : <Church size={24} aria-hidden="true" />}
                </div>
                <div className="profile-image-fields">
                  <label htmlFor="register-profile-image">Profile picture <span className="optional-label">Optional</span></label>
                  <div className="profile-image-actions">
                    <label className="profile-image-upload" htmlFor="register-profile-image"><ImagePlus size={16} /> Upload image</label>
                    <input id="register-profile-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0] ?? null; event.target.value = ''; setImageError(''); setProfileImageFile(file); setProfileImageFailed(false); setProfileImagePreview(file ? URL.createObjectURL(file) : ''); setForm((previous) => ({ ...previous, profileImageUrl: '' })); }} />
                    <span>or</span>
                    <input type="url" value={form.profileImageUrl} onChange={(event) => { setProfileImageFile(null); setProfileImageFailed(false); set('profileImageUrl')(event); }} placeholder="Paste HTTPS image URL" aria-label="Profile image URL" />
                  </div>
                  {(profileImagePreview || form.profileImageUrl) ? <button className="profile-image-remove" type="button" onClick={() => { setProfileImageFile(null); setProfileImagePreview(''); setProfileImageFailed(false); setForm((previous) => ({ ...previous, profileImageUrl: '' })); setErrors((previous) => ({ ...previous, profileImageUrl: undefined })); }}>Remove picture</button> : null}
                  {errors.profileImageUrl ? <span className="modern-field-error" role="alert">{errors.profileImageUrl}</span> : <span className="modern-field-hint">JPG, PNG, WebP, or GIF. Uploads are limited to 5 MB.</span>}
                </div>
              </div>

              <div className="modern-field">
                <label htmlFor="register-location">
                  Where do you live? <span className="modern-required">*</span>
                </label>

                <input
                  id="register-location"
                  className="modern-select"
                  list="register-location-options"
                  autoComplete="address-level2"
                  value={form.location}
                  onChange={set('location')}
                  placeholder="Search or choose your area"
                  required
                />
                <datalist id="register-location-options">
                  {locations.map((location) => (
                    <option key={location} value={location} />
                  ))}
                </datalist>

                {errors.location && (
                  <span className="modern-field-error" role="alert">
                    {errors.location}
                  </span>
                )}
              </div>

              {form.location === 'Other' && (
                <Input
                  label="Your location"
                  placeholder="Enter your area or neighborhood"
                  value={form.otherLocation}
                  onChange={set('otherLocation')}
                  error={errors.otherLocation}
                  required
                />
              )}

              <div className="modern-field">
                <label htmlFor="register-language">
                  Preferred language
                </label>

                <select
                  id="register-language"
                  className="modern-select"
                  value={form.preferredLanguage}
                  onChange={set('preferredLanguage')}
                >
                  {languages.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modern-section-heading modern-section-spaced">
                <span>02</span>
                <div>
                  <h3>Secure your account</h3>
                  <p>Choose a strong password you can remember.</p>
                </div>
              </div>

              <div className="modern-password-field">
                <Input
                  label="Password"
                  autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 10 characters"
                  value={form.password}
                  onChange={set('password')}
                  error={errors.password}
                  required
                />

                <button
                  type="button"
                  className="modern-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="modern-password-field">
                <Input
                  label="Confirm password"
                  autoComplete="new-password"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Enter your password again"
                  value={form.confirm}
                  onChange={set('confirm')}
                  error={errors.confirm}
                  required
                />

                <button
                  type="button"
                  className="modern-password-toggle"
                  onClick={() => setShowConfirm((value) => !value)}
                  aria-label={
                    showConfirm ? 'Hide confirmation' : 'Show confirmation'
                  }
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="modern-preferences">
                <label className="modern-check-label modern-check-card">
                  <input
                    type="checkbox"
                    checked={form.notifyEmail}
                    onChange={set('notifyEmail')}
                  />
                  <span className="modern-custom-check">
                    <CheckCircle2 size={15} />
                  </span>
                  <span>
                    <strong>Keep me in the loop</strong>
                    <small>
                      Email me church news, events, and announcements.
                    </small>
                  </span>
                </label>

                <label className="modern-check-label modern-check-card">
                  <input
                    type="checkbox"
                    checked={form.privacyAccepted}
                    onChange={set('privacyAccepted')}
                    aria-describedby={
                      errors.privacyAccepted
                        ? 'register-privacy-error'
                        : undefined
                    }
                  />
                  <span className="modern-custom-check">
                    <CheckCircle2 size={15} />
                  </span>
                  <span>
                    <strong>Privacy and account security</strong>
                    <small>
                      I confirm my details are accurate, agree to the church privacy policy, and understand essential account and service notifications may be sent.
                      <span className="modern-required"> *</span>
                    </small>
                  </span>
                </label>

                {errors.privacyAccepted && (
                  <span
                    className="modern-field-error"
                    id="register-privacy-error"
                    role="alert"
                  >
                    {errors.privacyAccepted}
                  </span>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                disabled={submitting}
                iconRight={
                  !submitting ? <ArrowRight size={18} /> : undefined
                }
              >
                {submitting ? 'Creating your account...' : 'Create my account'}
              </Button>

              <p className="modern-register-consent">
                Your account will be created with member-level access.
              </p>
            </form>}

            <p className="modern-auth-switch modern-register-switch">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>

            <Link to="/" className="modern-back-link">
              <ArrowRight size={15} className="modern-back-icon" />
              Back to website
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
