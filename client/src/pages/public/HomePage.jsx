import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Cross,
  Heart,
  Landmark,
  MapPin,
  Smartphone,
  Users,
} from 'lucide-react';
import HeroBanner from '../../components/banners/HeroBanner.jsx';
import ChurchLoader from '../../components/animations/ChurchLoader.jsx';
import Button from '../../components/ui/Button.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import useAsync from '../../hooks/useAsync.js';
import { publicService, unwrap } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import { siteConfig } from '../../utils/siteConfig.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FALLBACK_DEPARTMENT_IMAGES = [
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=900&q=80',
];

function getList(response) {
  const value = unwrap(response);
  return Array.isArray(value) ? value : [];
}

function formatTime(value, timezone) {
  if (!value) return '';
  const time = /^(\d{1,2}):(\d{2})/.exec(value);
  if (time) {
    const hour = Number(time[1]);
    return `${hour % 12 || 12}:${time[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date);
}

function formatWeekday(date, timezone) {
  if (!date || Number.isNaN(new Date(date).getTime())) return '';
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    timeZone: timezone || siteConfig.timezone,
  }).format(new Date(date));
}

function utcCalendarDate(date) {
  return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeCalendarText(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function calendarDurationMinutes(startTime, endTime) {
  const start = /^(\d{1,2}):(\d{2})/.exec(startTime || '');
  const end = /^(\d{1,2}):(\d{2})/.exec(endTime || '');
  if (!start || !end) return null;
  const startMinutes = Number(start[1]) * 60 + Number(start[2]);
  let endMinutes = Number(end[1]) * 60 + Number(end[2]);
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return endMinutes - startMinutes;
}

function downloadCalendarEvent(schedule, timezone) {
  const start = new Date(schedule.nextAt);
  if (Number.isNaN(start.getTime())) return;
  const duration = calendarDurationMinutes(schedule.startTime, schedule.endTime);
  const end = duration ? new Date(start.getTime() + duration * 60_000) : null;
  const uid = `church-program-${schedule.id}-${start.getTime()}@${window.location.hostname}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Church Website//Weekly Programs//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeCalendarText(uid)}`,
    `DTSTAMP:${utcCalendarDate(new Date())}`,
    `DTSTART:${utcCalendarDate(start)}`,
    ...(end ? [`DTEND:${utcCalendarDate(end)}`] : []),
    `SUMMARY:${escapeCalendarText(schedule.name)}`,
    ...(schedule.locationName || schedule.locationText
      ? [`LOCATION:${escapeCalendarText(schedule.locationName || schedule.locationText)}`]
      : []),
    ...(schedule.description ? [`DESCRIPTION:${escapeCalendarText(schedule.description)}`] : []),
    `X-WR-TIMEZONE:${escapeCalendarText(schedule.timezone || timezone || siteConfig.timezone)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(schedule.name || 'church-program').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function useHomepageData() {
  const schedules = useAsync(async () => {
    const response = await publicService.programSchedules();
    return { items: getList(response), timezone: response.data?.timezone || siteConfig.timezone };
  }, []);
  const gathering = useAsync(async () => {
    const response = await publicService.nextGathering();
    const data = unwrap(response);
    return data ? { ...data, timezone: response.data?.timezone || siteConfig.timezone } : null;
  }, []);
  const events = useAsync(async () => getList(await publicService.upcomingEvents({ limit: 50 })), []);
  const giving = useAsync(async () => unwrap(await publicService.bankAccount()), []);
  const departments = useAsync(async () => getList(await publicService.groups()), []);
  const announcements = useAsync(async () => getList(await publicService.announcements()), []);
  const reloadGathering = gathering.reload;
  const banners = useAsync(async () => {
    const media = getList(await publicService.banners());
    return media.map((item) => item.mediaUrl || item.imageUrl || '').filter(Boolean);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => reloadGathering(), 60_000);
    return () => window.clearInterval(timer);
  }, [reloadGathering]);

  return { schedules, gathering, events, giving, departments, announcements, banners };
}

export default function HomePage() {
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const data = useHomepageData();
  const reveal = useMemo(() => (prefersReducedMotion
    ? { initial: false, whileInView: undefined }
    : {
      initial: { opacity: 0, y: 24 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, amount: 0.12 },
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    }), [prefersReducedMotion]);
  const heroImages = data.banners.data;
  const schedules = data.schedules.data?.items || [];
  const events = data.events.data || [];
  const regularEvents = events.filter((event) => event.programType === 'RECURRING');
  const nearestRegularSchedule = schedules
    .filter((schedule) => schedule.nextAt && !Number.isNaN(new Date(schedule.nextAt).getTime()))
    .sort((left, right) => new Date(left.nextAt) - new Date(right.nextAt))[0];
  const nextProgramBySchedule = new Map();
  regularEvents.forEach((event) => {
    const scheduleId = /^program-(\d+)-/.exec(String(event.id))?.[1];
    if (scheduleId && !nextProgramBySchedule.has(scheduleId)) nextProgramBySchedule.set(scheduleId, event);
  });
  const nextProgram = data.gathering.data;
  const promotions = selectPromotions(events, data.announcements.data || [], schedules);
  const featuredDepartments = (data.departments.data || [])
    .filter((department) => department.type === 'department')
    .sort((left, right) => Number(right.memberCount || 0) - Number(left.memberCount || 0))
    .slice(0, 3);

  return (
    <div className="home-experience">
      <HeroBanner
        images={heroImages}
        nextService={nextProgram}
        onGatheringEnded={data.gathering.reload}
        primaryCta={<Button to="/about#visit" variant="gold" size="lg">Plan Your Visit</Button>}
        secondaryCta={<Button to="/sermons" variant="light" size="lg" iconRight={ArrowRight}>Watch a Message</Button>}
      />

      <motion.section className="home-giving home-section" {...reveal}>
        <div className="home-container home-giving-layout">
          <div className="home-section-intro">
            <span className="home-eyebrow">Generosity with purpose</span>
            <h2>Give with a grateful heart.</h2>
            <p>Your generosity helps us share the Gospel, strengthen our community, and care for those in need.</p>
            <p className="home-trust-note"><Heart size={17} aria-hidden="true" /> Every gift supports the life and mission of our church.</p>
          </div>
          <div className="home-giving-content">
            {data.giving.loading ? (
              <ChurchLoader inline message="Loading giving options…" />
            ) : data.giving.error ? (
              <ErrorMessage error={data.giving.error} onRetry={data.giving.reload} title="Giving options are temporarily unavailable" />
            ) : (
              <GivingAccounts methods={getPaymentMethods(data.giving.data)} />
            )}
            <Button to="/give" variant="gold" size="lg" iconRight={ArrowRight}>View All Giving Options</Button>
          </div>
        </div>
      </motion.section>

      <motion.section className="home-programs home-section" {...reveal}>
        <div className="home-container">
          <SectionHeading
            eyebrow="Worship, prayer, learning, and fellowship"
            title="Join us every week."
            text="There is a place for you in our weekly worship, prayer, learning, and fellowship."
            link="/programs"
            linkText="View all programs"
          />
          {data.schedules.loading ? (
            <ChurchLoader inline message="Loading the church schedule…" />
          ) : data.schedules.error ? (
            <ErrorMessage error={data.schedules.error} onRetry={data.schedules.reload} title="The program schedule could not be loaded" />
          ) : schedules.length ? (
            <div className="home-program-grid">
              {schedules.map((schedule) => (
                <ProgramCard
                  key={schedule.id}
                  schedule={schedule}
                  timezone={data.schedules.data.timezone}
                  occurrence={nextProgramBySchedule.get(String(schedule.id))}
                  highlighted={String(schedule.id) === String(nearestRegularSchedule?.id)}
                />
              ))}
            </div>
          ) : (
            <div className="home-empty-state">
              <CalendarDays size={22} aria-hidden="true" />
              <p>No regular programs have been published yet. Please visit our programs page for updates.</p>
            </div>
          )}
        </div>
      </motion.section>

      <motion.section className="home-promotion home-section" {...reveal}>
        <FeaturedPromotion promotions={promotions} />
      </motion.section>

      <motion.section className="home-faith-invitation home-section" {...reveal}>
        <div className="home-container home-faith-content">
          <span className="home-cross-mark" aria-hidden="true"><Cross size={26} /></span>
          <span className="home-eyebrow">A new beginning</span>
          <h2>Have you given your life to Jesus?</h2>
          <p>Every new beginning starts with a step of faith. If you are ready to follow Jesus, our church family is here to pray with you, encourage you, and walk alongside you as you grow in faith.</p>
          <p className="home-scripture">“For God so loved the world…” <span>John 3:16</span></p>
          <Button to="/new-christian" variant="gold" size="lg">
            <span className="home-accept-desktop">Yes, I Accept Jesus as My Lord and Savior</span>
            <span className="home-accept-mobile">Yes, I Accept</span>
          </Button>
          <small>It takes less than 2 minutes. Someone from our team will reach out to you.</small>
        </div>
      </motion.section>

      <motion.section className="home-departments home-section" {...reveal}>
        <div className="home-container">
          <SectionHeading
            eyebrow="Find your people"
            title="Find your place to serve and belong."
            text="Discover a community that shares your gifts, strengthens your faith, and helps you grow."
            link="/community"
            linkText="See all departments"
          />
          {data.departments.loading ? (
            <ChurchLoader inline message="Loading public departments…" />
          ) : data.departments.error ? (
            <ErrorMessage error={data.departments.error} onRetry={data.departments.reload} title="Departments could not be loaded" />
          ) : featuredDepartments.length ? (
            <div className="home-department-grid">
              {featuredDepartments.map((department, index) => (
                <DepartmentCard key={department.id} department={department} image={department.bannerUrl || department.logoUrl || FALLBACK_DEPARTMENT_IMAGES[index % FALLBACK_DEPARTMENT_IMAGES.length]} />
              ))}
            </div>
          ) : (
            <div className="home-empty-state">
              <Users size={22} aria-hidden="true" />
              <p>There are no public departments to feature right now. You can still explore our community groups.</p>
              <Link to="/community" className="home-inline-link">Explore community groups <ArrowRight size={16} /></Link>
            </div>
          )}
        </div>
      </motion.section>

      <motion.section className="home-visit home-section" {...reveal}>
        <div className="home-container home-visit-layout">
          <div>
            <span className="home-eyebrow">You are welcome here</span>
            <h2>There is a place for you.</h2>
            <p>Whether you are exploring faith or looking for a church to call home, come as you are. We would love to meet you.</p>
            <div className="home-visit-actions">
              <Button to="/about#visit" variant="primary" size="lg">Plan Your Visit</Button>
              <Link className="home-inline-link" to="/contact">Get in touch <ArrowRight size={16} /></Link>
            </div>
            {siteConfig.address ? <p className="home-address"><MapPin size={17} aria-hidden="true" />{siteConfig.address}</p> : null}
          </div>
          <div className="home-visit-card">
            <div><Cross size={19} aria-hidden="true" /><span>Worship together</span></div>
            <div><BookOpen size={19} aria-hidden="true" /><span>Grow deeper in faith</span></div>
            <div><Users size={19} aria-hidden="true" /><span>Find a community</span></div>
          </div>
        </div>
      </motion.section>

      {user ? <p className="sr-only" aria-live="polite">Welcome back, {user.name?.split(/\s+/)[0] || 'friend'}.</p> : null}
    </div>
  );
}

function SectionHeading({ eyebrow, title, text, link, linkText }) {
  return (
    <div className="home-section-heading">
      <div>
        <span className="home-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {text ? <p>{text}</p> : null}
      </div>
      {link ? <Link className="home-inline-link" to={link}>{linkText}<ArrowRight size={16} /></Link> : null}
    </div>
  );
}

function ProgramCard({ schedule, timezone, occurrence, highlighted }) {
  const nextAt = schedule.nextAt || occurrence?.startAt;
  const activeTimezone = schedule.timezone || occurrence?.timezone || timezone || siteConfig.timezone;
  const image = occurrence?.imageUrl || schedule.imageUrl;
  const startTime = schedule.startTime
    ? formatTime(schedule.startTime, activeTimezone)
    : occurrence?.startAt
      ? formatTime(occurrence.startAt, activeTimezone)
      : '';
  const endTime = schedule.endTime ? formatTime(schedule.endTime, activeTimezone) : '';

  return (
    <article className={`home-program-card${highlighted ? ' is-next' : ''}`}>
      {image ? (
        <div className="home-program-image"><img src={image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} /></div>
      ) : <div className="home-program-image home-program-image-fallback" aria-hidden="true"><Cross size={25} /></div>}
      <div className="home-program-body">
        {highlighted ? <span className="home-next-badge"><span /> Next up</span> : null}
        <span className="home-program-day">{formatWeekday(nextAt, activeTimezone) || DAYS[schedule.weekday] || 'Weekly gathering'}</span>
        <h3>{schedule.name}</h3>
        <p className="home-program-time"><Clock3 size={16} aria-hidden="true" />{startTime ? `${formatTime(startTime, activeTimezone)}${endTime ? ` – ${endTime}` : ''}` : 'Time to be announced'}</p>
        {schedule.locationName || schedule.locationText ? (
          <p className="home-program-location"><MapPin size={16} aria-hidden="true" />{schedule.locationName || schedule.locationText}</p>
        ) : null}
        <div className="home-program-actions">
          <Link to="/programs" className="home-program-link">Program details <ArrowRight size={15} /></Link>
          {nextAt ? (
            <button type="button" className="home-calendar-button" onClick={() => downloadCalendarEvent({ ...schedule, nextAt }, activeTimezone)}>
              <CalendarDays size={15} aria-hidden="true" /> Add to Calendar
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function getPaymentMethods(data) {
  if (Array.isArray(data?.methods)) return data.methods.filter((method) => method.accountNumber || method.phoneNumber).slice(0, 3);
  if (data?.bankName && data?.accountNumber) {
    return [{
      id: 'legacy-bank-account',
      name: data.bankName,
      type: 'BANK',
      accountHolder: data.accountHolder,
      accountNumber: data.accountNumber,
      branch: data.bankBranch,
    }];
  }
  return [];
}

function GivingAccounts({ methods }) {
  if (!methods.length) {
    return (
      <div className="home-giving-empty">
        <Landmark size={24} aria-hidden="true" />
        <p>Giving account details are not available right now. Please visit the giving page for current options.</p>
      </div>
    );
  }
  return (
    <div className="home-giving-cards">
      {methods.map((method, index) => <GivingAccountCard key={method.id || method.accountNumber} method={method} index={index} />)}
    </div>
  );
}

function GivingAccountCard({ method, index }) {
  const [copied, setCopied] = useState(false);
  const { success, error } = useToast();
  const number = method.accountNumber || method.phoneNumber;

  async function copyAccount() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(number);
      } else {
        copyWithLegacyApi(number);
      }
      setCopied(true);
      success('Account number copied.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      error('Could not copy the account number', copyError.message || 'Please select and copy it manually.');
    }
  }

  return (
    <article className={`home-giving-card tone-${index + 1}`}>
      <div className="home-giving-card-top">
        <span className="home-provider-icon" aria-hidden="true">{method.type === 'TELEBIRR' ? <Smartphone size={20} /> : <Landmark size={20} />}</span>
        <span className="home-provider-type">{method.type === 'TELEBIRR' ? 'Mobile wallet' : 'Bank transfer'}</span>
      </div>
      <h3>{method.name}</h3>
      {method.accountHolder ? <p className="home-account-holder">{method.accountHolder}</p> : null}
      <div className="home-account-number">
        <span>{method.phoneNumber ? 'Phone number' : 'Account number'}</span>
        <strong>{number}</strong>
      </div>
      <button type="button" className={`home-copy-button${copied ? ' is-copied' : ''}`} onClick={copyAccount} aria-label={`Copy ${method.phoneNumber ? 'phone' : 'account'} number for ${method.name}`}>
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copied ? 'Copied!' : 'Copy number'}
      </button>
      <span className="sr-only" aria-live="polite">{copied ? 'Account number copied.' : ''}</span>
    </article>
  );
}

function copyWithLegacyApi(value) {
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('Clipboard access is unavailable in this browser.');
}

function selectPromotions(events, announcements, schedules) {
  const now = Date.now();
  const eligibleEvents = events
    .filter((event) => {
      const start = new Date(event.startAt).getTime();
      const end = event.endAt
        ? new Date(event.endAt).getTime()
        : start + 2 * 60 * 60 * 1000;
      return event.programType !== 'RECURRING'
        && event.status !== 'CANCELLED'
        && Number.isFinite(start)
        && end > now;
    })
    .map((event) => {
      const timezone = event.timezone || siteConfig.timezone;
      const start = new Date(event.startAt);
      return {
        kind: 'event',
        featured: event.featured === true || event.isFeatured === true,
        sortAt: start.getTime(),
        label: event.category || 'Upcoming event',
        title: event.title,
        description: event.description,
        image: event.imageUrl,
        date: start.getTime() > now
          ? new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(start)
          : 'Happening now',
        countdownStart: start.getTime() > now ? event.startAt : null,
        location: event.location,
        to: `/events/${event.id}`,
        registerTo: event.requiresRegistration ? `/events/${event.id}` : null,
        action: 'Learn more',
      };
    });
  const eligibleAnnouncements = announcements.map((announcement) => ({
    kind: 'announcement',
    featured: announcement.featured === true || announcement.isFeatured === true,
    sortAt: announcement.publishedAt ? new Date(announcement.publishedAt).getTime() : 0,
    label: 'Church announcement',
    title: announcement.title,
    description: announcement.body,
    image: announcement.imageUrl,
    to: '/programs',
    action: 'Explore what’s happening',
  }));
  const candidates = [...eligibleEvents, ...eligibleAnnouncements]
    .sort((left, right) => Number(right.featured) - Number(left.featured)
      || (left.kind === right.kind
        ? left.kind === 'event' ? left.sortAt - right.sortAt : right.sortAt - left.sortAt
        : left.kind === 'event' ? -1 : 1))
    .slice(0, 3);
  if (candidates.length) return candidates;

  const nextSchedule = schedules.find((schedule) => schedule.nextAt);
  if (nextSchedule) {
    return [{
      kind: 'program',
      label: 'Weekly gathering',
      title: nextSchedule.name,
      description: 'Gather with us for worship, prayer, and fellowship.',
      image: nextSchedule.imageUrl,
      date: `${formatWeekday(nextSchedule.nextAt, nextSchedule.timezone || siteConfig.timezone)} · ${formatTime(nextSchedule.nextAt, nextSchedule.timezone || siteConfig.timezone)}`,
      location: nextSchedule.locationName || nextSchedule.locationText,
      to: '/programs',
      action: 'View programs',
    }];
  }
  return [{
    kind: 'invitation',
    label: 'You are invited',
    title: 'There is a place for you here.',
    description: 'Find a welcoming church community for worship, growth, and belonging.',
    to: '/about#visit',
    action: 'Plan your visit',
  }];
}

function FeaturedPromotion({ promotions }) {
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = promotions[activeIndex % promotions.length];

  useEffect(() => {
    if (prefersReducedMotion || paused || promotions.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % promotions.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [paused, prefersReducedMotion, promotions.length]);

  return (
    <>
      <div className="home-promotion-image" style={active.image ? { backgroundImage: `url("${active.image}")` } : undefined} aria-hidden="true" />
      <div className="home-promotion-shade" aria-hidden="true" />
      <motion.div
        key={activeIndex}
        className="home-container home-promotion-content"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : .35 }}
      >
        <span className="home-eyebrow">{active.label}</span>
        <h2>{active.title}</h2>
        {active.description ? <p>{active.description}</p> : null}
        {active.date ? <p className="home-promotion-meta"><CalendarDays size={17} aria-hidden="true" />{active.date}</p> : null}
        {active.location ? <p className="home-promotion-meta"><MapPin size={17} aria-hidden="true" />{active.location}</p> : null}
        {active.countdownStart ? <PromotionCountdown startAt={active.countdownStart} /> : null}
        <div className="home-promotion-actions">
          <Button to={active.to} variant="gold" size="lg" iconRight={ArrowRight}>{active.action}</Button>
          {active.registerTo ? <Button to={active.registerTo} variant="light" size="lg">Register</Button> : null}
        </div>
        {promotions.length > 1 ? (
          <div className="home-promotion-indicators" aria-label="Featured announcements and events">
            {promotions.map((promotion, index) => (
              <button
                key={`${promotion.kind}-${promotion.title}`}
                type="button"
                aria-label={`Show promotion ${index + 1}: ${promotion.title}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                className={index === activeIndex ? 'is-active' : ''}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        ) : null}
      </motion.div>
    </>
  );
}

