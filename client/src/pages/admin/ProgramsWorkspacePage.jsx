import { useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, Eye, Image as ImageIcon, Pencil, Plus, Repeat2, Search, Trash2 } from 'lucide-react';
import { adminService, unwrap } from '../../services/api.js';
import { contentService } from '../../services/index.js';
import { usePermissions } from '../../hooks/usePermission.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import ReliableImage from '../../components/ui/ReliableImage.jsx';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ImageUploadField from '../../components/ui/ImageUploadField.jsx';
import MoreActionsMenu from '../../components/ui/MoreActionsMenu.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

const FILTERS = [
  ['all', 'All Programs'], ['regular', 'Regular Programs'], ['event', 'Events'],
  ['special', 'Special Events'], ['revival', 'Revivals & Conferences'], ['announcement', 'Announcements'],
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const emptyForm = { title: '', description: '', category: 'EVENT', startsAt: '', endsAt: '', location: '', imageUrl: '', status: 'DRAFT', departmentId: '', recurrenceWeekday: '', recurrenceStartDate: '', recurrenceEndDate: '', notifyMembers: false, notifyAllMembers: false, featured: false, targetAudience: 'CHURCH' };

export default function ProgramsWorkspacePage() {
  const perms = usePermissions();
  const { success, error: notifyError } = useToast();
  const canPrograms = perms.has('programs.manage');
  const canEvents = perms.has('events.manage');
  const canAnnouncements = perms.has('announcements.manage');
  const canManageDepartments = perms.has('staff.manage');
  const programs = useAsync(async () => canPrograms ? unwrap(await adminService.programs()) ?? [] : [], [canPrograms]);
  const departments = useAsync(async () => canManageDepartments ? unwrap(await adminService.departments()) ?? [] : [], [canManageDepartments]);
  const events = useAsync(async () => canEvents ? unwrap(await adminService.events()) ?? [] : [], [canEvents]);
  const announcements = useAsync(async () => canAnnouncements ? (await adminService.announcements())?.data?.data ?? [] : [], [canAnnouncements]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [details, setDetails] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [promotionTarget, setPromotionTarget] = useState(null);
  const [promotion, setPromotion] = useState(null);

  const rows = useMemo(() => [
    ...(Array.isArray(programs.data) ? programs.data : []).map((item) => ({ ...item, source: 'program', kind: 'regular', title: item.name, startsAt: item.defaultStartTime ? `Every ${WEEKDAYS[item.recurrenceWeekday] ?? 'week'} · ${item.defaultStartTime.slice(0, 5)}` : 'Schedule to be set', location: item.defaultLocation, status: item.isActive === false ? 'DRAFT' : 'PUBLISHED' })),
    ...(Array.isArray(events.data) ? events.data : []).map((item) => ({ ...item, startsAt: item.startAt, source: 'event', kind: String(item.category || '').toLowerCase().includes('revival') || String(item.category || '').toLowerCase().includes('conference') ? 'revival' : String(item.category || '').toLowerCase().includes('special') ? 'special' : 'event' })),
    ...(Array.isArray(announcements.data) ? announcements.data : []).map((item) => ({ ...item, source: 'announcement', kind: 'announcement', description: item.body, startsAt: item.publishedAt || item.createdAt })),
  ], [programs.data, events.data, announcements.data]);
  const visibleRows = rows.filter((item) => (filter === 'all' || item.kind === filter) && [item.title, item.name, item.description, item.location, item.category].some((value) => String(value ?? '').toLowerCase().includes(search.toLowerCase())));
  const loading = programs.loading || events.loading || announcements.loading;
  const canCreate = canPrograms || canEvents || canAnnouncements;

  function openCreate() {
    const category = canEvents ? 'EVENT' : canPrograms ? 'REGULAR' : 'ANNOUNCEMENT';
    setEditing(null); setForm({ ...emptyForm, category }); setError(''); setModalOpen(true);
  }
  function openEdit(item) {
    setEditing(item);
    setForm({ title: item.title || item.name || '', description: item.description || item.body || '', category: item.source === 'program' ? 'REGULAR' : item.source === 'announcement' ? 'ANNOUNCEMENT' : eventCategory(item), startsAt: item.source === 'event' && item.startAt ? new Date(item.startAt).toISOString().slice(0, 16) : item.source === 'program' ? item.defaultStartTime?.slice(0, 5) || '' : '', endsAt: item.source === 'event' && item.endAt ? new Date(item.endAt).toISOString().slice(0, 16) : item.source === 'program' ? item.defaultEndTime?.slice(0, 5) || '' : '', location: item.location || item.defaultLocation || '', imageUrl: item.imageUrl || '', status: item.status || 'DRAFT', departmentId: item.departmentId ? String(item.departmentId) : '', recurrenceWeekday: item.recurrenceWeekday == null ? '' : String(item.recurrenceWeekday), recurrenceStartDate: item.recurrenceStartDate || '', recurrenceEndDate: item.recurrenceEndDate || '', notifyMembers: Boolean(item.notifyMembers), notifyAllMembers: Boolean(item.notifyAllMembers), featured: Boolean(item.featured), targetAudience: item.targetAudience || 'CHURCH' }); setError(''); setModalOpen(true);
  }
  function openDetails(item) { setDetails(item); }
  function startPromotion(item) {
    setPromotionTarget(item);
    setPromotion({
      title: item.title || item.name || '',
      date: '',
      startTime: item.defaultStartTime?.slice(0, 5) || '',
      endTime: item.defaultEndTime?.slice(0, 5) || '',
      location: item.defaultLocation || '',
      guestSpeaker: '',
      notes: item.description || '',
      imageUrl: item.imageUrl || '',
      requiresRegistration: false,
      notifyMembers: Boolean(item.notifyMembers),
      notifyAllMembers: Boolean(item.notifyAllMembers),
    });
    setError('');
  }
  function updatePromotion(field, value) {
    setPromotion((current) => ({ ...current, [field]: value }));
  }
  async function publishPromotion(event) {
    event.preventDefault();
    if (!promotion?.date || !promotion.startTime) {
      setError('Choose an event date and start time.');
      return;
    }
    if (promotion.endTime && promotion.endTime <= promotion.startTime) {
      setError('The event end time must be later than its start time.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const toChurchTime = (time) => new Date(`${promotion.date}T${time}:00+03:00`).toISOString();
      await adminService.promoteProgram(promotionTarget.id, {
        title: promotion.title,
        startsAt: toChurchTime(promotion.startTime),
        endsAt: promotion.endTime ? toChurchTime(promotion.endTime) : null,
        location: promotion.location,
        guestSpeaker: promotion.guestSpeaker,
        notes: promotion.notes,
        imageUrl: promotion.imageUrl,
        requiresRegistration: promotion.requiresRegistration,
        notifyMembers: promotion.notifyMembers,
        notifyAllMembers: promotion.notifyAllMembers,
      });
      await Promise.all([programs.reload(), events.reload()]);
      success('Event created from the recurring program.');
      setPromotionTarget(null);
    } catch (reason) {
      setError(reason.message || 'Could not create an event from this program.');
    } finally {
      setSaving(false);
    }
  }
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  const isRegular = form.category === 'REGULAR'; const isAnnouncement = form.category === 'ANNOUNCEMENT';

  async function save(status) {
    if (!form.title.trim()) { setError('Program title is required.'); return; }
    if (!isRegular && !isAnnouncement && !form.startsAt) { setError('Choose a start date and time for this event.'); return; }
    if (isRegular && form.recurrenceStartDate && form.recurrenceEndDate && form.recurrenceStartDate > form.recurrenceEndDate) { setError('The repeat end date must be on or after its start date.'); return; }
    if (isRegular && (form.recurrenceStartDate || form.recurrenceEndDate) && form.recurrenceWeekday === '') { setError('Choose a weekly repeat day before setting a repeat date range.'); return; }
    setSaving(true); setError('');
    try {
      if (isRegular) {
        const payload = { name: form.title, description: form.description, category: 'Regular Program', departmentId: form.departmentId ? Number(form.departmentId) : null, imageUrl: form.imageUrl, defaultLocation: form.location, defaultStartTime: form.startsAt, defaultEndTime: form.endsAt, recurrenceWeekday: form.recurrenceWeekday, recurrenceStartDate: form.recurrenceStartDate, recurrenceEndDate: form.recurrenceEndDate, notifyMembers: form.notifyMembers, notifyAllMembers: form.notifyAllMembers, isActive: status === 'PUBLISHED' };
        if (editing) await adminService.updateProgram(editing.id, payload); else await adminService.createProgram(payload);
        await programs.reload();
      } else if (isAnnouncement) {
        const payload = { title: form.title, body: form.description, imageUrl: form.imageUrl, status, featured: form.featured, targetAudience: form.targetAudience, deliveryChannels: form.notifyMembers ? ['WEBSITE', 'EMAIL', 'TELEGRAM'] : ['WEBSITE'] };
        if (editing) await adminService.updateAnnouncement(editing.id, payload); else await adminService.createAnnouncement(payload);
        await announcements.reload();
      } else {
        const payload = { title: form.title, description: form.description, category: categoryLabel(form.category), imageUrl: form.imageUrl, status, location: form.location, startsAt: new Date(form.startsAt).toISOString(), endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined, notifyMembers: form.notifyMembers, notifyAllMembers: form.notifyAllMembers };
        if (editing) await adminService.updateEvent(editing.id, payload); else await adminService.createEvent(payload);
        await events.reload();
      }
      success(status === 'PUBLISHED' ? 'Program published.' : 'Program saved as draft.'); setEditing(null); setModalOpen(false);
    } catch (reason) { setError(reason.message || 'Could not save the program.'); } finally { setSaving(false); }
  }

  async function togglePublished(item) {
    setArchiving(true);
    try {
      const published = item.source === 'program'
        ? !item.isActive
        : item.status !== 'PUBLISHED';
      if (item.source === 'program') {
        await adminService.updateProgram(item.id, {
          name: item.name,
          description: item.description,
          category: item.category,
          departmentId: item.departmentId,
          imageUrl: item.imageUrl,
          defaultLocation: item.defaultLocation,
          defaultStartTime: item.defaultStartTime,
          defaultEndTime: item.defaultEndTime,
          recurrenceWeekday: item.recurrenceWeekday ?? '',
          recurrenceStartDate: item.recurrenceStartDate,
          recurrenceEndDate: item.recurrenceEndDate,
          notifyMembers: item.notifyMembers,
          notifyAllMembers: item.notifyAllMembers,
          isActive: published,
        });
        await programs.reload();
      } else if (item.source === 'announcement') {
        await adminService.updateAnnouncement(item.id, {
          title: item.title,
          body: item.body,
          status: published ? 'PUBLISHED' : 'DRAFT',
          featured: item.featured,
          targetAudience: item.targetAudience,
        });
        await announcements.reload();
      } else {
        await adminService.updateEvent(item.id, {
          title: item.title,
          description: item.description,
          category: item.category,
          imageUrl: item.imageUrl,
          location: item.location,
          startsAt: item.startAt,
          endsAt: item.endAt,
          status: published ? 'PUBLISHED' : 'DRAFT',
          requiresRegistration: item.requiresRegistration,
          notifyMembers: item.notifyMembers,
          notifyAllMembers: item.notifyAllMembers,
        });
        await events.reload();
      }
      success(published ? 'Item published.' : 'Item saved as a draft.');
    } catch (reason) {
      notifyError('Publication status could not be updated.', reason.message);
    } finally {
      setArchiving(false);
    }
  }

  async function deleteEvent() {
    if (!deleteTarget) return;
    setArchiving(true);
    setArchiveError('');
    try {
      await adminService.deleteEvent(deleteTarget.id);
      await events.reload();
      success(`${deleteTarget.title} was archived.`);
      setDeleteTarget(null);
    } catch (reason) {
      setArchiveError(reason.message || 'The event could not be archived.');
    } finally {
      setArchiving(false);
    }
  }

  return <div className="stack-lg programs-workspace">
    <div className="page-head programs-page-head"><div><h1>Programs &amp; Events</h1><p>Manage church services, events, revivals, and announcements in one place.</p></div>{canCreate ? <Button onClick={openCreate} iconLeft={<Plus size={16} />}>Create Church Program &amp; Event</Button> : null}</div>
    <div className="program-toolbar"><label className="search-field"><Search size={16} /><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search programs, events, or announcements" /></label></div>
    <div className="program-filter-pills" role="tablist" aria-label="Program category">{FILTERS.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
    {loading ? <div className="program-card-grid">{[1, 2, 3].map((item) => <div className="program-card skeleton" key={item} />)}</div> : visibleRows.length ? <div className="program-card-grid">{visibleRows.map((item) => <ProgramCard item={item} key={`${item.source}-${item.id}`} onView={() => openDetails(item)} onEdit={() => openEdit(item)} onToggle={() => togglePublished(item)} onDelete={() => { setArchiveError(''); setDeleteTarget(item); }} onPromote={canEvents && canPrograms && item.source === 'program' ? () => startPromotion(item) : null} />)}</div> : <EmptyState icon={<CalendarDays size={30} />} title="No programs match this view" description={canCreate ? 'Create a program, event, or announcement to begin.' : 'No content is available with your current permissions.'} />}
    <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? 'Edit Church Program & Event' : 'Create Church Program & Event'} description="Save a draft while preparing, or publish when the details are ready." size="full">
      <div className="program-modal-body">{error ? <Alert variant="danger">{error}</Alert> : null}<section><h4>1. Basic Information</h4><div className="grid-2"><Input label="Program title" value={form.title} onChange={(event) => update('title', event.target.value)} required placeholder="Sunday Morning Worship Service" /><Input label="Category" type="select" value={form.category} disabled={Boolean(editing)} hint={editing ? 'The content type cannot change after creation.' : undefined} onChange={(event) => update('category', event.target.value)} options={[...(canEvents ? [{ value: 'EVENT', label: 'Event' }, { value: 'SPECIAL', label: 'Special Event' }, { value: 'REVIVAL', label: 'Revival / Conference' }] : []), ...(canPrograms ? [{ value: 'REGULAR', label: 'Regular Program' }] : []), ...(canAnnouncements ? [{ value: 'ANNOUNCEMENT', label: 'Announcement' }] : [])]} /></div><Input label="Description & Scripture / theme" type="textarea" rows={4} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Share the event details, sermon theme, speakers, or Bible reference." /></section>
      {!isAnnouncement ? <section><h4>2. Date & Schedule</h4><div className="grid-2"><Input label={isRegular ? 'Default start time' : 'Start date & time'} type={isRegular ? 'time' : 'datetime-local'} value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} required={!isRegular} /><Input label={isRegular ? 'Default end time' : 'End date & time'} type={isRegular ? 'time' : 'datetime-local'} value={form.endsAt} onChange={(event) => update('endsAt', event.target.value)} /></div><Input label="Location" value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="Main church hall" />{isRegular ? <>{canManageDepartments ? <Input label="Responsible department" type="select" value={form.departmentId} onChange={(event) => update('departmentId', event.target.value)} options={[{ value: '', label: 'No department assigned' }, ...(Array.isArray(departments.data) ? departments.data : []).map((department) => ({ value: String(department.id), label: department.name }))]} /> : null}<Input label="Repeats weekly" type="select" value={form.recurrenceWeekday} onChange={(event) => update('recurrenceWeekday', event.target.value)} options={[{ value: '', label: 'No recurrence selected' }, ...WEEKDAYS.map((day, index) => ({ value: String(index), label: day }))]} /><div className="grid-2"><Input label="Repeat starting on (optional)" type="date" value={form.recurrenceStartDate} onChange={(event) => update('recurrenceStartDate', event.target.value)} /><Input label="Repeat through (optional)" type="date" value={form.recurrenceEndDate} onChange={(event) => update('recurrenceEndDate', event.target.value)} /></div><p className="hint">Leave either date blank for an open-ended schedule. The calendar only shows occurrences within the configured range.</p></> : null}</section> : null}
      {isAnnouncement ? <section className="announcement-note"><h4>Announcement options</h4><p>Use announcements for church-wide notices. Create an event when members need a date, time, or location.</p></section> : null}
      <section><h4>3. Media</h4><ImageUploadField label="Thumbnail or banner" value={form.imageUrl} onChange={(value) => update('imageUrl', value)} onUpload={(file) => contentService.uploadImage(file, { mediaType: isAnnouncement ? 'ANNOUNCEMENT' : 'EVENT', title: form.title || 'Church program' })} hint="Upload JPG, PNG, or WebP, or paste a supported image URL." /></section>
      <section><h4>4. Audience & notifications</h4><label className="check-label"><input type="checkbox" checked={form.notifyMembers} onChange={(event) => update('notifyMembers', event.target.checked)} /> Notify opted-in members when published</label>{form.notifyMembers ? <label className="check-label"><input type="checkbox" checked={form.notifyAllMembers} onChange={(event) => update('notifyAllMembers', event.target.checked)} /> Send to all active members</label> : null}<p className="hint">Email and Telegram delivery follow each member’s existing notification preferences.</p></section>
      {isAnnouncement ? <section><h4>5. Display settings</h4><label className="check-label"><input type="checkbox" checked={form.featured} onChange={(event) => update('featured', event.target.checked)} /> Feature on the homepage</label><Input label="Audience" type="select" value={form.targetAudience} onChange={(event) => update('targetAudience', event.target.value)} options={[{ value: 'CHURCH', label: 'Entire congregation' }, { value: 'MEMBERS', label: 'Registered members' }, { value: 'STAFF', label: 'Staff and leadership' }]} /></section> : null}
      <div className="modal-foot program-modal-actions"><Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button><Button variant="secondary" onClick={() => save('DRAFT')} loading={saving}>Save Draft</Button><Button onClick={() => save('PUBLISHED')} loading={saving}>Publish Program</Button></div></div>
    </Modal>
    <Modal open={details !== null} onClose={() => setDetails(null)} title={details?.title || details?.name || 'Program details'} size="lg">
      {details ? <div className="stack">
        {details.imageUrl ? <ReliableImage className="group-detail-banner" src={details.imageUrl} alt={`${details.title} image`} /> : null}
        <Badge variant={details.status === 'PUBLISHED' ? 'success' : 'warning'}>{details.status || (details.isActive ? 'ACTIVE' : 'INACTIVE')}</Badge>
        <p>{details.description || 'No description has been added.'}</p>
        <dl className="group-detail-list">
          <div><dt>Type</dt><dd>{categoryLabel(details.kind || (details.source === 'program' ? 'REGULAR' : details.source === 'announcement' ? 'ANNOUNCEMENT' : eventCategory(details)))}</dd></div>
          <div><dt>When</dt><dd>{formatWhen(details)}</dd></div>
          <div><dt>Where</dt><dd>{details.location || details.defaultLocation || 'Not specified'}</dd></div>
          {details.source === 'program' ? <div><dt>Repeats</dt><dd>{details.recurrenceWeekday == null ? 'No weekly recurrence' : `Every ${WEEKDAYS[details.recurrenceWeekday] || 'week'}`}</dd></div> : null}
          {details.source === 'event' ? <div><dt>Registration</dt><dd>{details.requiresRegistration ? 'Required' : 'Not required'}</dd></div> : null}
        </dl>
        <div className="modal-foot"><Button variant="secondary" onClick={() => setDetails(null)}>Close</Button><Button onClick={() => { openEdit(details); setDetails(null); }}>Edit</Button></div>
      </div> : null}
    </Modal>
    <Modal open={promotionTarget !== null} onClose={() => !saving && setPromotionTarget(null)} title={`Create event from ${promotionTarget?.title || promotionTarget?.name || 'program'}`} size="lg">
      <form className="stack" onSubmit={publishPromotion}>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        <p className="muted">Create a dated event while preserving the recurring program and its schedule.</p>
        <Input label="Event title" value={promotion?.title || ''} onChange={(event) => updatePromotion('title', event.target.value)} required />
        <div className="grid-2">
          <Input label="Event date" type="date" value={promotion?.date || ''} onChange={(event) => updatePromotion('date', event.target.value)} required />
          <Input label="Start time" type="time" value={promotion?.startTime || ''} onChange={(event) => updatePromotion('startTime', event.target.value)} required />
          <Input label="End time" type="time" value={promotion?.endTime || ''} onChange={(event) => updatePromotion('endTime', event.target.value)} />
          <Input label="Location override" value={promotion?.location || ''} onChange={(event) => updatePromotion('location', event.target.value)} />
        </div>
        <Input label="Guest speaker" value={promotion?.guestSpeaker || ''} onChange={(event) => updatePromotion('guestSpeaker', event.target.value)} />
        <Input label="Event notes" type="textarea" value={promotion?.notes || ''} onChange={(event) => updatePromotion('notes', event.target.value)} rows={3} />
        <ImageUploadField label="Event image" value={promotion?.imageUrl || ''} onChange={(value) => updatePromotion('imageUrl', value)} onUpload={(file) => contentService.uploadImage(file, { mediaType: 'EVENT', title: promotion?.title || 'Church event' })} />
        <label className="check-label"><input type="checkbox" checked={Boolean(promotion?.requiresRegistration)} onChange={(event) => updatePromotion('requiresRegistration', event.target.checked)} /> Require member registration</label>
        <label className="check-label"><input type="checkbox" checked={Boolean(promotion?.notifyMembers)} onChange={(event) => updatePromotion('notifyMembers', event.target.checked)} /> Send configured member notifications</label>
        {promotion?.notifyMembers ? <label className="check-label"><input type="checkbox" checked={Boolean(promotion?.notifyAllMembers)} onChange={(event) => updatePromotion('notifyAllMembers', event.target.checked)} /> Notify all active members</label> : null}
        <div className="modal-foot"><Button type="button" variant="secondary" onClick={() => setPromotionTarget(null)} disabled={saving}>Cancel</Button><Button type="submit" loading={saving}>Create event</Button></div>
      </form>
    </Modal>
    <Modal open={deleteTarget !== null} onClose={() => !archiving && setDeleteTarget(null)} title="Archive this event?" description="The event will be removed from public listings. Existing registrations and financial records are preserved.">
      {archiveError ? <Alert variant="danger">{archiveError}</Alert> : null}
      <p>Are you sure you want to archive <strong>{deleteTarget?.title}</strong>?</p>
      <div className="modal-foot"><Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={archiving}>Cancel</Button><Button variant="danger" onClick={deleteEvent} loading={archiving}>Archive event</Button></div>
    </Modal>
  </div>;
}

function ProgramCard({ item, onView, onEdit, onToggle, onDelete, onPromote }) {
  const date = formatWhen(item);
  const isPublished = item.source === 'program' ? item.isActive !== false : item.status === 'PUBLISHED';
  const actions = [
    { label: 'View details', icon: <Eye size={15} />, onClick: onView },
    { label: 'Edit', icon: <Pencil size={15} />, onClick: onEdit },
    { label: isPublished ? 'Deactivate / save draft' : 'Activate / publish', icon: <Repeat2 size={15} />, onClick: onToggle },
    ...(item.source === 'event' ? [{ label: 'Archive event', icon: <Trash2 size={15} />, danger: true, onClick: onDelete }] : []),
    ...(onPromote ? [{ label: 'Create event from program', icon: <CalendarPlus size={15} />, onClick: onPromote }] : []),
  ];
  return <article className="program-card">
    <div className="program-card-image">{item.imageUrl ? <ReliableImage src={item.imageUrl} alt={`${item.title} image`} fallback={<ImageIcon size={28} />} /> : <ImageIcon size={28} />}<Badge variant={isPublished ? 'success' : 'warning'}>{item.status || (isPublished ? 'ACTIVE' : 'DRAFT')}</Badge></div>
    <div className="program-card-content">
      <div className="row-between"><span className="program-category">{categoryLabel(item.kind)}</span>{item.source === 'program' ? <Repeat2 size={15} aria-label="Recurring" /> : null}</div>
      <h2>{item.title || item.name}</h2>
      <p>{item.description || 'No description has been added.'}</p>
      <dl><div><dt>When</dt><dd>{date}</dd></div><div><dt>Where</dt><dd>{item.location || item.defaultLocation || 'Location to be confirmed'}</dd></div>{item.source === 'event' ? <div><dt>Registration</dt><dd>{item.requiresRegistration ? 'Required' : 'Not required'}</dd></div> : null}</dl>
      <div className="program-card-actions"><MoreActionsMenu actions={actions} /></div>
    </div>
  </article>;
}
function eventCategory(item) { const category = String(item.category || '').toUpperCase(); return category.includes('REVIVAL') || category.includes('CONFERENCE') ? 'REVIVAL' : category.includes('SPECIAL') ? 'SPECIAL' : 'EVENT'; }
function categoryLabel(value) { return ({ REGULAR: 'Regular Program', EVENT: 'Event', SPECIAL: 'Special Event', REVIVAL: 'Revival / Conference', ANNOUNCEMENT: 'Announcement', regular: 'Regular Program', event: 'Event', special: 'Special Event', revival: 'Revival / Conference', announcement: 'Announcement' })[value] || 'Program'; }
function formatWhen(item) { if (item.source === 'program') return item.startsAt || 'Schedule to be set'; if (!item.startsAt) return item.publishedAt ? `Published ${new Date(item.publishedAt).toLocaleDateString()}` : 'Draft'; const date = new Date(item.startsAt); return Number.isNaN(date.valueOf()) ? String(item.startsAt) : date.toLocaleString(); }
