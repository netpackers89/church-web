import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const DEFAULT_CHRISTIAN_IMAGES = [
  'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1920&q=80',
  '/church-building.png',
  'https://images.unsplash.com/photo-1445452916036-9022dfd33aa8?auto=format&fit=crop&w=1920&q=80',
];

const BANNER_COPY = [
  { display: ['Welcome', 'Home.'], label: 'A place to worship, grow, and belong' },
  { display: ['Come as', 'you are.'], label: 'There is a place for every story' },
  { display: ['Encounter', 'His presence.'], label: 'Gather with hope and expectation' },
  { display: ['Grow in faith', 'together.'], label: 'A community for every generation' },
];

const DEFAULT_NEXT_SERVICE = {
  id: '1',
  title: 'Wednesday Deliverance Service',
  startAt: new Date(Date.now() + 86400000 * 2 + 3600000 * 5).toISOString(),
  location: 'Yeka Abado Sanctuary',
  timezone: 'Africa/Addis_Ababa',
};

const PARTNER_ORGANIZATIONS = [
  {
    name: 'Mulu Wengel',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS0IW6byXQAQiV1-EXti6SVzlGBpjba_uVcoJ2bQheqHbpTQ2kedd6BwhA&s=10',
  },
  {
    name: 'Pentecostal',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfSxyLufgbbou2mEqDXTA2TeJi24d7uGVEtn1eWtNZNauNDsKmlZP9Q7UY&s=10',
  },
  {
    name: 'Adventist',
    logo: 'https://w7.pngwing.com/pngs/316/509/png-transparent-bible-baltimore-white-marsh-seventh-day-adventist-church-and-school-gaylord-seventh-day-adventist-christianity-logo-of-the-church-of-pentecost-thumbnail.png',
  },
  {
    name: 'Gospel Church',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTELA3lbToMzNTqtkFMpx3fJnTT6ziNuh1ig39TLZnUeao4oxcBMo9O4QUt&s=10',
  },
  {
    name: 'Grace Ministry',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNrB7ntViS-9vOn0Z7bTAa1jBc9EgJCXesNh1QmW4PbsmkKV6tWyKNGEw&s=10',
  },
  {
    name: 'Apostolic',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcScEFoRzVVNM1bfAnpGshoNLXyIjLqjk037u_tAWDH46yq-tcSaUP2zmZU&s=10',
  },
];

function imageUrl(image) {
  return typeof image === 'string' ? image : image?.mediaUrl || image?.imageUrl || '';
}

function dateParts(date, timezone) {
  const value = new Date(date);
  if (!Number.isFinite(value.getTime())) return null;
  return {
    day: new Intl.DateTimeFormat('en', { day: '2-digit', timeZone: timezone }).format(value),
    weekday: new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: timezone }).format(value),
    month: new Intl.DateTimeFormat('en', { month: 'short', timeZone: timezone }).format(value),
    time: new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(value),
  };
}

