import { useEffect } from 'react';
import { Church, HeartHandshake, BookOpenText, Compass, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import PageHero from '../../components/layout/PageHero.jsx';
import Button from '../../components/ui/Button.jsx';
import PartnerMarquee from '../../components/ui/PartnerMarquee.jsx';
import ContactVisitSection from './ContactVisitSection.jsx';
import { siteConfig } from '../../utils/siteConfig.js';

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

// Animation variant configurations
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

export default function AboutPage() {
  const { hash } = useLocation();

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
      {/* OUR STORY SECTION                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text Column */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="lg:col-span-6 space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-semibold tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              Our Story
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Faith passed from one generation to the next
            </h2>

            <p className="text-lg text-slate-600 leading-relaxed font-normal">
              From the very beginning, our church has been a place where the Bible is taught,
              prayers are lifted, and friendships are formed. We are ordinary people learning to
              follow Jesus together — across ages, backgrounds, and seasons of life.
            </p>

            <p className="text-slate-500 leading-relaxed text-sm">
              Whether you have followed Christ for decades or are simply curious, there is a place
              for you here. Our hope is that every visitor leaves having encountered a warm welcome
              and a community that walks with them.
            </p>

            <div className="pt-2">
              <Button to="#visit" size="lg">
                Plan your visit <ArrowRight size={16} className="ml-2 inline" />
              </Button>
            </div>
          </motion.div>

          {/* Right Image Column */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80">
              <img
                src="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1000&q=80"
                alt="Church congregation gathered in worship"
                className="w-full h-[420px] object-cover hover:scale-105 transition duration-700"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
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