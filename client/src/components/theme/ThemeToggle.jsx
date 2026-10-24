import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.jsx';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useSettings();
  const shouldReduceMotion = useReducedMotion();
  const isDark = resolvedTheme === 'dark';
  const Icon = isDark ? Moon : Sun;
  const nextTheme = isDark ? 'light' : 'dark';
  const label = `Switch to ${nextTheme} mode`;
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring', stiffness: 520, damping: 34 };

  return (
    <motion.button
      type="button"
      className="theme-toggle"
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      onClick={() => setTheme(nextTheme)}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
      transition={transition}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <motion.span
          className="theme-toggle-thumb"
          animate={{ x: isDark ? 22 : 0 }}
          transition={transition}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              className="theme-toggle-icon"
              key={resolvedTheme}
              initial={shouldReduceMotion ? false : { opacity: 0, rotate: -75, scale: 0.55 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, rotate: 75, scale: 0.55 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
            >
              <Icon size={14} strokeWidth={2.2} />
            </motion.span>
          </AnimatePresence>
        </motion.span>
      </span>
    </motion.button>
  );
}
