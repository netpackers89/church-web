import { useState } from 'react';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';
import CommunityLinksFields from './CommunityLinksFields.jsx';

export default function CommunityLinksManager({ groupName, links = [], onSave }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openEditor = () => {
    setDraft(Array.isArray(links) ? links.map((link) => ({ ...link })) : []);
    setError('');
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(draft);
      setOpen(false);
    } catch (failure) {
      setError(failure?.message || 'Community links could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={openEditor}>Manage community links</Button>
      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={`Community links · ${groupName}`}
        description="Only enabled links are visible to visitors."
        size="lg"
        footer={(
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} disabled={saving} onClick={save}>Save links</Button>
          </>
        )}
      >
        <CommunityLinksFields value={draft} onChange={setDraft} />
        {error ? <p className="alert alert-danger" role="alert">{error}</p> : null}
      </Modal>
    </>
  );
}
