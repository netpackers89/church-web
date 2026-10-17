import { useState } from 'react';
import { BookOpen, CalendarPlus, LibraryBig, Pencil, Plus } from 'lucide-react';
import { adminService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Alert from '../../components/ui/Alert.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import ImageUploadField from '../../components/ui/ImageUploadField.jsx';
import { contentService } from '../../services/index.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const blankTemplate = {
  name: '', description: '', category: '', departmentId: '', imageUrl: '', defaultLocation: '',
  defaultStartTime: '', defaultEndTime: '', recurrenceWeekday: '', notifyMembers: false,
  notifyAllMembers: false,
};

function templateForm(program) {
  return {
    ...blankTemplate,
    ...program,
    departmentId: program?.departmentId ? String(program.departmentId) : '',
    recurrenceWeekday: program?.recurrenceWeekday == null ? '' : String(program.recurrenceWeekday),
    defaultStartTime: program?.defaultStartTime?.slice(0, 5) || '',
    defaultEndTime: program?.defaultEndTime?.slice(0, 5) || '',
  };
}

function eventForm(program) {
  return {
    title: program.name,
    date: '',
    startTime: program.defaultStartTime?.slice(0, 5) || '',
    endTime: program.defaultEndTime?.slice(0, 5) || '',
    location: program.defaultLocation || '',
    guestSpeaker: '',
    notes: '',
    imageUrl: program.imageUrl || '',
    requiresRegistration: false,
    notifyMembers: Boolean(program.notifyMembers),
    notifyAllMembers: Boolean(program.notifyAllMembers),
  };
}

function toEthiopianUtc(date, time) {
  return new Date(`${date}T${time}:00+03:00`).toISOString();
}

