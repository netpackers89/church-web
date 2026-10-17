import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.jsx';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import { formatEventDate, currentGregorianDate, gregorianToEthiopian, ETHIOPIAN_MONTHS } from '../../utils/formatDate.js';

/** Ethiopian-aware month grid. Days are Gregorian dates; labels follow the user's calendar preference. */
function buildMonthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return cells;
}

export default function MyCalendarPage() {
  const { calendar, setCalendar } = useSettings();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const events = useAsync(async () => unwrap(await publicService.events()) ?? [], []);
  const eventsByDate = useMemo(() => {
    const map = new Map();
    (events.data ?? []).forEach((e) => {
      const iso = (e.startAt || e.date || '').slice(0, 10);
      if (!iso) return;
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso).push(e);
    });
    return map;
  }, [events.data]);

  const cells = useMemo(() => buildMonthGrid(cursor.y, cursor.m), [cursor]);
  const todayIso = currentGregorianDate();

  const ecCursor = gregorianToEthiopian(`${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-01`);
  const title = calendar === 'ethiopian'
    ? `${ETHIOPIAN_MONTHS[ecCursor.month - 1]} ${ecCursor.year} E.C.`
    : new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const shift = (delta) => setCursor(({ y, m }) => {
    const d = new Date(Date.UTC(y, m + delta, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>My calendar</h1>
          <p>Church events shown in {calendar === 'ethiopian' ? 'the Ethiopian calendar' : 'the Gregorian calendar'}.</p>
        </div>
        <div className="page-actions">
          <div className="chip-row">
            <button type="button" className={`chip ${calendar === 'gregorian' ? 'active' : ''}`} onClick={() => setCalendar('gregorian')}>Gregorian</button>
            <button type="button" className={`chip ${calendar === 'ethiopian' ? 'active' : ''}`} onClick={() => setCalendar('ethiopian')}>Ethiopian</button>
          </div>
        </div>
      </div>

      <div className="card card-pad-lg">
        <div className="row-between" style={{ marginBottom: '1rem' }}>
          <div className="row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <h2 className="serif" style={{ fontSize: '1.3rem' }}>{title}</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>Today</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} style={{ background: 'var(--surface-2)', padding: '0.5rem', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>{d}</div>
          ))}
          {cells.map((iso, idx) => {
            const dayEvents = iso ? eventsByDate.get(iso) ?? [] : [];
            const isToday = iso === todayIso;
            return (
              <div key={iso ?? `pad-${idx}`} style={{ background: 'var(--paper)', minHeight: '4.6rem', padding: '0.4rem', fontSize: '0.8rem', position: 'relative' }}>
                {iso ? (
                  <>
                    <span style={{ fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--blue)' : 'var(--ink)', display: 'inline-grid', placeItems: 'center', width: '1.5rem', height: '1.5rem', borderRadius: '50%', background: isToday ? 'var(--blue-soft)' : 'transparent' }}>
                      {calendar === 'ethiopian' ? gregorianToEthiopian(iso).day : Number(iso.slice(8))}
                    </span>
                    {dayEvents.slice(0, 2).map((e) => (
                      <div key={e.id ?? e.title} title={e.title} style={{ marginTop: '0.2rem', padding: '0.1rem 0.3rem', borderRadius: '0.3rem', background: 'var(--blue-soft)', color: 'var(--blue-strong)', fontSize: '0.68rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 ? <div style={{ fontSize: '0.64rem', color: 'var(--muted)', marginTop: '0.1rem' }}>+{dayEvents.length - 2} more</div> : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>

        {events.error?.endpointMissing ? (
          <p className="muted" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>The events calendar is not connected to the server yet. Events will appear here once published.</p>
        ) : null}
      </div>
    </div>
  );
}
