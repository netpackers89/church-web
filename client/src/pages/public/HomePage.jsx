import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, Users, Heart, ArrowRight, MapPin, Cross, ChevronRight, UserPlus } from 'lucide-react';
import HeroBanner from '../../components/banners/HeroBanner.jsx';
import EventCard from '../../components/events/EventCard.jsx';
import PartnerMarquee from '../../components/ui/PartnerMarquee.jsx';
import Button from '../../components/ui/Button.jsx';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import useAsync from '../../hooks/useAsync.js';
import { publicService, unwrap } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const COMMUNITY = [
  {
    icon: Heart,
    tag: 'Serve',
    title: 'Community Care',
    text: 'Practical support, shared meals, and a caring church family for every season.',
    img: 'https://images.unsplash.com/photo-1593113646773-028c64a8f1b8?auto=format&fit=crop&w=800&q=80',
    to: '/contact',
  },
  {
    icon: Users,
    tag: 'Belong',
    title: 'Youth (20–35)',
    text: 'A vibrant community of young adults building faith, friendships, and purpose together.',
    img: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80',
    to: '/ministries',
  },
  {
    icon: Heart,
    tag: 'Serve',
    title: 'Fellowship',
    text: 'High-school students growing in Christ through worship, mentorship, and genuine friendship.',
    img: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
    to: '/ministries',
  },
];

