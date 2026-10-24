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
  "maritalStatus": "Rather not say",
  "profileImageUrl": "https://i.ibb.co/example/photo.jpg",
  "notifyEmail": true,
  "privacyAccepted": true,
  "role": "ADMIN"
}
```

The three name fields support English and Amharic and are also combined into the legacy `name` field. Send exactly one of `birthDateEc` or `birthDateGregorian`; Ethiopian dates may be supplied as `{ "year": 1997, "month": 1, "day": 5 }`, `1997-01-05`, or `1997 Meskerem 5`. The server validates it, stores both calendar dates, and calculates age using `Africa/Addis_Ababa`. Registration always returns `role: MEMBER`, regardless of any submitted role. Email notification defaults to enabled. Telegram linking is a separate optional post-registration step; registration never accepts a Telegram ID from the browser. A failed welcome notification does not roll back the account.

`maritalStatus` is required and accepts exactly `Single`, `Married`, or `Rather not say`; it is validated on the server and stored in PostgreSQL. An optional `profileImageUrl` must be HTTPS and use a configured approved media host. For device uploads, sign in after registration and send `POST /api/users/me/profile-image` as `multipart/form-data` with an `image` file field (JPG, PNG, WebP, or GIF, maximum 5 MB). The server validates image bytes and uploads through ImgBB using `IMGBB_API_KEY` from `server/.env`; the key is never included in client code. Leave both image inputs empty to use the church-themed avatar fallback.

### Sign in and own profile

- `POST /api/auth/login` with `{ "email", "password" }` sets an HttpOnly `church_session` cookie.
- `POST /api/auth/logout` requires that cookie and revokes its session version in PostgreSQL.
- `GET /api/auth/me` requires the cookie and returns the authenticated identity.
- `GET /api/users/me` returns the signed-in member's profile with age recalculated dynamically; `age` is `null` for staff accounts without a birth date.
- `GET /api/users` returns the member directory to authenticated `ADMIN` users only. It includes account contact/location/status fields, but excludes password hashes, birth dates, and Telegram identifiers. Other authenticated roles receive HTTP 403.
- `PATCH /api/users/me` updates only supplied permitted fields: name, approved `profileImageUrl`, phone, Ethiopian birth date, location, and preferred language (`preferredLanguage` or `preferred_language`). The endpoint rejects protected fields and direct email updates.
- `PATCH /api/users/me/password` accepts `{ "currentPassword", "newPassword" }`.
- `POST /api/users/me/email-change` requires `{ "email", "currentPassword" }`. The current address remains active until the new address is verified.
- `POST /api/users/me/email-change/verify` accepts `{ "token" }`; it is single-use and expires after 30 minutes. The token is never returned by the API.
- `PATCH /api/users/me/notification-preferences` accepts either or both of `{ "notifyEmail": true, "notifyTelegram": false }`.
- `GET /api/public/registration-options` returns the allowed locations, language choices, and Ethiopian month names without private member data.

Unauthenticated profile requests return HTTP 401. Registration, sign-in, and recovery are rate-limited by IP and normalized email. In development, Vite proxies `/api` to the Express server; in deployment, set `WEB_ORIGIN` to the exact frontend origin and serve the API over HTTPS.

Phone changes are validated and checked against the unique phone constraint. Because no SMS provider exists in this project, a changed phone is marked unverified (`phoneVerified: false`) rather than being presented as verified. The profile response includes name parts, `profileImageUrl`, `preferredLanguage`, `emailVerified`, `phoneVerified`, both birth dates, and recalculated `age`; it never includes password hashes, Telegram chat IDs, or verification tokens.

Staff role assignment is available through `POST /api/admin/users/:userId/roles` to users with `roles.manage`. An ADMIN with this permission may grant ADMIN to a non-administrator; only a SYSTEM_OWNER may modify an existing ADMIN or grant SYSTEM_OWNER.

### Telegram account linking

Sign in, request `POST /api/users/me/telegram/link-token`, then open the returned `https://t.me/<bot>?start=<token>` URL and press Start. The response includes the random, single-use token (used only to poll `POST /api/users/me/telegram/link-status`) and its expiry; only its hash is stored in the database. The token is not a database user ID. The bot links the Telegram sender's actual numeric Telegram ID to the user associated with that token. A plain `/start` asks first-time users to choose English, Amharic, or Afaan Oromoo; the selection is persisted on `telegram_accounts` and survives bot restarts. Existing users without a language are asked once, and the bot resumes the pending command or callback when possible. Use the 🌐 language option in the main menu or profile menu to switch languages without unlinking the account. The centralized dictionaries and fallback helper are in `src/telegram/templates/localization.js`; dynamic church and financial records remain unchanged and use their original text when no translated database content exists. Please have a fluent speaker review Amharic and Afaan Oromoo wording before production.

