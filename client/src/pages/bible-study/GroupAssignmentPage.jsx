import { Users, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import FeatureUnavailable from '../../components/ui/FeatureUnavailable.jsx';

/**
 * Group assignment (leaders only). The assignment API is not yet implemented on
 * the backend; this page documents the intended workflow and blocks edits until
 * the endpoint exists.
 */
export default function GroupAssignmentPage() {
  return (
    <div className="stack-lg">
      <Link to="/me/bible-study" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} /> Back to groups
      </Link>
      <div className="page-head">
        <div>
          <h1>Group assignments</h1>
          <p>Assign members to Bible study groups as a group leader.</p>
        </div>
      </div>
      <div className="card card-pad-lg">
        <div className="row" style={{ alignItems: 'flex-start', gap: '0.9rem', marginBottom: '1rem' }}>
          <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.6rem', height: '2.6rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)', flex: 'none' }}>
            <Users size={18} />
          </span>
          <div>
            <h2 className="serif" style={{ fontSize: '1.2rem' }}>How assignments will work</h2>
            <p className="muted" style={{ marginTop: '0.4rem', fontSize: '0.92rem', lineHeight: 1.7 }}>
              Leaders will be able to place members into groups, move them between groups, and
              view attendance from this screen. Assignment rules (age band, location, and capacity)
              will be applied automatically. Edits are enabled once the backend service is live.
            </p>
          </div>
        </div>
        <FeatureUnavailable feature="Group assignments" endpoint="/bible-study/assignments" />
      </div>
    </div>
  );
}