export default function HomePage() {
  const { user } = useAuth();
  const events = useAsync(async () => {
    const res = await publicService.upcomingEvents({ limit: 4 });
    return unwrap(res) ?? [];
  }, []);
  const nextGathering = useAsync(async () => {
    const response = await publicService.nextGathering();
    const result = response.data?.data;
    return result ? { ...result, timezone: response.data.timezone } : null;
  }, []);
  const banners = useAsync(async () => {
    const res = await publicService.banners();
    const list = unwrap(res);
    return Array.isArray(list) ? list.map((b) => b.mediaUrl || b.imageUrl || '').filter(Boolean) : [];
  }, []);
  const campaigns = useAsync(async () => {
    const res = await publicService.campaigns();
    const list = unwrap(res);
    return Array.isArray(list)
      ? list.filter((campaign) => campaign.displayStatus === 'ACTIVE' || campaign.status === 'ACTIVE')
      : [];
  }, []);

  useEffect(() => {
    const refresh = window.setInterval(() => {
      nextGathering.reload();
    }, 60_000);
    return () => window.clearInterval(refresh);
  }, [nextGathering.reload]);

  return (
    <div className="home-experience">
      <HeroBanner
        headline="A home for faith, family, and purpose."
        subheading="Come as you are and find a community where worship feels alive, Scripture becomes personal, and every generation has a place."
        images={banners.data}
        nextService={nextGathering.data}
        onGatheringEnded={nextGathering.reload}
        primaryCta={<Button to="/about#visit" variant="gold" size="lg">Plan Your Visit</Button>}
        secondaryCta={<Button to="/events" variant="light" size="lg" iconRight={ArrowRight}>Explore Events</Button>}
      />

      <motion.section className="home-membership" {...reveal}>
        <div className="container">
          {user ? <MemberCommunity user={user} /> : <MembershipStarter />}
        </div>
      </motion.section>

      {/* Service schedule */}
      <motion.section className="section-sm home-rhythm" {...reveal}>
        <div className="container">
          <div className="home-section-top">
            <div>
              <span className="home-overline">This week at church</span>
              <h2>Make space for what matters.</h2>
            </div>
            <Link to="/programs" className="home-text-link">Full schedule <ArrowRight size={16} /></Link>
          </div>
          {events.data?.length ? (
            <div className="schedule-strip">
              {events.data.slice(0, 4).map((item) => {
                const timezone = item.timezone || 'Africa/Addis_Ababa';
                const startAt = new Date(item.startAt);
                return (
                  <Link to={`/events/${item.id}`} className="schedule-cell" key={item.id}>
                    <span className="day">{new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: timezone }).format(startAt)}</span>
                    <span className="time">{new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(startAt)}</span>
                    <span className="title">{item.title}</span>
                    <span className="where">{item.location || 'Location to be announced'}</span>
                  </Link>
                );
              })}
            </div>
          ) : events.loading ? <div className="schedule-empty muted">Loading the church schedule…</div> : <div className="schedule-empty muted">No upcoming gatherings have been published yet.</div>}
        </div>
      </motion.section>

      <motion.section className="section home-intro" {...reveal}>
        <div className="container home-intro-grid">
          <div>
            <span className="home-overline">More than a Sunday</span>
            <h2>Church is a people, not a building.</h2>
            <p>We are a diverse family learning to follow Jesus in the everyday—at home, at work, and in our city.</p>
            <Button to="/about" variant="primary" iconRight={ArrowRight}>Our story</Button>
          </div>
          <div className="home-pillars">
            <Pillar icon={Cross} number="01" title="Worship together" text="A weekly rhythm of praise, prayer, and hope." />
            <Pillar icon={BookOpen} number="02" title="Grow deeper" text="Scripture and honest conversations for every season." />
            <Pillar icon={Heart} number="03" title="Love our city" text="Practical care for neighbors near and far." />
          </div>
        </div>
      </motion.section>

      {/* Featured events */}
      <motion.section className="section home-events" {...reveal}>
        <div className="container">
          <div className="home-section-top">
            <div>
              <span className="home-overline">Come and see</span>
              <h2>There&apos;s always room for you.</h2>
            </div>
            <Link to="/events" className="home-text-link">All events <ArrowRight size={16} /></Link>
          </div>
          {events.loading ? (
            <div className="event-grid">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
          ) : events.error ? (
            <ErrorMessage error={events.error} onRetry={events.reload} />
          ) : events.data && events.data.length > 0 ? (
            <div className="event-grid">
              {events.data.slice(0, 3).map((e) => <EventCard key={e.id ?? e.title} event={e} />)}
            </div>
          ) : (
            <EmptyState 
              icon={MapPin} 
              title="No upcoming events yet" 
              description="Please check back soon — new events are posted regularly." 
              action={<Button to="/about#visit" variant="secondary">Ask about upcoming events</Button>} 
            />
          )}
        </div>
      </motion.section>

      {/* Community */}
      <motion.section className="section home-community" {...reveal}>
        <div className="container">
          <div className="home-section-top centered">
            <div>
            <span className="home-overline">Find your people</span>
            <h2>Every story has a place here.</h2>
            <p>Wherever you are in life, there is a group for you to grow, serve, and build lasting friendships.</p>
            </div>
          </div>
          <div className="community-grid">
            {COMMUNITY.map((c) => {
              const Icon = c.icon;
              return (
                <Link to={c.to} key={c.title} className="community-card card-hover">
                  <div className="cc-media">
                    <img src={c.img} alt={c.title} loading="lazy" />
                  </div>
                  <div className="cc-body">
                    <span className="eyebrow blue"><Icon size={14} /> {c.tag}</span>
                    <h3 className="serif" style={{ fontSize: '1.3rem' }}>{c.title}</h3>
                    <p className="muted" style={{ fontSize: '0.92rem' }}>{c.text}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* Partner marquee */}
      <section className="section-sm section-paper">
        <div className="container center" style={{ marginBottom: '1.5rem' }}>
          <span className="eyebrow blue"><span className="dot" /> In Partnership</span>
          <p className="muted" style={{ marginTop: '0.3rem' }}>Sister churches and ministries we serve alongside.</p>
        </div>
        <PartnerMarquee />
      </section>

      {/* Giving */}
      <motion.section className="section home-giving" {...reveal}>
        <div className="container give-layout">
          <div>
            <span className="eyebrow"><span className="dot" /> Generosity</span>
            <h2 className="serif" style={{ fontSize: 'clamp(1.7rem, 3.2vw, 2.6rem)', marginTop: '0.6rem', color: '#fff' }}>Give cheerfully, together</h2>
            <p className="lead" style={{ marginTop: '1rem' }}>Your giving sustains worship, outreach, and care for those in need. Every gift is an act of worship and makes an eternal difference.</p>
            <div style={{ marginTop: '1.75rem' }}><Button to="/give" variant="gold" size="lg" iconRight={ArrowRight}>Ways to give</Button></div>
          </div>
          <div className="hero-card">
            {campaigns.loading ? (
              <>
                <h3>Giving campaign</h3>
                <p className="muted" style={{ marginTop: '0.5rem' }}>Loading current campaigns…</p>
              </>
            ) : campaigns.data?.length ? (
              <>
                <h3>{campaigns.data[0].title}</h3>
                {campaigns.data[0].description ? <p className="muted" style={{ marginTop: '0.5rem' }}>{campaigns.data[0].description}</p> : null}
                {campaigns.data[0].goalAmount !== null && campaigns.data[0].goalAmount !== undefined ? (
                  <>
                    <div className="progress" style={{ marginTop: '1.25rem', background: 'rgba(255,255,255,0.2)' }}>
                      <div
                        className="progress-bar"
                        style={{ width: `${Math.min(100, Math.max(0, Number(campaigns.data[0].raisedAmount ?? 0) / Math.max(Number(campaigns.data[0].goalAmount), 1) * 100))}%` }}
                      />
                    </div>
                    <div className="progress-meta">
                      <span>{Number(campaigns.data[0].raisedAmount ?? 0).toLocaleString()} {campaigns.data[0].currency} raised</span>
                      <span>Goal {Number(campaigns.data[0].goalAmount).toLocaleString()} {campaigns.data[0].currency}</span>
                    </div>
                  </>
                ) : null}
                <Button to={campaigns.data[0].ctaUrl || '/give'} variant="light" size="sm">View campaign</Button>
              </>
            ) : (
              <>
                <h3>Giving at our church</h3>
                <p className="muted" style={{ marginTop: '0.5rem' }}>Explore the currently configured ways to give.</p>
                <Button to="/give" variant="light" size="sm">Ways to give</Button>
              </>
            )}
          </div>
        </div>
      </motion.section>

      {/* Visitor */}
      <motion.section className="section home-visit" {...reveal}>
        <div className="container visitor-panel">
          <div className="section-head">
            <span className="eyebrow blue"><span className="dot" /> New Here?</span>
            <h2 style={{ fontSize: 'clamp(1.7rem, 3.2vw, 2.6rem)' }}>We&apos;d love to welcome you this Sunday</h2>
            <p>Your first visit can feel unfamiliar — let us make it easy. Arrive a few minutes early, and our welcome team will help you find your way.</p>
            <div style={{ marginTop: '1.5rem' }}><Button to="/about#visit" variant="primary" size="lg" iconRight={ArrowRight}>Plan your visit</Button></div>
          </div>
          <div className="home-visit-aside">
            <div className="church-map">
              <iframe title="Yeka Abado Full Gospel Church location" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d785.5888138125316!2d38.873814303814214!3d9.057601743589627!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x164b9111e3fcf36f%3A0x8616e9cdcb4983ac!2sYeka%20Abado%20Full%20Gospel%20Church%20Building%20Construction%20place!5e1!3m2!1sen!2set!4v1791904443660!5m2!1sen!2set" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
            </div>
            <div className="visitor-facts">
              <div className="fact-row">
                <span className="fact-icon"><MapPin aria-hidden="true" size={20} /></span>
                <div><strong>Visit us</strong><span>Find directions and parking on the contact page.</span></div>
              </div>
              <div className="fact-row">
                <span className="fact-icon"><Heart aria-hidden="true" size={20} /></span>
                <div><strong>Come as you are</strong><span>No dress code — you&apos;re welcome just as you are.</span></div>
              </div>
              <div className="fact-row">
                <span className="fact-icon"><Users aria-hidden="true" size={20} /></span>
                <div><strong>Children &amp; youth</strong><span>Age-appropriate programs are available during the service.</span></div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

function MemberCommunity({ user }) {
  const firstName = user.name?.trim().split(/\s+/)[0] || 'there';
  return (
    <section className="member-community-panel" aria-label="Your church community">
      <div>
        <span className="home-overline">Your church community</span>
        <h2>Welcome back, {firstName}.</h2>
        <p>Explore your departments and Bible study groups from one place.</p>
      </div>
      <div className="member-community-actions">
        <Button to="/me/organizations" variant="light">Departments</Button>
        <Button to="/me/bible-study" variant="light">Bible study groups</Button>
      </div>
    </section>
  );
}

const reveal = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.16 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

function Pillar({ icon: Icon, number, title, text }) {
  return (
    <div className="home-pillar">
      <span className="home-pillar-number">{number}</span>
      <span className="home-pillar-icon"><Icon size={19} /></span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <ChevronRight className="home-pillar-arrow" size={18} />
    </div>
  );
}

function MembershipStarter() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', path: 'member' });

  function startRegistration(event) {
    event.preventDefault();
    if (form.path === 'faith') {
      navigate('/new-christian');
      return;
    }
    const params = new URLSearchParams({ name: form.name.trim(), email: form.email.trim() });
    navigate(`/register?${params.toString()}`);
  }

  return (
    <div className="membership-starter">
      <div className="membership-starter-copy">
        <span className="membership-icon"><UserPlus size={20} /></span>
        <div>
          <span className="home-overline">Your next step</span>
          <h2>New to faith or ready to belong?</h2>
          <p>{form.path === 'faith'
            ? 'Share your story and request pastoral follow-up. You do not need to create a member account.'
            : 'Already part of the church? Start your regular member account registration here.'}</p>
        </div>
      </div>
      <form className="membership-form" onSubmit={startRegistration}>
        <label className="membership-select-label">
          <span className="sr-only">How can we help?</span>
          <select value={form.path} onChange={(event) => setForm((current) => ({ ...current, path: event.target.value }))}>
            <option value="member">I am an existing church member</option>
            <option value="faith">I am new to faith / accepted Jesus</option>
          </select>
        </label>
        {form.path === 'member' ? (
          <>
            <label>
              <span className="sr-only">Full name</span>
              <input required value={form.name} autoComplete="name" placeholder="Your full name" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span className="sr-only">Email address</span>
              <input required type="email" value={form.email} autoComplete="email" placeholder="Email address" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </label>
          </>
        ) : null}
        <Button type="submit" variant="primary" iconRight={ArrowRight}>{form.path === 'faith' ? 'Open New Christian form' : 'Start member registration'}</Button>
      </form>
    </div>
  );
}