A successful account link shows the welcome card in the selected language. It uses `WELCOME_BANNER_URL` (or `CHURCH_LOGO_URL`) as its photo and falls back to text if Telegram cannot load the image. Inline Website and About buttons use `CHURCH_WEBSITE_URL` and `CHURCH_ABOUT_URL` when set. The bot must be started with `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`. No Telegram credentials are needed for registration or email-only accounts.

- The bot supports `/start`, `/menu`, `/programs`, `/giving`, `/location`, `/fundraising` (also `/campaigns`), `/receipt` (also `/myreceipts`), `/signup`, `/connect`, `/cancel`, and `/help`, plus a persistent localized reply menu. Program dates, published giving methods, active campaign totals, church address, and approved receipts come from PostgreSQL; no sample account numbers or receipt records are sent. Profile and receipt details are available only in a private chat and only after secure account linking.
- The bot's existing payment handoff opens the website giving workflow; it does not collect payment details or evidence in Telegram. Giving submissions, finance review, and printable approved-receipt previews remain in the website workflow. Telegram approval and rejection notifications use the member's saved bot language; financial statuses and database values remain stable internal identifiers.
- Help contact details are optional and use `CHURCH_CONTACT_EMAIL` and `CHURCH_CONTACT_PHONE`; the bot does not invent office contact information.
- If `TELEGRAM_WEBHOOK_URL` is set, configure Telegram to post updates to `/api/telegram/webhook` with `TELEGRAM_WEBHOOK_SECRET`. The same bot commands and callbacks are handled in webhook mode; otherwise the server uses polling.

- `DELETE /api/users/me/telegram` disconnects Telegram, disables Telegram notifications, and invalidates any unused link token for that member. It does not delete the member, giving, or group records.
- `POST /api/users/me/telegram/replace` atomically releases the authenticated member's current Telegram connection and returns a fresh five-minute bot link token. The member must still prove ownership of the replacement account by pressing Start in the bot.
- `POST /api/users/me/telegram/test` sends a real Bot API test message to the authenticated member's currently linked chat; it reports delivery failure rather than a false success.
- When a bot link conflicts with an existing profile, the bot issues a ten-minute recovery URL tied to that Telegram sender. `POST /api/users/me/telegram/recovery/status` verifies the signed-in profile may recover it, and `POST /api/users/me/telegram/recovery/confirm` requires that profile's current password before removing the association and returning a fresh five-minute bot link. Passwords are submitted only to the authenticated website API, never through Telegram.
- A linked member can enable Telegram notifications through the preferences endpoint.

Apply `src/migrations/045_telegram_language_preferences.sql` with `npm run migrate` to add the nullable `language_code` and pending-action fields to existing Telegram accounts. Existing links and accounts are preserved.

The registration profile fields are added by `src/migrations/028_member_registration_profile.sql`.

The API runs at `http://localhost:5000`. PostgreSQL must be installed and running. Create the database named in `PGDATABASE` in pgAdmin, then use that server's host, port, username, and password in `server/.env`.

When using `DATABASE_URL`, its `sslmode` is honored. `sslmode=require` encrypts the connection without verifying the server certificate, matching its standard PostgreSQL meaning; use `sslmode=verify-full` and set `PGSSLROOTCERT` to the provider CA path for production certificate verification. `PGSSL_REJECT_UNAUTHORIZED` can explicitly override certificate verification when required.

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

## Telegram management

The existing Telegram bot and secret-checked `/api/telegram/webhook` remain the single bot and update-processing path. Every `/api/admin/telegram/*` management route requires authentication and `telegram.manage`.