export default function ProgramLibraryPage() {
  const programs = useAsync(async () => unwrap(await adminService.programs()) ?? [], []);
  const departments = useAsync(async () => unwrap(await adminService.departments()) ?? [], []);
  const { success } = useToast();
  const [modalMode, setModalMode] = useState('');
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [template, setTemplate] = useState(blankTemplate);
  const [promotion, setPromotion] = useState(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function openTemplate(program = null) {
    setSelectedProgram(program);
    setTemplate(templateForm(program));
    setModalMode(program ? 'edit' : 'create');
    setError('');
  }

  function openPromotion(program) {
    setSelectedProgram(program);
    setPromotion(eventForm(program));
    setPreview(false);
    setModalMode('promote');
    setError('');
  }

  function closeModal() {
    if (saving) return;
    setModalMode('');
    setPreview(false);
    setError('');
  }

  function setTemplateField(field, value) {
    setTemplate((current) => ({ ...current, [field]: value }));
  }

  function setPromotionField(field, value) {
    setPromotion((current) => ({ ...current, [field]: value }));
  }

  async function saveTemplate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...template,
        departmentId: template.departmentId ? Number(template.departmentId) : null,
        recurrenceWeekday: template.recurrenceWeekday,
      };
      if (selectedProgram) await adminService.updateProgram(selectedProgram.id, payload);
      else await adminService.createProgram(payload);
      success(selectedProgram ? 'Program template updated. Existing events are unchanged.' : 'Master program saved.');
      setModalMode('');
      await programs.reload();
    } catch (failure) {
      setError(failure.message || 'Could not save the program template.');
    } finally {
      setSaving(false);
    }
  }

  function reviewPromotion(event) {
    event.preventDefault();
    setError('');
    if (!promotion.date || !promotion.startTime) {
      setError('Choose an event date and start time before reviewing.');
      return;
    }
    if (promotion.endTime && promotion.endTime <= promotion.startTime) {
      setError('The event end time must be later than its start time.');
      return;
    }
    if (Number.isNaN(new Date(`${promotion.date}T${promotion.startTime}:00+03:00`).valueOf())) {
      setError('Choose a valid event date and time.');
      return;
    }
    setPreview(true);
  }

  async function publishPromotion() {
    setSaving(true);
    setError('');
    try {
      await adminService.promoteProgram(selectedProgram.id, {
        title: promotion.title,
        startsAt: toEthiopianUtc(promotion.date, promotion.startTime),
        endsAt: promotion.endTime ? toEthiopianUtc(promotion.date, promotion.endTime) : null,
        location: promotion.location,
        guestSpeaker: promotion.guestSpeaker,
        notes: promotion.notes,
        imageUrl: promotion.imageUrl,
        requiresRegistration: promotion.requiresRegistration,
        notifyMembers: promotion.notifyMembers,
        notifyAllMembers: promotion.notifyAllMembers,
      });
      success('Event published from the master program.');
      setModalMode('');
      setPreview(false);
      await programs.reload();
    } catch (failure) {
      setError(failure.message || 'Could not publish this event.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Master Program Registry</h1>
          <p>Save common church programs once, then promote each occurrence as its own event.</p>
        </div>
        <div className="page-actions">
          <Button onClick={() => openTemplate()} iconRight={<Plus size={15} />}>Create master program</Button>
        </div>
      </div>

      <DataState
        query={programs}
        feature="Master program registry"
        endpoint="/admin/programs"
        emptyState={<EmptyState icon={<LibraryBig size={30} />} title="No master programs" description="Create a reusable program such as Sunday Fellowship or Wednesday Bible Study." action={<Button onClick={() => openTemplate()} iconRight={<Plus size={15} />}>Create the first program</Button>} />}
      >
        {(rows) => (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Program</th><th>Default details</th><th>Schedule</th><th>Published events</th><th>Actions</th></tr></thead>
              <tbody>
                {(Array.isArray(rows) ? rows : []).map((program) => (
                  <tr key={program.id}>
                    <td><strong>{program.name}</strong><div className="muted">{program.category || 'Church program'}{program.departmentName ? ` · ${program.departmentName}` : ''}</div></td>
                    <td className="muted">{program.defaultLocation || 'Location flexible'}{program.defaultStartTime ? ` · ${program.defaultStartTime.slice(0, 5)}` : ''}</td>
                    <td>{program.recurrenceWeekday == null ? <Badge>As needed</Badge> : <Badge variant="success">Weekly · {WEEKDAYS[program.recurrenceWeekday]}</Badge>}</td>
                    <td className="muted">{program.promotedEventCount ?? 0}</td>
                    <td><div className="program-row-actions">
                      <Button size="sm" variant="primary" onClick={() => openPromotion(program)} iconLeft={<CalendarPlus size={14} />}>Promote</Button>
                      <Button size="sm" variant="ghost" onClick={() => openTemplate(program)} aria-label={`Edit ${program.name}`} iconLeft={<Pencil size={14} />}>Edit template</Button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      <Modal open={modalMode === 'create' || modalMode === 'edit'} onClose={closeModal} title={modalMode === 'edit' ? 'Edit master program' : 'Create master program'} description="Template changes apply to future promotions only; published events keep their own details." size="lg">
        <form className="stack" onSubmit={saveTemplate}>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <div className="grid-2">
            <Input label="Program name" value={template.name} onChange={(event) => setTemplateField('name', event.target.value)} placeholder="Sunday Fellowship" required maxLength={160} />
            <Input label="Category" value={template.category} onChange={(event) => setTemplateField('category', event.target.value)} placeholder="Worship, Bible study, youth" />
          </div>
          <Input type="textarea" label="Description" value={template.description} onChange={(event) => setTemplateField('description', event.target.value)} rows={3} />
          <div className="grid-2">
            <Input label="Default location" value={template.defaultLocation} onChange={(event) => setTemplateField('defaultLocation', event.target.value)} placeholder="Main church hall" />
            <ImageUploadField
              label="Default program image"
              value={template.imageUrl}
              onChange={(value) => setTemplateField('imageUrl', value)}
              onUpload={(file) => contentService.uploadImage(file, { mediaType: 'EVENT', title: template.name || 'Program image' })}
              hint="Optional. Upload an image or paste its public URL."
            />
          </div>
          <Input type="select" label="Responsible department" value={template.departmentId} onChange={(event) => setTemplateField('departmentId', event.target.value)} options={[{ value: '', label: 'No department assigned' }, ...(Array.isArray(departments.data) ? departments.data : []).map((department) => ({ value: String(department.id), label: department.name }))]} />
          <div className="grid-3">
            <Input label="Default start" type="time" value={template.defaultStartTime} onChange={(event) => setTemplateField('defaultStartTime', event.target.value)} />
            <Input label="Default end" type="time" value={template.defaultEndTime} onChange={(event) => setTemplateField('defaultEndTime', event.target.value)} />
            <Input type="select" label="Repeats weekly" value={template.recurrenceWeekday} onChange={(event) => setTemplateField('recurrenceWeekday', event.target.value)} options={[{ value: '', label: 'No weekly recurrence' }, ...WEEKDAYS.map((day, index) => ({ value: String(index), label: day }))]} />
          </div>
          <label className="check-label"><input type="checkbox" checked={template.notifyMembers} onChange={(event) => setTemplateField('notifyMembers', event.target.checked)} /> Notify opted-in members when a promoted event is published</label>
          {template.notifyMembers ? <label className="check-label"><input type="checkbox" checked={template.notifyAllMembers} onChange={(event) => setTemplateField('notifyAllMembers', event.target.checked)} /> All active members (otherwise use the program department)</label> : null}
          <div className="modal-foot"><Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button><Button type="submit" loading={saving}>{modalMode === 'edit' ? 'Save template' : 'Save master program'}</Button></div>
        </form>
      </Modal>

      <Modal open={modalMode === 'promote'} onClose={closeModal} title={preview ? 'Review event before publishing' : `Promote ${selectedProgram?.name || 'program'}`} description={preview ? 'This creates a separate published event. The master program and previous events will not change.' : 'Defaults come from the master program. Adjust only what is different for this occurrence.'} size="lg">
        {!preview && promotion ? <form className="stack" onSubmit={reviewPromotion}>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Input label="Event title" value={promotion.title} onChange={(event) => setPromotionField('title', event.target.value)} required />
          <div className="grid-3">
            <Input label="Event date" type="date" value={promotion.date} onChange={(event) => setPromotionField('date', event.target.value)} required />
            <Input label="Start time" type="time" value={promotion.startTime} onChange={(event) => setPromotionField('startTime', event.target.value)} required />
            <Input label="End time" type="time" value={promotion.endTime} onChange={(event) => setPromotionField('endTime', event.target.value)} />
          </div>
          <div className="grid-2">
            <Input label="Location override" value={promotion.location} onChange={(event) => setPromotionField('location', event.target.value)} />
            <Input label="Guest speaker" value={promotion.guestSpeaker} onChange={(event) => setPromotionField('guestSpeaker', event.target.value)} />
          </div>
          <Input type="textarea" label="Event notes" value={promotion.notes} onChange={(event) => setPromotionField('notes', event.target.value)} rows={3} />
          <ImageUploadField
            label="Event image"
            value={promotion.imageUrl}
            onChange={(value) => setPromotionField('imageUrl', value)}
            onUpload={(file) => contentService.uploadImage(file, { mediaType: 'EVENT', title: promotion.title || 'Event image' })}
            hint="Optional. Upload an image or paste its public URL."
          />
          <label className="check-label"><input type="checkbox" checked={promotion.requiresRegistration} onChange={(event) => setPromotionField('requiresRegistration', event.target.checked)} /> Require member registration</label>
          <label className="check-label"><input type="checkbox" checked={promotion.notifyMembers} onChange={(event) => setPromotionField('notifyMembers', event.target.checked)} /> Send configured member notifications</label>
          {promotion.notifyMembers ? <label className="check-label"><input type="checkbox" checked={promotion.notifyAllMembers} onChange={(event) => setPromotionField('notifyAllMembers', event.target.checked)} /> Notify all active members instead of the program department</label> : null}
          <div className="modal-foot"><Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button><Button type="submit" iconLeft={<BookOpen size={15} />}>Preview event</Button></div>
        </form> : null}
        {preview && promotion ? <div className="stack">
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <div className="program-event-preview">
            <span className="eyebrow">PUBLISH PREVIEW</span>
            <h3>{promotion.title}</h3>
            <p>{promotion.date} · {promotion.startTime}{promotion.endTime ? `–${promotion.endTime}` : ''}</p>
            <p>{promotion.location || 'Location to be confirmed'}{promotion.guestSpeaker ? ` · Guest speaker: ${promotion.guestSpeaker}` : ''}</p>
            {promotion.notes ? <p>{promotion.notes}</p> : null}
            <Badge variant="success">Will publish to the public events calendar</Badge>
            <p className="muted">Notifications: {promotion.notifyMembers ? promotion.notifyAllMembers ? 'all opted-in active members' : 'the program department' : 'off'}</p>
          </div>
          <div className="modal-foot"><Button variant="secondary" onClick={() => setPreview(false)} disabled={saving}>Back to edit</Button><Button onClick={publishPromotion} loading={saving}>Publish event</Button></div>
        </div> : null}
      </Modal>
    </div>
  );
}
