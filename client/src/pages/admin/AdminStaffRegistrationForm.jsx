import { useState } from 'react';
import { adminService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Alert from '../../components/ui/Alert.jsx';
import { usePermissions } from '../../hooks/usePermission.js';
import ImageUploadField from '../../components/ui/ImageUploadField.jsx';
import { contentService } from '../../services/index.js';
import './AdminRegistrationPage.css';

export default function AdminStaffRegistrationForm({ onSaved }) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);

  const roles = useAsync(async () => unwrap(await adminService.roles()), []);
  const permissions = usePermissions();
  const departments = useAsync(async () => unwrap(await adminService.departments()), []);
  const bibleStudyGroups = useAsync(async () => unwrap(await adminService.bibleStudyGroups()), []);

  const roleList = (roles.data ?? [])
    .filter((role) => !role.isSystem || permissions.has('roles.manage') && !['ADMIN', 'SYSTEM_OWNER'].includes(role.code))
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
  const [accountStatus, setAccountStatus] = useState('ACTIVE');
  const [profileImageUrl, setProfileImageUrl] = useState('');

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
        accountStatus,
      };
      await adminService.registration(payload);
      showMessage('Staff account registered successfully.');
      if (onSaved) onSaved();
    } catch (err) {
      const data = err.response?.data ?? {};
      setErrors({ submit: data.error || 'Registration failed. Please correct the errors and try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="reg-form" onSubmit={handleSubmit}>
      <div className="reg-card">
        <h3 className="reg-title">Account details</h3>
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
        <Input type="select"
          label="Account status"
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'PENDING_ACTIVATION', label: 'Pending activation' },
          ]}
          value={accountStatus}
          onChange={setAccountStatus}
          placeholder="Account status"
        />
        {message && <Alert type={message === 'error' ? 'danger' : 'success'} onClose={() => setMessage(null)}>{message}</Alert>}
        <div className="reg-actions">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Registering…' : 'Register staff account'}
          </Button>
        </div>
      </div>
    </form>
  );
}
