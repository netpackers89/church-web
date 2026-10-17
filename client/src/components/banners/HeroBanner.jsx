import { MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; // Or 'motion/react' depending on your package setup
import { useEffect, useState } from 'react';

// Default inspirational Christian worship & sanctuary imagery fallbacks
const DEFAULT_CHRISTIAN_IMAGES = [
  'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1920&q=80', // Church Sanctuary / Cross Light
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1920&q=80', // Worship & Praise
  'https://images.unsplash.com/photo-1548625361-180a37b3b333?auto=format&fit=crop&w=1920&q=80', // Open Bible & Fellowship
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1920&q=80', // Church Community Gathering
];

export default function HeroBanner({
  headline = 'A place to belong, believe, and become',
  subheading = 'Join our church family as we worship God, grow in His Word, and love our community together.',
  images = [],
  nextService,
  onGatheringEnded,
  primaryCta,
  secondaryCta,
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Normalise images: use provided list or fall back to Christian imagery
  const imageList =
    Array.isArray(images) && images.length > 0
      ? images
      : DEFAULT_CHRISTIAN_IMAGES;

  // Automatically rotate background images every 6 seconds
  useEffect(() => {
    if (imageList.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % imageList.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [imageList]);

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-slate-950 text-white">
      {/* ------------------------------------------------------------------ */}
      {/* ROTATING BACKGROUND IMAGES & CINEMATIC REVEAL EFFECTS              */}
      {/* ------------------------------------------------------------------ */}
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={currentImageIndex}
            src={imageList[currentImageIndex]}
            alt="Church Background"
            initial={{ opacity: 0, scale: 1.15, filter: 'blur(8px)' }} // Dramatic reveal start
            animate={{ 
              opacity: 1, 
              scale: 1.05, 
              filter: 'blur(0px)',
              transition: { 
                duration: 1.8, 
                ease: [0.25, 1, 0.5, 1] 
              } 
            }}
            exit={{ 
              opacity: 0, 
              scale: 1, 
              filter: 'blur(4px)',
              transition: { duration: 1.2 } 
            }}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        </AnimatePresence>

        {/* Multi-layered Frosted Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/50 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/40" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN CONTENT WRAPPER                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Column: Headline & Actions */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-7 space-y-6"
        >
          {/* Kicker badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-indigo-200 text-xs font-medium tracking-wide uppercase shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            A place to come alive
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-white drop-shadow-md">
            {headline}
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed">
            {subheading}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            {primaryCta}
            {secondaryCta}
          </div>

          {/* Slide Indicators for Image Rotation */}
          {imageList.length > 1 && (
            <div className="flex items-center gap-2 pt-6">
              {imageList.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    idx === currentImageIndex
                      ? 'w-8 bg-indigo-400'
                      : 'w-2 bg-white/30 hover:bg-white/60'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Right Column: Next Gathering Card */}
        {nextService?.startAt ? (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.75, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5 bg-white/10 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-white/20 shadow-2xl shadow-black/50"
          >
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold tracking-wider uppercase mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Next Gathering
            </div>

            <div className="flex items-start gap-4">
              {/* Date Badge */}
              <div className="flex flex-col items-center justify-center bg-white/15 border border-white/20 rounded-2xl px-4 py-3 min-w-[4.5rem] text-center shadow-inner">
                <span className="text-2xl font-black text-white leading-none">
                  {new Intl.DateTimeFormat('en', {
                    day: '2-digit',
                    timeZone: nextService.timezone || 'Africa/Addis_Ababa',
                  }).format(new Date(nextService.startAt))}
                </span>
                <span className="text-xs font-medium text-indigo-200 uppercase tracking-wider mt-1">
                  {new Intl.DateTimeFormat('en', {
                    weekday: 'short',
                    timeZone: nextService.timezone || 'Africa/Addis_Ababa',
                  }).format(new Date(nextService.startAt))}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white leading-snug">
                  {nextService.title}
                </h3>
                <p className="text-sm text-slate-300 mt-1">
                  {new Intl.DateTimeFormat('en', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: nextService.timezone || 'Africa/Addis_Ababa',
                  }).format(new Date(nextService.startAt))}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-300 text-sm mt-5 pt-4 border-t border-white/10">
              <MapPin size={16} className="text-indigo-400 shrink-0" aria-hidden="true" />
              <span className="truncate">{nextService.location || 'Location to be announced'}</span>
            </div>

            <GatheringCountdown event={nextService} onEnded={onGatheringEnded} />
          </motion.div>
        ) : null}

      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* COUNTDOWN COMPONENT WITH FIXED CALCULATIONS                                */
/* -------------------------------------------------------------------------- */
function GatheringCountdown({ event, onEnded }) {
  const [now, setNow] = useState(() => Date.now());
  const start = new Date(event.startAt).getTime();
  
  // Default end time is 2 hours after start if endAt is not explicitly passed
  const end = event.endAt
    ? new Date(event.endAt).getTime()
    : start + 2 * 60 * 60 * 1000;
  
  const ended = now >= end;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (ended) onEnded?.();
  }, [ended, onEnded]);

  if (ended)
    return (
      <p className="text-center text-sm text-slate-400 mt-5" role="status">
        Finding the next gathering...
      </p>
    );

  if (now >= start)
    return (
      <p className="text-center text-sm font-semibold text-emerald-400 mt-5 animate-pulse" role="status">
        Happening Now
      </p>
    );

  // Fixed math syntax for remaining seconds
  const secondsLeft = Math.max(0, Math.floor((start - now) / 1000));
  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const pad = (value) => String(value).padStart(2, '0');

  const units = [
    ['Days', days],
    ['Hours', hours],
    ['Mins', minutes],
    ['Secs', seconds],
  ];

  return (
    <div className="mt-6 pt-5 border-t border-white/10">
      <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3 text-center">
        Gathering begins in
      </h4>
      <div
        className="grid grid-cols-4 gap-2 text-center"
        aria-label={`${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds until the next gathering`}
      >
        {units.map(([label, value]) => (
          <div key={label} className="bg-black/40 border border-white/10 rounded-xl py-2 px-1 backdrop-blur-sm">
            <span className="block text-lg font-bold text-white" aria-hidden="true">
              {pad(value)}
            </span>
            <span className="block text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}