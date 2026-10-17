import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import { DepartmentRegistrationForm } from './RegistrationForms.jsx';
import './AdminRegistrationPage.css';

export default function AdminDepartmentRegistrationPage() {
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Register Department</h1>
          <p>Create a church department with leader, contact, category, and visibility settings.</p>
        </div>
        <Button asChild>
          <Link to="/admin/registrations">Back to registrations</Link>
        </Button>
      </div>

      <div className="reg-body"><DepartmentRegistrationForm /></div>
    </div>
  );
}
