import { Link } from 'react-router-dom';
import { User, Mail, Phone, MapPin, CalendarDays, Languages, Shield, Pencil, Bell, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { userService } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataState from '../../components/ui/DataState.jsx';
import { formatGregorian } from '../../utils/formatDate.js';

const LANGUAGE_LABELS = { en: 'English', am: 'Amharic', om: 'Afaan Oromoo', ti: 'Tigrinya' };

export default function MyProfilePage() {
  const { user } = useAuth();
  const profileQuery = useAsync(async () => {
    const res = await userService.profile();
    return res?.data?.data ?? res?.data?.user ?? res?.data ?? user;
  }, []);

  return (
    <DataState query={profileQuery} feature="Your profile" endpoint="/users/me" skeletonCount={1} isEmpty={() => false}>
      {(p) => {
        const profile = p ?? {};
        return (
          <div className="stack-lg">
            <div className="page-head">
              <div>
                <h1>My profile</h1>
                <p>Your personal details as held by the church office.</p>
              </div>
              <div className="page-actions">
                <Button to="/me/profile/edit" iconRight={<Pencil size={15} />}>Edit profile</Button>
                <Button to="/me/account" variant="secondary" iconRight={<KeyRound size={15} />}>Account settings</Button>
              </div>
            </div>

            <div className="card card-pad-lg">
              <div className="row" style={{ marginBottom: '1.2rem', gap: '1rem' }}>
                <span className="brand-mark" style={{ width: '3.4rem', height: '3.4rem', fontSize: '1.2rem' }}>
                  {(profile.name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <div>
                  <h2 className="serif" style={{ fontSize: '1.5rem' }}>{profile.name}</h2>
                  <div className="row" style={{ flexWrap: 'wrap', marginTop: '0.3rem' }}>
                    <Badge>{profile.role || 'MEMBER'}</Badge>
                    {profile.accountStatus ? <Badge variant={profile.accountStatus === 'ACTIVE' ? 'success' : 'warning'}>{profile.accountStatus}</Badge> : null}
                    <Badge variant={profile.emailVerified ? 'success' : 'neutral'}>
                      {profile.emailVerified ? 'Email verified' : 'Email unverified'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid-2">
                <ProfileRow icon={<Mail size={16} />} label="Email" value={profile.email} />
                <ProfileRow icon={<Phone size={16} />} label="Phone" value={profile.phone} />
                <ProfileRow icon={<MapPin size={16} />} label="Location" value={profile.location} hint={profile.otherLocation} />
                <ProfileRow icon={<CalendarDays size={16} />} label="Birth date" value={profile.birthDateEc ? `${profile.birthDateEc} (E.C.)` : null} hint={profile.birthDateGregorian ? formatGregorian(profile.birthDateGregorian) : null} />
                <ProfileRow icon={<Languages size={16} />} label="Preferred language" value={LANGUAGE_LABELS[profile.preferredLanguage] ?? profile.preferredLanguage} />
                <ProfileRow icon={<Shield size={16} />} label="Account status" value={profile.accountStatus} />
              </div>

              <hr className="divider" style={{ margin: '1.4rem 0' }} />

              <div className="row" style={{ flexWrap: 'wrap', gap: '0.7rem' }}>
                <Link to="/me/account" className="btn btn-secondary btn-sm"><Bell size={14} /> Notification preferences</Link>
                <Link to="/me/calendar" className="btn btn-secondary btn-sm"><CalendarDays size={14} /> Calendar &amp; reminders</Link>
              </div>
            </div>
          </div>
        );
      }}
    </DataState>
  );
}

function ProfileRow({ icon, label, value, hint }) {
  return (
    <div className="fact-row">
      <div className="fact-icon">{icon}</div>
      <div>
        <strong>{label}</strong>
        <span>{value || '—'}{hint ? <span className="muted"> · {hint}</span> : null}</span>
      </div>
    </div>
  );
}
