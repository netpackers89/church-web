import { useEffect, useState } from 'react';
import { Church, HeartHandshake, BookOpenText, Compass, ArrowRight, ChevronLeft, ChevronRight, Users, Sparkles, X, Maximize2, Quote, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import PageHero from '../../components/layout/PageHero.jsx';
import Button from '../../components/ui/Button.jsx';
import PartnerMarquee from '../../components/ui/PartnerMarquee.jsx';
import ContactVisitSection from './ContactVisitSection.jsx';
import { siteConfig } from '../../utils/siteConfig.js';

// ----------------------------------------------------------------------
// DATA DEFINITIONS
// ----------------------------------------------------------------------

const PILLARS = [
  { icon: BookOpenText, title: 'Scripture', text: 'We root every part of church life in the Bible, teaching it plainly and applying it daily.' },
  { icon: HeartHandshake, title: 'Community', text: 'Small groups, Bible studies, and organizations help every person belong and be known.' },
  { icon: Compass, title: 'Discipleship', text: 'From youth to young adults, we walk with one another toward maturity in Christ.' },
  { icon: Church, title: 'Worship', text: 'Gathering together to praise God with reverence, joy, and the heritage of our church.' },
];

const MILESTONES = [
  { year: 'Founded', title: 'A congregation begins', text: 'Believers gather in a home to pray, study the Word, and encourage one another.' },
  { year: 'Growing', title: 'Ministries take root', text: 'Bible study, youth, and fellowship groups form to serve every generation.' },
  { year: 'Today', title: 'One community, many gifts', text: 'Worship, teaching, outreach, and service carried by members across the city.' },
];

const LEADERS = [
  {
    name: 'David Miller',
    role: 'Lead Senior Pastor',
    bio: 'Serving with a passion for biblical teaching, pastoral care, and community outreach for over 15 years.',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    tag: 'Preaching & Leadership',
  },
  {
    name: 'Sarah Jenkins',
    role: 'Worship & Creative Director',
    bio: 'Directing worship services, musical teams, and artistic expressions across all church gatherings.',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    tag: 'Worship & Arts',
  },
  {
    name: 'Marcus Vance',
    role: 'Youth & Young Adults Pastor',
    bio: 'Empowering the next generation to build strong spiritual foundations and vibrant friendships.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    tag: 'Next Gen Ministry',
  },
  {
    name: 'Elena Rostova',
    role: 'Community & Outreach Lead',
    bio: 'Connecting local families, driving compassion projects, and organizing regional service drives.',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80',
    tag: 'Outreach & Missions',
  },
  {
    name: 'Dr. Robert Hayes',
    role: 'Discipleship & Education Director',
    bio: 'Overseeing Bible training programs, small group curricula, and leadership mentorship development.',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
    tag: 'Biblical Studies',
  },
];

const GALLERY_IMAGES = [
  {
    id: 1,
    title: 'Sunday Worship Service',
    category: 'Worship',
    image: 'https://images.unsplash.com/photo-1510519138161-58446231f11c?auto=format&fit=crop&w=1400&q=85',
    caption: 'Gathering as one voice in gratitude, song, and reverence.',
  },
  {
    id: 2,
    title: 'Community Bible Study',
    category: 'Community',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=85',
    caption: 'Diving deep into the scriptures in small, supportive circles.',
  },
  {
    id: 3,
    title: 'Youth Night Gathering',
    category: 'Youth',
    image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1400&q=85',
    caption: 'Vibrant fellowship, worship, and honest discussion for students.',
  },
  {
    id: 4,
    title: 'Local City Outreach',
    category: 'Outreach',
    image: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1400&q=85',
    caption: 'Serving local neighbors through groceries, meals, and care initiatives.',
  },
  {
    id: 5,
    title: 'Annual Family Retreat',
    category: 'Community',
    image: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1400&q=85',
    caption: 'A weekend filled with joy, nature, rest, and shared memories.',
  },
  {
    id: 6,
    title: 'Baptism Sunday Celebration',
    category: 'Worship',
    image: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1400&q=85',
    caption: 'Celebrating new steps of faith and transformation together as a family.',
  },
];

const COLLAGE_IMAGES = [
  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1510519138161-58446231f11c?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=500&q=80',
];

// Motion configurations
const fadeInUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

// ----------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------

export default function AboutPage() {
  const { hash } = useLocation();
  const [activeTab, setActiveTab] = useState('All');
  const [activeSlide, setActiveSlide] = useState(0);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    if (hash !== '#visit') return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('visit')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash]);

  const filteredGallery = activeTab === 'All' 
    ? GALLERY_IMAGES 
    : GALLERY_IMAGES.filter((img) => img.category === activeTab);

  const nextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % filteredGallery.length);
  };

  const prevSlide = () => {
    setActiveSlide((prev) => (prev - 1 + filteredGallery.length) % filteredGallery.length);
  };

  return (
    <div className="bg-slate-50/50 text-slate-800 overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* HERO SECTION                                                       */}
      {/* ------------------------------------------------------------------ */}
      <PageHero
        eyebrow="About Us"
        title="A church family built on Scripture, worship, and belonging"
        subtitle={`${siteConfig.churchName} is a community of believers in ${siteConfig.address} devoted to knowing God and making Him known.`}
        imageUrl="https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1920&q=85"
      />

      {/* ------------------------------------------------------------------ */}
      {/* MODERN VISUAL STORY SECTION                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Floating Asymmetric Collage Top Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
        >
          {COLLAGE_IMAGES.map((imgUrl, i) => (
            <div 
              key={i} 
              className={`relative rounded-3xl overflow-hidden shadow-lg border border-slate-200/80 group ${
                i % 2 === 1 ? 'md:translate-y-6' : 'md:-translate-y-3'
              }`}
            >
              <img
                src={imgUrl}
                alt="Church community snapshot"
                className="w-full h-48 sm:h-64 object-cover group-hover:scale-110 transition duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300" />
            </div>
          ))}
        </motion.div>

        {/* Story Text & Key Numbers */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pt-6">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="lg:col-span-7 space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              Our Story & Purpose
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Faith passed from one generation to the next
            </h2>

            <p className="text-lg text-slate-600 leading-relaxed font-normal">
              From the very beginning, our church has been a place where the Bible is taught,
              prayers are lifted, and genuine friendships are formed. We are ordinary people learning to
              follow Jesus together across ages, backgrounds, and seasons of life.
            </p>

            <p className="text-slate-500 leading-relaxed text-sm">
              Whether you have followed Christ for decades or are simply curious, there is a place
              for you here. Our hope is that every visitor leaves having encountered a warm welcome
              and a community that walks with them.
            </p>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <Button to="#visit" size="lg">
                Plan your visit <ArrowRight size={16} className="ml-2 inline" />
              </Button>
            </div>
          </motion.div>

          {/* Side Glass Highlight Box */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-5 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden border border-slate-800"
          >
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <Quote className="text-indigo-400 mb-6 opacity-40" size={48} />
            <blockquote className="text-xl font-medium text-slate-100 leading-relaxed mb-6">
              &ldquo;We are committed to building a sanctuary of hope, connection, and truth for everyone who walks through our doors.&rdquo;
            </blockquote>
            <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
              <div className="w-12 h-12 rounded-full bg-indigo-600/30 flex items-center justify-center border border-indigo-400/30">
                <Award className="text-indigo-400" size={24} />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Centered on Grace</h4>
                <p className="text-xs text-indigo-300">Open to all generations</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* WHAT WE VALUE (FOUR PILLARS)                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 bg-white border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center max-w-2xl mx-auto mb-16 space-y-3"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              What We Value
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Four pillars that shape our life together
            </h2>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {PILLARS.map((p) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.title}
                  variants={fadeInUp}
                  whileHover={{ y: -4 }}
                  className="bg-slate-50/70 p-8 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition duration-300"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-6 shadow-md shadow-indigo-100">
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{p.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{p.text}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* LEADERSHIP INFINITE MARQUEE SECTION                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 bg-slate-900 text-white overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
              <Users size={14} className="text-indigo-400" />
              Church Leadership
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Guided by devoted ministry leaders
            </h2>
          </motion.div>
          <p className="text-slate-400 text-sm max-w-md">
            Our pastors, directors, and staff members work together to nurture our congregation, equip members, and serve our broader city.
          </p>
        </div>

        {/* Infinite Continuous Scrolling Cards */}
        <div className="relative w-full overflow-hidden py-4">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none" />

          <motion.div
            className="flex gap-6 w-max"
            animate={{ x: ['0%', '-50%'] }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            {[...LEADERS, ...LEADERS].map((leader, idx) => (
              <div
                key={`${leader.name}-${idx}`}
                className="w-80 group relative rounded-3xl overflow-hidden bg-slate-800/80 border border-slate-700/60 backdrop-blur-md shadow-xl flex-shrink-0 hover:border-indigo-500/50 transition-all duration-500"
              >
                <div className="h-80 overflow-hidden relative">
                  <img
                    src={leader.image}
                    alt={leader.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-90 group-hover:opacity-95 transition-opacity duration-300" />
                  
                  <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-slate-900/70 border border-slate-700/50 text-[10px] font-semibold text-indigo-300 uppercase tracking-widest backdrop-blur-md">
                    {leader.tag}
                  </span>
                </div>

                <div className="p-6 relative -mt-20 z-10 space-y-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {leader.name}
                  </h3>
                  <p className="text-xs font-semibold text-indigo-400 tracking-wide uppercase">
                    {leader.role}
                  </p>
                  <p className="text-slate-300 text-xs leading-relaxed pt-1 line-clamp-3">
                    {leader.bio}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* HIGH-IMPACT DYNAMIC CAROUSEL GALLERY SECTION                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 bg-white border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold tracking-wide uppercase">
              <Sparkles size={14} className="text-indigo-600" />
              Life Together Gallery
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Captured moments in our community
            </h2>
            <p className="text-slate-600 text-sm">
              Explore snapshots of worship, fellowship, outreach, and life together.
            </p>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {['All', 'Worship', 'Community', 'Youth', 'Outreach'].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveTab(cat);
                  setActiveSlide(0);
                }}
                className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wider uppercase transition-all duration-300 ${
                  activeTab === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 scale-105'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Immersive Dynamic Carousel */}
          {filteredGallery.length > 0 && (
            <div className="relative max-w-5xl mx-auto">
              <div className="relative h-[360px] sm:h-[480px] md:h-[540px] rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 group">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={filteredGallery[activeSlide].id}
                    src={filteredGallery[activeSlide].image}
                    alt={filteredGallery[activeSlide].title}
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="w-full h-full object-cover"
                  />
                </AnimatePresence>

                {/* Glassmorphism Caption Card */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex flex-col justify-end p-6 sm:p-10">
                  <div className="flex items-end justify-between gap-4">
                    <div className="space-y-1">
                      <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/30 backdrop-blur-md border border-indigo-300/30 text-indigo-200 text-[10px] font-bold uppercase tracking-widest">
                        {filteredGallery[activeSlide].category}
                      </span>
                      <h3 className="text-2xl sm:text-4xl font-extrabold text-white">
                        {filteredGallery[activeSlide].title}
                      </h3>
                      <p className="text-slate-200 text-xs sm:text-sm max-w-xl leading-relaxed">
                        {filteredGallery[activeSlide].caption}
                      </p>
                    </div>

                    <button
                      onClick={() => setLightboxImage(filteredGallery[activeSlide])}
                      className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-md transition flex-shrink-0"
                      aria-label="Fullscreen view"
                    >
                      <Maximize2 size={20} />
                    </button>
                  </div>
                </div>

                {/* Carousel Controls */}
                <button
                  onClick={prevSlide}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3.5 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white border border-white/20 backdrop-blur-md transition duration-300 hover:scale-110 shadow-lg"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3.5 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white border border-white/20 backdrop-blur-md transition duration-300 hover:scale-110 shadow-lg"
                  aria-label="Next image"
                >
                  <ChevronRight size={22} />
                </button>
              </div>

              {/* Slide Indicators & Thumbnails Bar */}
              <div className="flex justify-between items-center mt-6 px-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  {activeSlide + 1} / {filteredGallery.length}
                </span>

                <div className="flex justify-center items-center gap-2">
                  {filteredGallery.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlide(idx)}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        activeSlide === idx ? 'w-8 bg-indigo-600' : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* LIGHTBOX MODAL */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
            onClick={() => setLightboxImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition"
              >
                <X size={20} />
              </button>
              <img
                src={lightboxImage.image}
                alt={lightboxImage.title}
                className="w-full max-h-[75vh] object-cover"
              />
              <div className="p-6 sm:p-8 text-white space-y-2">
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">
                  {lightboxImage.category}
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold">{lightboxImage.title}</h3>
                <p className="text-slate-300 text-sm leading-relaxed">{lightboxImage.caption}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* OUR JOURNEY (MILESTONES)                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="max-w-2xl mb-16 space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            Our Journey
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Milestones of God&apos;s faithfulness
          </h2>
        </motion.div>

        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {MILESTONES.map((m) => (
            <motion.div 
              key={m.title}
              variants={fadeInUp}
              whileHover={{ y: -4 }}
              className="bg-white p-8 rounded-3xl border border-slate-200/70 shadow-sm hover:shadow-lg transition duration-300 flex flex-col justify-between"
            >
              <div>
                <span className="inline-block px-3.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-bold uppercase tracking-wider mb-5">
                  {m.year}
                </span>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{m.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{m.text}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* IN PARTNERSHIP (MARQUEE)                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-20 bg-slate-900 text-white text-center">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4"
        >
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
            In Partnership
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Walking alongside sister churches and ministries
          </h2>
          <div className="pt-8">
            <PartnerMarquee />
          </div>
        </motion.div>
      </section>

      <ContactVisitSection />
    </div>
  );
}