import { config } from "../config/env.js";

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

// Circular social icon button (letter on a soft circular background).
function socialIcon(label, url) {
  const href = safeUrl(url);
  if (!href) return "";
  const letter = label.trim().charAt(0).toUpperCase();
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" title="${escapeHtml(label)}" style="display:inline-block;width:34px;height:34px;margin:0 6px;border-radius:50%;background:#eceae2;color:#334b40;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;line-height:34px;text-align:center;text-decoration:none;">${escapeHtml(letter)}</a>`;
}

// Pill-shaped call-to-action button.
function linkButton(label, url, background = "#e9681f") {
  const href = safeUrl(url);
  if (!href) return "";
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:7px 5px;padding:14px 26px;border-radius:30px;background:${background};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;letter-spacing:.2px;text-decoration:none;">${escapeHtml(label)}</a>`;
}

export function createWelcomeEmail(name) {
  const { branding, telegram } = config;
  const churchName = escapeHtml(branding.churchName);
  const recipientName = escapeHtml(name);
  const logoUrl = safeUrl(branding.logoUrl);
  const bannerUrl = safeUrl(branding.bannerUrl);
  const telegramUrl =
    safeUrl(branding.telegramUrl) ??
    (telegram.username ? `https://t.me/${telegram.username}` : null);
  const websiteUrl = safeUrl(branding.websiteUrl);
  const primaryUrl = websiteUrl ?? telegramUrl;
  const primaryLabel = websiteUrl
    ? "Visit our website"
    : "Connect with us on Telegram";
  const verse = escapeHtml(branding.bibleVerse);
  const verseReference = escapeHtml(branding.bibleReference);

  // Secondary action buttons shown beneath the primary button.
  const optionalLinks = [
    ["About us", branding.aboutUrl],
    ["Upcoming programs", branding.programsUrl],
    ["Giving", branding.givingUrl],
  ]
    .map(([label, url]) => linkButton(label, url, "#3c5a48"))
    .join("");

  // Bottom social accounts, including Telegram when configured.
  const socialLinks = [
    ["Facebook", branding.facebookUrl],
    ["Instagram", branding.instagramUrl],
    ["YouTube", branding.youtubeUrl],
    ["Telegram", telegramUrl],
  ]
    .map(([label, url]) => socialIcon(label, url))
    .join("");

  // Top-left logo + church name lockup.
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="42" height="42" alt="${churchName} logo" style="display:inline-block;width:42px;height:42px;object-fit:contain;border:0;vertical-align:middle;">`
    : `<span style="display:inline-block;width:42px;height:42px;border-radius:50%;background:#e9681f;color:#ffffff;font-family:Georgia,serif;font-size:22px;line-height:42px;text-align:center;vertical-align:middle;">&#10013;</span>`;
  const header = `<a href="${escapeHtml(websiteUrl ?? telegramUrl ?? "#")}" style="text-decoration:none;"><span style="display:inline-block;vertical-align:middle;padding-right:12px;">${logo}</span><span style="display:inline-block;vertical-align:middle;color:#3c2f2a;font-family:Georgia,serif;font-size:20px;font-weight:bold;letter-spacing:.3px;">${churchName}</span></a>`;

  // Warm hero. Uses the configured banner, otherwise a built-in warm panel.
  const hero = bannerUrl
    ? `<img src="${escapeHtml(bannerUrl)}" width="600" alt="Welcome to ${churchName}" style="display:block;width:100%;max-width:600px;height:auto;border:0;">`
    : `<div style="padding:56px 28px;background:linear-gradient(180deg,#ffd83d 0%,#ffb02e 55%,#f59331 100%);text-align:center;"><div style="color:#3c2f2a;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">A community rooted in faith</div><div style="padding-top:14px;color:#3c2f2a;font-family:Georgia,serif;font-size:40px;line-height:1.15;">Welcome home</div><div style="padding-top:12px;color:#5a4b40;font-family:Arial,Helvetica,sans-serif;font-size:15px;">Faith, fellowship, and hope for every season</div></div>`;

  const contact = branding.email
    ? `<a href="mailto:${escapeHtml(branding.email)}" style="color:#6b6b6b;text-decoration:underline;">${escapeHtml(branding.email)}</a>`
    : "";

  const text = [
    `Welcome, ${name}!`,
    `Your registration with ${branding.churchName} is complete. We are glad to welcome you into our church family.`,
    "",
    `"${branding.bibleVerse}"`,
    branding.bibleReference,
    "",
    primaryUrl ? `${primaryLabel}: ${primaryUrl}` : "",
    branding.aboutUrl ? `About us: ${branding.aboutUrl}` : "",
    branding.programsUrl ? `Upcoming programs: ${branding.programsUrl}` : "",
    branding.givingUrl ? `Giving: ${branding.givingUrl}` : "",
    telegramUrl ? `Telegram: ${telegramUrl}` : "",
    branding.email ? `Contact: ${branding.email}` : "",
    "",
    `With love and prayers,\n${branding.churchName}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>Welcome to ${churchName}</title></head>
<body style="margin:0;padding:24px 10px;background:#faf9f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Welcome to ${churchName} — your registration is complete.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #eeece6;">
<tr><td style="padding:26px 34px;text-align:left;">${header}</td></tr>
<tr><td>${hero}</td></tr>
<tr><td style="padding:38px 40px 8px;color:#3c2f2a;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.75;"><h1 style="margin:0 0 14px;color:#3c2f2a;font-family:Georgia,serif;font-size:30px;font-weight:normal;line-height:1.2;">Welcome, ${recipientName}!</h1><p style="margin:0;">Your registration with ${churchName} is complete. We are grateful to welcome you into our church family — may this be a place where you grow in faith, friendship, and hope.</p></td></tr>
<tr><td style="padding:28px 40px 4px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbf3dd;border-radius:14px;"><tr><td style="padding:26px 28px;text-align:center;color:#5a4630;font-family:Georgia,serif;font-size:19px;font-style:italic;line-height:1.6;">&ldquo;${verse}&rdquo;<div style="padding-top:12px;color:#9a7b46;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-style:normal;letter-spacing:1px;text-transform:uppercase;">${verseReference}</div></td></tr></table></td></tr>
<tr><td style="padding:24px 34px 10px;text-align:center;">${linkButton(primaryLabel, primaryUrl)}${optionalLinks}</td></tr>
<tr><td style="padding:6px 40px 8px;color:#6b6b6b;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;text-align:center;">Questions or need prayer? Reach us at ${contact}</td></tr>
<tr><td style="padding:18px 30px 26px;border-top:1px solid #eeece6;text-align:center;"><div style="padding:14px 0 12px;">${socialLinks || '<span style="color:#b3ada1;font-family:Arial,Helvetica,sans-serif;font-size:12px;">Follow us on social media.</span>'}</div><div style="color:#b3ada1;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;">With love and prayers,<br>${churchName}</div></td></tr>
</table>
</body></html>`;

  return { subject: `Welcome to ${branding.churchName}`, text, html };
}

export function createNewChristianWelcomeEmail(name) {
  const { branding, telegram } = config;
  const churchName = escapeHtml(branding.churchName);
  const recipientName = escapeHtml(name);
  const websiteUrl = safeUrl(branding.websiteUrl);
  const telegramUrl =
    safeUrl(branding.telegramUrl) ??
    (telegram.username ? `https://t.me/${telegram.username}` : null);

  const text = [
    `Dear ${name},`,
    `Thank you for sharing this important step with us. We are happy to welcome you and would love to support you through prayer, fellowship, and spiritual guidance.`,
    "",
    `Our authorized follow-up team will contact you using your preferred method and will walk with you as you grow in faith.`,
    "",
    websiteUrl ? `Website: ${websiteUrl}` : "",
    telegramUrl ? `Telegram: ${telegramUrl}` : "",
    "",
    `With love and prayers,`,
    branding.churchName,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to Your New Journey of Faith</title></head><body style="margin:0;padding:24px 10px;background:#f7f4ee;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #efe9df;overflow:hidden;"><tr><td style="padding:28px 30px 18px;"><div style="color:#3c2f2a;font-family:Georgia,serif;font-size:25px;font-weight:bold;">${churchName}</div></td></tr><tr><td style="padding:0 30px 12px;color:#3f352d;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.75;"><p style="margin:0 0 14px;">Dear ${recipientName},</p><p style="margin:0 0 14px;">Thank you for sharing this important step with us. We are happy to welcome you and would love to support you through prayer, fellowship, and spiritual guidance.</p><p style="margin:0 0 14px;">Our authorized follow-up team will contact you using your preferred method and will walk with you as you grow in faith.</p></td></tr><tr><td style="padding:14px 30px 30px;text-align:center;"><div style="display:inline-block;padding:14px 22px;border-radius:999px;background:#e9681f;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-weight:bold;text-decoration:none;">${escapeHtml(branding.churchName)}</div></td></tr></table></body></html>`;

  return {
    subject: "Welcome to Your New Journey of Faith",
    text,
    html,
  };
}