- `GET /api/admin/telegram/overview` returns linked-account, inbox, configured-menu, auto-reply, and webhook-processing counts.
- `GET /api/admin/telegram/connection` calls Telegram `getMe` and `getWebhookInfo`; it returns only public bot identity and sanitized webhook status, never the token or webhook secret.
- `POST /api/admin/telegram/test` sends a real test only to the authenticated administrator's own linked Telegram chat. It is rate-limited and reports API acceptance, not whether the message was read.
- `GET/POST /api/admin/telegram/menu-items`, `PATCH/DELETE /api/admin/telegram/menu-items/:id` manage localized menu buttons. The list also returns the existing slash-command catalog. Migration 052 seeds protected built-in menu actions, which can be translated, reordered, disabled, and republished but not deleted or renamed. Labels require `en`, `am`, and `om`; text actions also require localized responses. Supported actions are `TEXT`, `URL`, `PROFILE`, `GROUPS`, `PROGRAMS`, `GIVING`, `CAMPAIGNS`, `LOCATION`, `CONTACT`, and `HELP`; URL actions accept HTTPS only. Visibility is `EVERYONE` or `LINKED_MEMBER`.
- `GET /api/admin/telegram/messages` returns a paginated categorized inbox with counts and category metadata. It accepts `category`, `status`, `priority`, `assignedTo`, `channel`, `from`, `to`, and `search` filters. Prayer-request and pastoral-support message content is omitted unless the caller has `prayer_requests.view`; replying to those messages additionally requires `prayer_requests.respond`. `PATCH /api/admin/telegram/messages/:id` updates status, category, priority, and assignment. `POST /api/admin/telegram/messages/:id/notes` saves an internal-only staff note. Replies continue through the existing `POST /api/admin/telegram/messages/:id/replies` path and its Telegram delivery log.
- `GET/POST /api/admin/telegram/auto-replies`, `PATCH/DELETE /api/admin/telegram/auto-replies/:id` manage localized keyword rules. Rules support `EXACT` and `CONTAINS` matching, sorted by ascending priority. `POST /api/admin/telegram/auto-replies/preview` tests the first active match without sending a message.

Active database menu buttons, including seeded built-in actions, are shown by the bot's `/menu` command in private chats. Existing slash commands and their handlers remain available. The bot's Contact the Church flow supports category selection, message review, confirmation, cancellation, a reference number, and English/Amharic/Afaan Oromo prompts. Existing inbox messages are retained as uncategorized legacy records; unconfirmed drafts are hidden from the staff inbox. Prayer-request and pastoral-support messages are restricted by the existing prayer permissions. Active auto-replies only run on private-chat text messages and cannot invoke privileged member or finance actions. Apply `src/migrations/051_telegram_management.sql`, `src/migrations/052_telegram_inbox_menu_catalog.sql`, and `src/migrations/053_telegram_contact_idempotency.sql` with `npm run migrate` before deploying the Telegram management pages.

## Community group follows

`GET /api/groups` lists active, publicly visible departments and Bible study groups without exposing member rosters. Every group response includes a `type` (`department` or `bible_study_group`) and an ID; send both when requesting a group-specific action:

- `GET /api/groups/:id?type=department|bible_study_group` returns public group details and only enabled, safe community links.
- `GET /api/groups/:id/follow-status?type=...` requires the signed-in session cookie and returns the current follow state.
- `POST /api/groups/:id/follow?type=...` requires sign-in, records a website follow, and is idempotent for duplicate requests. Its response reports whether Telegram is linked; following on the website never automatically joins an external Telegram group.
- `DELETE /api/groups/:id/follow?type=...` removes that website follow.
- `GET/PATCH /api/groups/:id/notification-preferences?type=...` reads and updates per-channel preferences for a followed group.
- `GET /api/groups/:id/posts?type=...` returns published community posts; signed-in users can like posts and comment.
- `GET /api/groups/:id/programs?type=...` returns upcoming public events assigned to the group; managers can create one with `POST`. Program creation accepts an optional uploaded `imageUrl` and required `idempotencyKey`, and saves the event and its group post in one transaction.
- `PATCH /api/groups/:id/settings?type=...` updates the public group profile and Telegram username/public/invitation links for assigned leaders or administrators.
- `POST /api/groups/:id/posts?type=...` creates a post for an assigned group leader or administrator. Published posts are also sent to the configured public Telegram destination and individual followers; `PATCH` and `DELETE` on `/posts/:postId` are similarly group-scoped.
- `POST /api/groups/:id/posts/:postId/telegram/retry?type=...` retries a failed Telegram delivery without re-sending message parts already confirmed by Telegram.
- `POST /api/groups/:id/media/upload?type=...` accepts one image field named `image` (JPG/PNG/WebP/GIF, max 5 MB) and uploads it through the server to ImgBB.
- `GET /api/groups/:id/management?type=...`, `/management/posts`, and `/followers` require administrator authority or a group-scoped manager assignment. Post management includes Telegram delivery status and a retry action.

Following a department is independent from following a Bible study group, even if the IDs match. A follow does not create department membership or Bible study membership, and opening an external invitation link does not confirm that someone joined the external platform.

Administrators manage each group's community links from the respective administration page. Link updates use `PATCH /api/admin/departments/:id/community-links` with `staff.manage` or `PATCH /api/admin/bible-study-groups/:id/community-links` with `programs.manage`. The JSON body contains a `communityLinks` array with `platform`, `label`, HTTPS `url`, and boolean `enabled` fields. Supported public-link values are `telegram`, `facebook`, and `youtube`; only Telegram is used as an external group-notification destination. Bot publishing requires a public Telegram username/link and bot posting permission. Invitation links are for members to join and cannot be used as Bot API destinations. A destination remains unverified until bot access is confirmed; select `none` when there is no destination. Legacy WhatsApp/other links are not returned publicly or offered for new configuration.

