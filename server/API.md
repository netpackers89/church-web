# Notification API

## Member registration and profile (Part 1)

The account routes use the existing PostgreSQL pool and an HttpOnly, SameSite=Lax session cookie. The `users` and `telegram_link_tokens` tables are added by an additive SQL migration; the existing `notification_recipients` table is left unchanged.

### Setup

1. Configure PostgreSQL and `JWT_SECRET` in `server/.env`. Generate the session secret with `openssl rand -base64 48`; keep the generated value private and do not commit `.env`.
2. Set `WEB_ORIGIN=http://localhost:5173` and `CHURCH_TIMEZONE=Africa/Addis_Ababa` for local development.
3. From `server/`, run `npm run migrate`, then `npm run dev`.
4. In another terminal, from `client/`, run `npm run dev` and open the Vite URL.

The migration runner records applied files in `schema_migrations` and runs each migration in a transaction. It is safe to run `npm run migrate` more than once. Back up the database before applying migrations in a production environment.

### Public registration

`POST /api/auth/register` accepts JSON. It always creates an active `MEMBER`; any submitted `role` is ignored. Passwords are bcrypt-hashed, duplicate email/phone values are rejected, and the password hash is never returned.

```json
{
  "firstName": "Amanuel",
  "fatherName": "Desta",
  "grandfatherName": "Bekele",
  "email": "amanuel@example.com",
  "phone": "+251912345678",
  "password": "a-long-private-passphrase",
  "confirmPassword": "a-long-private-passphrase",
  "birthDateEc": { "year": 1990, "month": 1, "day": 1 },
  "location": "Tafo Adebabaye",
  "notifyEmail": true,
  "privacyAccepted": true,
  "role": "ADMIN"
}
```

The three name fields support English and Amharic and are also combined into the legacy `name` field. Send exactly one of `birthDateEc` or `birthDateGregorian`; the server validates it, stores both calendar dates, and calculates age using `Africa/Addis_Ababa`. Registration always returns `role: MEMBER`, regardless of any submitted role. Email notification defaults to enabled. Telegram linking is a separate optional post-registration step; registration never accepts a Telegram ID from the browser. A failed welcome notification does not roll back the account.

An optional `profileImageUrl` must be HTTPS and use a configured approved media host. For device uploads, sign in after registration and send `POST /api/users/me/profile-image` as `multipart/form-data` with an `image` file field (JPG, PNG, WebP, or GIF, maximum 5 MB). The server validates image bytes and uploads through ImgBB using `IMGBB_API_KEY` from `server/.env`; the key is never included in client code. Leave both image inputs empty to use the church-themed avatar fallback.

### Sign in and own profile

- `POST /api/auth/login` with `{ "email", "password" }` sets an HttpOnly `church_session` cookie.
- `POST /api/auth/logout` requires that cookie and revokes its session version in PostgreSQL.
- `GET /api/auth/me` requires the cookie and returns the authenticated identity.
- `GET /api/users/me` returns the signed-in member's profile with age recalculated dynamically.
- `GET /api/users` returns the member directory to authenticated `ADMIN` users only. It includes account contact/location/status fields, but excludes password hashes, birth dates, and Telegram identifiers. Other authenticated roles receive HTTP 403.
- `PATCH /api/users/me` updates only supplied permitted fields: name, approved `profileImageUrl`, phone, Ethiopian birth date, location, and preferred language (`preferredLanguage` or `preferred_language`). The endpoint rejects protected fields and direct email updates.
- `PATCH /api/users/me/password` accepts `{ "currentPassword", "newPassword" }`.
- `POST /api/users/me/email-change` requires `{ "email", "currentPassword" }`. The current address remains active until the new address is verified.
- `POST /api/users/me/email-change/verify` accepts `{ "token" }`; it is single-use and expires after 30 minutes. The token is never returned by the API.
- `PATCH /api/users/me/notification-preferences` accepts either or both of `{ "notifyEmail": true, "notifyTelegram": false }`.
- `GET /api/public/registration-options` returns the allowed locations, language choices, and Ethiopian month names without private member data.

Unauthenticated profile requests return HTTP 401. Registration, sign-in, and recovery are rate-limited by IP and normalized email. In development, Vite proxies `/api` to the Express server; in deployment, set `WEB_ORIGIN` to the exact frontend origin and serve the API over HTTPS.

Phone changes are validated and checked against the unique phone constraint. Because no SMS provider exists in this project, a changed phone is marked unverified (`phoneVerified: false`) rather than being presented as verified. The profile response includes name parts, `profileImageUrl`, `preferredLanguage`, `emailVerified`, `phoneVerified`, both birth dates, and recalculated `age`; it never includes password hashes, Telegram chat IDs, or verification tokens.

### Telegram account linking

Sign in, request `POST /api/users/me/telegram/link-token`, then open the returned `https://t.me/<bot>?start=<token>` URL and press Start. The start payload is a random, single-use, 10-minute token stored only as a hash; it is not a database user ID. The bot links the Telegram sender's actual private-chat ID to the user associated with that token. A plain `/start` shows the church welcome card; a successful link shows the same card with a connected confirmation. It uses `WELCOME_BANNER_URL` (or `CHURCH_LOGO_URL`) as its photo and falls back to text if Telegram cannot load the image. Inline Website and About buttons use `CHURCH_WEBSITE_URL` and `CHURCH_ABOUT_URL` when set. The bot must be started with `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`. No Telegram credentials are needed for registration or email-only accounts.

- `DELETE /api/users/me/telegram` disconnects Telegram and disables Telegram notifications.
- A linked member can enable Telegram notifications through the preferences endpoint.

The registration profile fields are added by `src/migrations/028_member_registration_profile.sql`.

The API runs at `http://localhost:5000`. PostgreSQL must be installed and running. Create the database named in `PGDATABASE` in pgAdmin, then use that server's host, port, username, and password in `server/.env`.

Member accounts are created through `POST /api/auth/register`, not through notification-recipient endpoints. The legacy `POST /api/notifications/register` and `GET /api/notifications/recipients` routes have been removed. Authenticated administrators use `GET /api/users` to list member accounts; regular members receive HTTP 403. The older `notification_recipients` storage may still be used for targeted notification operations, but it is not the source of website member accounts.

## Send to recipients

`POST /api/notifications/send`

Requires `Authorization: Bearer <ADMIN_API_KEY>` and `Content-Type: application/json`. Target one or more database IDs, or everyone assigned to one group. The request must contain exactly one of `recipientIds` and `groupName`.

Send to specific people:

```json
{
  "recipientIds": [1, 2],
  "subject": "Sunday service update",
  "message": "Hello {{name}}, Sunday service begins at 10:00 AM.",
  "channels": ["email", "telegram"]
}
```

Send to a group:

```json
{
  "groupName": "youth",
  "message": "Hello {{name}}, the youth meeting is this Friday."
}
```

`subject` is optional and used for email. `channels` is optional; when omitted, both supported channels are attempted wherever the recipient has that destination. `{{name}}` is replaced separately for each recipient. Delivery failures are returned per recipient and channel.

## Health and provider status

- `GET /health` checks that the HTTP server is responding.
- `GET /api/notifications/status` reports the email and Telegram startup test status.