import { useState } from 'react';
import { adminService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Alert from '../../components/ui/Alert.jsx';
import { usePermissions } from '../../hooks/usePermission.js';
import ImageUploadField from '../../components/ui/ImageUploadField.jsx';
import { contentService } from '../../services/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import './AdminRegistrationPage.css';

export default function AdminStaffRegistrationForm({ onSaved }) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);

  const roles = useAsync(async () => unwrap(await adminService.roles()), []);
  const permissions = usePermissions();
  const { user } = useAuth();
  const departments = useAsync(async () => unwrap(await adminService.departments()), []);
  const bibleStudyGroups = useAsync(async () => unwrap(await adminService.bibleStudyGroups()), []);

  const roleList = (roles.data ?? [])
    .filter((role) => role.code !== 'SYSTEM_OWNER' && (!role.isSystem || permissions.has('roles.manage') && (role.code !== 'ADMIN' || user?.role === 'ADMIN' || user?.role === 'SYSTEM_OWNER')))
    .map((role) => ({ value: role.code, label: role.name || role.code }));
  const departmentList = (departments.data ?? []).map((d) => ({ value: String(d.id), label: d.name }));
  const groupList = (bibleStudyGroups.data ?? []).map((g) => ({ value: String(g.id), label: g.name }));

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleValue, setRoleValue] = useState('STAFF');
  const [allowGroup, setAllowGroup] = useState(false);
  const [departmentId, setDepartmentId] = useState('');
  const [bibleStudyGroupId, setBibleStudyGroupId] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [activationToken, setActivationToken] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function uploadProfileImage(file) {
    const response = await contentService.uploadImage(file, { mediaType: 'PROFILE', title: name || 'Profile' });
    const url = response?.data?.data?.url || response?.data?.data?.imageUrl || '';
    if (!url) throw new Error('The upload service did not return a public URL.');
    setProfileImageUrl(url);
    return response;
  }

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 6000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activationToken) {
      const passwordBytes = new TextEncoder().encode(initialPassword).length;
      if (initialPassword.length < 10 || initialPassword.length > 128 || passwordBytes > 72) {
        setErrors({ initialPassword: 'Use a password between 10 and 128 characters (maximum 72 UTF-8 bytes).' });
        return;
      }
      if (confirmPassword !== initialPassword) {
        setErrors({ confirmPassword: 'Passwords do not match.' });
        return;
      }
      setBusy(true);
      setErrors({});
      try {
        await adminService.activateAccount({ token: activationToken, password: initialPassword });
        setActivationToken('');
        setInitialPassword('');
        setConfirmPassword('');
        let refreshed = true;
        try {
          if (onSaved) await onSaved();
        } catch {
          refreshed = false;
        }
        showMessage(refreshed
          ? 'Staff account created and activated successfully.'
          : 'Staff account activated successfully, but the list could not refresh.');
      } catch (err) {
        const data = err.response?.data ?? {};
        setErrors({ submit: data.error || 'The account was created, but activation failed. Retry setting the password.' });
      } finally {
        setBusy(false);
      }
      return;
    }

    const nextErrors = {};
    if (!name.trim()) nextErrors.name = 'Full name is required.';
    if (!email.trim()) nextErrors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email address.';
    if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) nextErrors.phone = 'Enter a valid international phone number.';
    if (!roleValue) nextErrors.role = 'Please choose a role.';
    if (allowGroup && !departmentId && !bibleStudyGroupId) nextErrors.department = 'Choose a department or Bible study group.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      const payload = {
        fullName: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        profileImageUrl: profileImageUrl || null,
        role: roleValue,
        departmentId: allowGroup ? (departmentId || null) : null,
        bibleStudyGroupId: allowGroup ? (bibleStudyGroupId || null) : null,
        accountStatus: 'PENDING_ACTIVATION',
      };
      const result = await adminService.registration(payload);
      const token = result?.data?.data?.activationToken;
      if (!token) throw new Error('The account was created, but no activation token was returned. Contact an administrator.');
      setActivationToken(token);
      setMessage(null);
    } catch (err) {
      const data = err.response?.data ?? {};
      setErrors({ submit: data.error || err.message || 'Registration failed. Please correct the errors and try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="reg-form" onSubmit={handleSubmit}>
      <div className="reg-card">
        <h3 className="reg-title">{activationToken ? 'Set initial password' : 'Account details'}</h3>
        {activationToken ? (
          <>
            <Alert variant="info">The staff account has been created but cannot sign in yet. Set its initial password to activate it.</Alert>
            <Input
              label="Initial password"
              type="password"
              value={initialPassword}
              onChange={(e) => setInitialPassword(e.target.value)}
              error={errors.initialPassword}
              autoComplete="new-password"
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
          </>
        ) : (
          <>
            <ImageUploadField
              label="Profile picture"
              value={profileImageUrl}
              onChange={setProfileImageUrl}
              onUpload={uploadProfileImage}
              hint="Optional. Upload an image or paste its URL. JPG, PNG, WebP, or GIF up to 5 MB."
            />
            {errors.profileImage ? <Alert variant="danger">{errors.profileImage}</Alert> : null}
            <div className="grid-2" style={{ gap: '1rem' }}>
              <Input label="Full name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
              <Input label="Email address" type="email" placeholder="name@church.example" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
            </div>
            <div className="grid-2" style={{ gap: '1rem' }}>
              <Input label="Phone number" type="tel" placeholder="+251912345678" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
              <Input type="select"
                label="Assigned role"
                options={roleList}
                placeholder="Select role"
                value={roleValue}
                onChange={(event) => setRoleValue(event.target.value)}
                error={errors.role}
              />
            </div>
            <div className="reg-note">
              <label className="check">
                <input type="checkbox" checked={allowGroup} onChange={(e) => setAllowGroup(e.target.checked)} />
                <span>If a role is also a department/Bible study leader, keep the group assignment below.</span>
              </label>
            </div>
            {allowGroup && (
              <div className="grid-2" style={{ gap: '1rem' }}>
                <Input type="select"
                  label="Department (optional)"
                  options={departmentList}
                  placeholder="No department"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                />
                <Input type="select"
                  label="Bible study group (optional)"
                  options={groupList}
                  placeholder="No group"
                  value={bibleStudyGroupId}
                  onChange={(event) => setBibleStudyGroupId(event.target.value)}
                />
              </div>
            )}
            <Alert variant="info">New staff accounts stay pending until you set their initial password in the next step.</Alert>
          </>
        )}
        {errors.submit ? <Alert variant="danger">{errors.submit}</Alert> : null}
        {message ? <Alert variant="success">{message}</Alert> : null}
        <div className="reg-actions">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Saving…' : activationToken ? 'Set password and activate' : 'Register staff account'}
          </Button>
        </div>
      </div>
    </form>
  );
}