Apply `src/migrations/038_group_community_links.sql` with `npm run migrate` before deploying the link editor or creating groups with community links.

Migrations `039_group_social_interactions.sql`, `040_group_follow_welcome_deliveries.sql`, `041_group_program_events.sql`, and `056_group_telegram_publishing.sql` add post images/categories/publishing states, likes/comments, follow-welcome delivery records, group-targeted events, event idempotency, and Telegram delivery tracking. Apply them with `npm run migrate` before enabling the community feed. Set `IMGBB_API_KEY` on the server to enable group-leader image uploads. Email and Telegram require the existing SMTP configuration and linked Telegram accounts; failed or unavailable deliveries are recorded as `FAILED` or `SKIPPED`.

## Group administration and leader assignment

- `GET /api/admin/group-leader-candidates` returns active registered member/staff accounts for the searchable leader selector. It does not create accounts.
- `PATCH /api/admin/departments/:id` and `PATCH /api/admin/bible-study-groups/:id` update group details and leader assignment. The new leader is added to the corresponding membership table in the same transaction; workspace access is scoped to assigned groups.
- `DELETE /api/admin/departments/:id` (`staff.manage`) and `DELETE /api/admin/bible-study-groups/:id` (`programs.manage`) permanently delete group-exclusive records in a transaction. Shared events, accounts, and cross-linked records are retained; a protected foreign-key dependency returns HTTP 409 and rolls back the deletion.

Migrations `042_member_marital_status.sql`, `043_hide_unused_seed_departments.sql`, and `044_program_recurrence_date_range.sql` respectively add the optional existing-account marital-status field, hide only the complete unused legacy seed-department batch, and add optional weekly recurrence bounds. Review and back up production data before applying `043`; it soft-deletes only seed-batch matches with no checked dependencies.

## Programs and public calendar

- `GET /api/public/events/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` returns published one-time events and scheduled recurring occurrences for the requested range in the church timezone. Dates must be valid and the range cannot exceed 367 days.
- `GET /api/public/program-schedules` returns each active schedule with its next valid occurrence. Weekly schedule entries support optional `recurrence_start_date` and `recurrence_end_date`; public listings display a recurring program once, while the calendar renders each occurrence within its configured range.
- Admin content uses `GET/POST /api/admin/programs`, `PATCH /api/admin/programs/:id`, `GET /api/admin/events`, and the existing protected event create/update/archive routes. Program drafts are inactive until published; recurring schedules are activated/deactivated with their program template.

## Public giving and contribution records

- `GET /api/public/bank-account`, `/api/public/campaigns`, and `/api/public/giving-categories` are public. The giving page uses the configured payment methods and the fixed category codes `ASRATE`, `MEBA`, `BEKURAT_KEDAMYAT`, `MESWAET_KURBAN`, `MISGANA`, `METASABIYA`, `BUILDING_FUND`, `CHARITY_ALMS`, `FIKER_SETOTA`, and `OTHER`.
- Campaign administrators with `finance.manage` can configure up to 20 payment accounts per campaign in `POST /api/campaigns` and `PATCH /api/campaigns/:id`. Public campaign responses include active account details. Removing an account from the submitted list deactivates it; account rows are retained, and contributions keep a payment-provider snapshot and account reference.
- `POST /api/users/me/giving` requires a signed-in member. Regular giving sends `categoryCode`; `OTHER` additionally requires `otherPurpose`. A fundraising contribution sends an active `campaignId` and a `campaignPaymentAccountId` belonging to that campaign. `payerMode` is `SELF` by default or `OTHER`; `OTHER` requires `recipientName` and `recipientPhone`, with an optional existing `recipientMemberId`. The authenticated member remains the submitting payer; client-provided ownership identifiers are not used.
- Payment amount, date, transaction reference, account configuration, active category/campaign, custom purpose, and recipient fields are validated by the server. New contributions begin as `PENDING`; only authorized finance approval can set `APPROVED` and assign a unique sequential receipt number. `GET /api/users/me/giving` returns only the signed-in member's records.
- `GET /api/users/me/giving/:id/receipt` returns receipt details only for an approved contribution owned by the signed-in member. The public giving page provides a printable receipt preview with the browser's print/save-as-PDF action. Approval notifications currently use the configured email/Telegram text-notification channels; server-generated PDF attachment delivery is not provided by this workflow.

Apply `src/migrations/046_giving_purpose_and_recipient.sql` with `npm run migrate` before deploying the updated contribution form.
