import { useState } from 'react';
import { LibraryBig } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AdminStaffRegistrationForm from './AdminStaffRegistrationForm.jsx';
import { BibleStudyGroupRegistrationForm, DepartmentRegistrationForm, OrganizationRegistrationForm } from './RegistrationForms.jsx';
import { usePermissions } from '../../hooks/usePermission.js';
import Button from '../../components/ui/Button.jsx';


const MODES = [
  { id: 'staff', label: 'Register Staff Account', permissions: ['users.create', 'roles.manage'] },
  { id: 'department', label: 'Register Department', permission: 'staff.manage' },
  { id: 'organization', label: 'Create Organization', permission: 'staff.manage' },
  { id: 'bible-study-group', label: 'Register Bible Study Group', permission: 'programs.manage' },
];

export default function AdminRegistrationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState(() => searchParams.get('type') || 'staff');
  const permissions = usePermissions();
  const availableModes = MODES.filter((item) => item.permissions ? item.permissions.every((permission) => permissions.has(permission)) : permissions.has(item.permission));
  // `group` was used by an earlier version of this page. Keep old bookmarks
  // working, but use the explicit canonical value everywhere new links are made.
  const requestedMode = (searchParams.get('type') || mode) === 'group'
    ? 'bible-study-group'
    : (searchParams.get('type') || mode);
  const activeMode = availableModes.some((item) => item.id === requestedMode) ? requestedMode : availableModes[0]?.id;

  function selectMode(nextMode) {
    setMode(nextMode);
    setSearchParams({ type: nextMode }, { replace: true });
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Registrations</h1>
          <p>Choose one registration workflow. Each action writes to the same records used across church workspaces.</p>
        </div>
        {permissions.has('programs.manage') ? <div className="page-actions">
          <Button to="/admin/program-library" variant="secondary" iconLeft={<LibraryBig size={16} />}>Create master program</Button>
        </div> : null}
      </div>

      <div className="reg-tabs" role="tablist" aria-label="Registration type">
        {availableModes.map((m) => (
          <Button
            key={m.id}
            role="tab"
            aria-selected={activeMode === m.id}
            variant={activeMode === m.id ? 'primary' : 'ghost'}
            onClick={() => selectMode(m.id)}
            style={{ flex: m.id === 'staff' ? 1.6 : 1 }}
          >
            {m.label}
          </Button>
        ))}
      </div>

      <div className="reg-body">
        {activeMode === 'staff' && <AdminStaffRegistrationForm />}

        {activeMode === 'department' && <DepartmentRegistrationForm />}

        {activeMode === 'organization' && <OrganizationRegistrationForm />}

        {activeMode === 'bible-study-group' && <BibleStudyGroupRegistrationForm />}
      </div>
    </div>
  );
}
