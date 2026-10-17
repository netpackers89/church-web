import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import { BibleStudyGroupRegistrationForm } from './RegistrationForms.jsx';
import './AdminRegistrationPage.css';

export default function AdminBibleStudyGroupRegistrationPage() {
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Register Bible Study Group</h1>
          <p>Create a community Bible study group with capacity, location, schedule, and telehealth connection.</p>
        </div>
        <Button asChild>
          <Link to="/admin/registrations">Back to registrations</Link>
        </Button>
      </div>

      <div className="reg-body"><BibleStudyGroupRegistrationForm /></div>
    </div>
  );
}
