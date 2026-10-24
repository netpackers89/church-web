import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(currentDirectory, '../../.env') });

const port = Number(process.env.PORT ?? process.env.port ?? 5000);
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const webOrigins = [...new Set([
    webOrigin,
    'http://localhost:5173',
    ...(process.env.WEB_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
])];
const cookieSameSite = (process.env.COOKIE_SAME_SITE
    ?? (process.env.NODE_ENV === 'production' ? 'none' : 'lax')).toLowerCase();
const bundledChurchLogoUrl = new URL('/mulu%20wengel%20logo.png', webOrigin).href;
const pgSslValue = process.env.PGSSL?.toLowerCase();
const pgSslRejectUnauthorizedValue = process.env.PGSSL_REJECT_UNAUTHORIZED?.toLowerCase();

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port number.');
}
if (!['strict', 'lax', 'none'].includes(cookieSameSite)) {
    throw new Error('COOKIE_SAME_SITE must be strict, lax, or none.');
}

export const config = {
    port,
    webOrigin,
    webOrigins,
    cookieSameSite,
    jwtSecret: process.env.JWT_SECRET,
    telegramWebhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    churchTimezone: process.env.CHURCH_TIMEZONE ?? 'Africa/Addis_Ababa',
    smtp: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: String(process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true',
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASS,
        from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
        to: process.env.EMAIL_TO,
    },
    telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
        username: process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, ''),
        sendStartupConfirmation: String(process.env.TELEGRAM_SEND_STARTUP_CONFIRMATION ?? 'false').toLowerCase() === 'true',
    },
    imgbbApiKey: process.env.IMGBB_API_KEY,
    branding: {
        churchName: process.env.CHURCH_NAME ?? 'Yeka Abado Mulu Wengel Church',
        logoUrl: process.env.CHURCH_LOGO_URL ?? bundledChurchLogoUrl,
        bannerUrl: process.env.WELCOME_BANNER_URL,
        websiteUrl: process.env.CHURCH_WEBSITE_URL,
        aboutUrl: process.env.CHURCH_ABOUT_URL,
        programsUrl: process.env.CHURCH_PROGRAMS_URL,
        givingUrl: process.env.CHURCH_GIVING_URL,
        email: process.env.CHURCH_CONTACT_EMAIL,
        phone: process.env.CHURCH_CONTACT_PHONE,
        facebookUrl: process.env.CHURCH_FACEBOOK_URL,
        instagramUrl: process.env.CHURCH_INSTAGRAM_URL,
        youtubeUrl: process.env.CHURCH_YOUTUBE_URL,
        telegramUrl: process.env.CHURCH_TELEGRAM_URL,
        bibleVerse: process.env.WELCOME_BIBLE_VERSE
            ?? 'Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.',
        bibleReference: process.env.WELCOME_BIBLE_REFERENCE ?? 'Romans 15:13 (KJV)',
    },
    database: {
        production: process.env.NODE_ENV === 'production',
        url: process.env.DATABASE_URL,
        host: process.env.PGHOST ?? '127.0.0.1',
        port: Number(process.env.PGPORT ?? 5432),
        name: process.env.PGDATABASE ?? 'church_notifications',
        user: process.env.PGUSER ?? 'postgres',
        password: process.env.PGPASSWORD,
        ssl: pgSslValue == null ? true : pgSslValue === 'true', // Default to true if not specified
        // FIX: Allow overriding sslRejectUnauthorized via environment variable even in production
        sslRejectUnauthorized: pgSslRejectUnauthorizedValue === 'false' 
            ? false 
            : (pgSslRejectUnauthorizedValue === 'true' ? true : (process.env.NODE_ENV !== 'production')),
        sslRootCert: process.env.PGSSLROOTCERT,
    },
    adminApiKey: process.env.ADMIN_API_KEY,
    mediaAllowedHosts: (process.env.MEDIA_ALLOWED_HOSTS ?? 'i.ibb.co')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
};