function PromotionCountdown({ startAt }) {
  const [now, setNow] = useState(() => Date.now());
  const start = new Date(startAt).getTime();
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!Number.isFinite(start) || now >= start) {
    return <p className="home-promotion-countdown" role="status">Happening now</p>;
  }
  const seconds = Math.max(0, Math.floor((start - now) / 1000));
  return (
    <p className="home-promotion-countdown" aria-label="Countdown to this event">
      Begins in {Math.floor(seconds / 86400)}d {Math.floor((seconds % 86400) / 3600)}h {Math.floor((seconds % 3600) / 60)}m {seconds % 60}s
    </p>
  );
}

function DepartmentCard({ department, image }) {
  return (
    <article className="home-department-card">
      <Link className="home-department-image" to="/community" aria-label={`Explore ${department.name}`}>
        <img src={image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        <span className="home-department-image-shade" />
        <span className="home-department-image-title">{department.name}</span>
      </Link>
      <div className="home-department-body">
        <p>{department.description || `Discover ways to connect with the ${department.name} community.`}</p>
        {department.meetingSchedule || department.locationText ? (
          <div className="home-department-meta">
            {department.meetingSchedule ? <span><Clock3 size={15} aria-hidden="true" />{department.meetingSchedule}</span> : null}
            {department.locationText ? <span><MapPin size={15} aria-hidden="true" />{department.locationText}</span> : null}
          </div>
        ) : null}
        {Number.isFinite(Number(department.memberCount)) ? (
          <p className="home-department-members"><Users size={15} aria-hidden="true" />{Number(department.memberCount)} members</p>
        ) : null}
        <Link to="/community" className="home-department-link">Explore department <ArrowRight size={16} /></Link>
      </div>
    </article>
  );
}