export default function HeroBanner({
  headline = 'A home for faith, family, and purpose.',
  subheading = 'Come as you are and find a community where worship feels alive, Scripture becomes personal, and every generation has a place.',
  images = [],
  nextService = DEFAULT_NEXT_SERVICE,
  onGatheringEnded,
  primaryCta = (
    <button className="px-8 py-3.5 bg-white text-[#0B132B] hover:bg-amber-50 font-medium rounded-full shadow-xl transition-all transform hover:-translate-y-0.5">
      Plan Your Visit
    </button>
  ),
  secondaryCta = (
    <button className="px-8 py-3.5 border border-white/20 hover:border-amber-200/40 text-white font-light rounded-full backdrop-blur-md transition-all">
      Watch a Message &rarr;
    </button>
  ),
}) {
  const prefersReducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedImageIndex, setFailedImageIndex] = useState(-1);

  const imageList = useMemo(() => {
    const uploadedImages = Array.isArray(images) ? images.map(imageUrl).filter(Boolean) : [];
    if (!uploadedImages.length) return DEFAULT_CHRISTIAN_IMAGES;
    const slides = uploadedImages.slice(0, 4);
    while (slides.length < 4) slides.push(DEFAULT_CHRISTIAN_IMAGES[slides.length % uploadedImages.length]);
    return slides;
  }, [images]);

  const activeIndex = currentIndex % imageList.length;
  const activeCopy = BANNER_COPY[activeIndex % BANNER_COPY.length];
  const timezone = nextService?.timezone || 'Africa/Addis_Ababa';
  const serviceDate = nextService?.startAt ? dateParts(nextService.startAt, timezone) : null;

  useEffect(() => {
    if (prefersReducedMotion || imageList.length < 2) return undefined;
    const timer = window.setInterval(() => setCurrentIndex((index) => (index + 1) % imageList.length), 6000);
    return () => window.clearInterval(timer);
  }, [imageList.length, prefersReducedMotion]);

  return (
    <section
      className="relative min-h-screen w-full overflow-hidden bg-[#070D1E] text-white flex flex-col justify-between selection:bg-amber-200 selection:text-[#0B132B]"
      aria-label="Welcome to our church"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.img
            key={activeIndex}
            src={failedImageIndex === activeIndex ? '/church-building.png' : imageList[activeIndex]}
            alt=""
            onError={() => setFailedImageIndex(activeIndex)}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 0.82, scale: 1 }}
            exit={{ opacity: 0, scale: 1.015 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 h-full w-full object-cover object-center brightness-90 contrast-105"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,13,30,0.84)_0%,rgba(7,13,30,0.62)_42%,rgba(7,13,30,0.18)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#070D1E_0%,rgba(7,13,30,0.48)_18%,transparent_58%)]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-grow flex-col justify-center px-6 pb-6 pt-32 sm:px-8 sm:pt-36 lg:px-12">
        <div className="flex items-center">
          <div className="flex flex-col items-start text-left">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeIndex}-copy`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300 sm:text-sm">
                  Fellowship &amp; purpose
                </p>

                <h1 className="max-w-2xl text-5xl font-serif leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
                  <span className="block">{activeCopy.display[0]}</span>
                  <span className="block font-normal italic text-amber-100">
                    {activeCopy.display[1]}
                  </span>
                </h1>

                <p className="max-w-xl pt-1 text-base font-light leading-relaxed text-slate-200 sm:text-lg">
                  {activeCopy.label}. {activeIndex === 0 ? subheading : headline}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-wrap items-center gap-4 pt-7">
              {primaryCta}
              {secondaryCta}
            </div>
          </div>
        </div>

        {/* Next gathering countdown */}
        {nextService?.startAt && serviceDate ? (
          <div className="z-10 mx-auto w-full pt-8 sm:pt-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 sm:gap-8 p-5 sm:p-6 rounded-3xl bg-[#080D1F]/75 border border-white/15 backdrop-blur-xl shadow-2xl text-left">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]" />
                  Next gathering
                </span>
                <h2 className="mt-2 text-lg sm:text-xl font-semibold text-white truncate">
                  {nextService.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-amber-200 shrink-0" />
                    {serviceDate.weekday} · {serviceDate.time}
                  </span>
                  {nextService.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-amber-200 shrink-0" />
                      {nextService.location}
                    </span>
                  )}
                </div>
              </div>

              <GatheringCountdown event={nextService} onEnded={onGatheringEnded} />
            </div>
          </div>
        ) : null}

      </div>

      {/* Tightly Spaced Infinite Logo Marquee */}
      <InfiniteLogoMarquee items={PARTNER_ORGANIZATIONS} />
    </section>
  );
}

/* Page-Flip Countdown Clock Component */
function GatheringCountdown({ event, onEnded }) {
  const [now, setNow] = useState(() => Date.now());
  const notifiedEvent = useRef(null);
  const start = new Date(event.startAt).getTime();
  const end = event.endAt ? new Date(event.endAt).getTime() : start + 2 * 60 * 60 * 1000;
  const hasValidTimes = Number.isFinite(start) && Number.isFinite(end) && end >= start;
  const isLive = hasValidTimes && now >= start && now < end;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const eventKey = `${event.id ?? ''}:${event.startAt}`;
    if (!hasValidTimes || now < end || notifiedEvent.current === eventKey) return;
    notifiedEvent.current = eventKey;
    onEnded?.();
  }, [end, event.id, event.startAt, hasValidTimes, now, onEnded]);

  if (!hasValidTimes) return null;
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-medium text-emerald-100 md:self-center">
        <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
        Gathering is live
      </span>
    );
  }
  if (now >= end) {
    return <span className="text-sm font-medium text-slate-300">Gathering has ended</span>;
  }

  const secondsLeft = Math.max(0, Math.floor((start - now) / 1000));
  const parts = [
    ['Days', Math.floor(secondsLeft / 86400)],
    ['Hours', Math.floor((secondsLeft % 86400) / 3600)],
    ['Mins', Math.floor((secondsLeft % 3600) / 60)],
    ['Secs', secondsLeft % 60],
  ];

  return (
    <div role="timer" aria-label="Time until the next gathering" className="flex items-center gap-2 sm:gap-3">
      {parts.map(([label, value]) => (
        <div key={label} className="flex min-w-12 flex-col items-center">
          <FlipCard digit={String(value).padStart(2, '0')} />
          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 tracking-[0.12em] uppercase mt-1.5">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Page-Flip Card Unit */
function FlipCard({ digit }) {
  return (
    <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-white/[0.06] rounded-xl border border-white/15 flex items-center justify-center shadow-lg overflow-hidden">
      <div className="absolute inset-x-0 top-1/2 h-px bg-black/50 z-20" />

      <AnimatePresence mode="popLayout">
        <motion.span
          key={digit}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="text-lg sm:text-xl font-mono font-semibold tabular-nums text-white z-10"
        >
          {digit}
        </motion.span>
      </AnimatePresence>

      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/[0.04] pointer-events-none" />
    </div>
  );
}

/* Tightly Spaced Dual-Track Infinite Logo Marquee */
function InfiniteLogoMarquee({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="hero-logo-marquee relative z-20 w-full overflow-hidden border-t border-white/10 bg-[#070D1E]/75 py-5 sm:py-6 backdrop-blur-md">
      <svg className="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden="true" focusable="false">
        <defs>
          <filter id="hero-logo-color-key" colorInterpolationFilters="sRGB">
            <feColorMatrix
              in="SourceGraphic"
              result="hero-logo-color-differences"
              type="matrix"
              values="1 -1 0 0 0 0 1 -1 0 0 -1 0 1 0 0 0 0 0 1 0"
            />
            <feColorMatrix
              in="hero-logo-color-differences"
              result="hero-logo-color-mask"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 20 20 20 0 -1"
            />
            <feComposite in="SourceGraphic" in2="hero-logo-color-mask" operator="in" />
          </filter>
        </defs>
      </svg>

      <div className="mb-4 flex items-center justify-center gap-3">
        <span className="h-px w-8 bg-white/20" />
        <span className="text-[10px] font-semibold tracking-[0.24em] text-white/65 uppercase">
          Churches &amp; ministries
        </span>
        <span className="h-px w-8 bg-white/20" />
      </div>

      <div className="hero-logo-marquee-viewport relative w-full overflow-hidden px-1 pb-7 pt-1">
        <div className="hero-logo-marquee-track flex w-max items-center">
          {[0, 1].map((group) => (
            <div
              key={group}
              className="flex shrink-0 items-center gap-10 px-5 sm:gap-16 sm:px-8"
              aria-hidden={group === 1 ? 'true' : undefined}
            >
              {items.map((item) => (
                <LogoBadge key={`${group}-${item.name}`} item={item} decorative={group === 1} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LogoBadge({ item, decorative }) {
  return (
    <div className="hero-logo-marquee-item group relative flex shrink-0 flex-col items-center">
      <img
        src={item.logo}
        alt={decorative ? '' : item.name}
        title={decorative ? undefined : item.name}
        aria-hidden={decorative ? 'true' : undefined}
        loading="lazy"
        className="hero-logo-marquee-image h-10 w-24 shrink-0 object-contain sm:h-12 sm:w-28"
      />
      <span className="hero-logo-marquee-name" aria-hidden="true">{item.name}</span>
    </div>
  );
}