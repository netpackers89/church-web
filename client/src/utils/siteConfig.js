/**
 * Central site configuration. Public-facing content that is not (yet) served
 * by the backend lives here so it can be edited in one place. Values may be
 * overridden by Vite env vars at build time.
 */
export const siteConfig = {
  churchName: import.meta.env.VITE_CHURCH_NAME || 'Yeka Abado Mulu Wengel Church',
  churchMonogram: import.meta.env.VITE_CHURCH_MONOGRAM || 'YA',
  tagline: import.meta.env.VITE_CHURCH_TAGLINE || 'A community of faith',
  address: import.meta.env.VITE_CHURCH_ADDRESS || 'Addas, Addis Ababa, Ethiopia',
  phone: import.meta.env.VITE_CHURCH_PHONE || '',
  email: import.meta.env.VITE_CHURCH_EMAIL || 'info@mekaneyesus.org',
  serviceSummary: 'Sunday worship · Bible study · Youth · Fellowship',
  timezone: import.meta.env.VITE_CHURCH_TIMEZONE || 'Africa/Addis_Ababa',
  social: {
    youtube: import.meta.env.VITE_SOCIAL_YOUTUBE || '',
    telegram: import.meta.env.VITE_SOCIAL_TELEGRAM || '',
    facebook: import.meta.env.VITE_SOCIAL_FACEBOOK || '',
  },
};

export default siteConfig;

/* Convenience named exports */
export const churchName = siteConfig.churchName;
export const churchMonogram = siteConfig.churchMonogram;
export const churchTagline = siteConfig.tagline;
export const churchTimezone = siteConfig.timezone;
