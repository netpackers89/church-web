import { useEffect, useState } from 'react';
import { publicService, unwrap } from '../../services/api.js';
import { useToast } from '../feedback/ToastProvider.jsx';
import Button from '../ui/Button.jsx';

const CHANNELS = [
  ['inAppEnabled', 'Website notifications', 'See new posts in your member notifications.'],
  ['emailEnabled', 'Email', 'Receive updates at the email on your account.'],
  ['telegramEnabled', 'Telegram', 'Receive updates through your linked Telegram account.'],
];

export default function NotificationPreferences({ groupId, groupType, onSave }) {
  const { success, error } = useToast();
  const [values, setValues] = useState({ inAppEnabled: true, emailEnabled: true, telegramEnabled: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    publicService.getGroupNotificationPreferences(groupId, groupType)
      .then((response) => { if (active) setValues((current) => ({ ...current, ...unwrap(response) })); })
      .catch((cause) => { if (active) error('Preferences could not be loaded', cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [groupId, groupType, error]);
  async function save(event) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await publicService.groupNotificationPreferences(groupId, groupType, values);
      setValues({ ...values, ...unwrap(response) }); success('Notification preferences saved.'); onSave?.();
    } catch (cause) { error('Preferences could not be saved', cause?.response?.data?.error || cause.message); }
    finally { setSaving(false); }
  }
  return <form className="group-notification-preferences" onSubmit={save}>
    {CHANNELS.map(([key, label, description]) => <label className="group-preference-row" key={key}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={Boolean(values[key])} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.checked }))} disabled={loading} /></label>)}
    <Button type="submit" loading={saving} disabled={loading}>Save preferences</Button>
  </form>;
}
