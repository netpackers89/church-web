
# Church Digital Platform: Project Goals

## 1. Project Overview

Improve my existing Church Digital Platform using the current codebase.

The platform must support:
- Church administrators
- Church members and new Christians
- Staff members
- Department leaders
- Bible study leaders
- Public visitors

Build a modern, secure, responsive church management platform with working frontend, backend, database, authentication, permissions, and notifications.

**Important:** Inspect the existing project before making changes. Preserve working functionality, existing data, API contracts, and database relationships.

## 2. Technology Requirements

- Frontend: React with JavaScript
- Styling: Vanilla CSS
- Backend: Node.js and Express
- Database: PostgreSQL
- Authentication: Reuse the existing authentication system
- Notifications: Reuse configured email and Telegram integrations
- Media: Reuse the existing upload system

Do not introduce TypeScript.

Do not rebuild the entire project when a focused improvement is sufficient.

## 3. Administration Layout

Create a consistent, responsive administration layout.

### Top navigation
- Church logo and name
- Sidebar toggle
- Global registration (+) button
- Notifications
- User profile and settings

### Sidebar

Organize navigation as follows:

1. Dashboard
2. Members
3. Departments & Bible Study
   - Departments
   - Bible Study Groups
4. Programs
   - All Programs
   - Regular Programs
   - Special Events
   - Announcements
5. Financials
   - Giving Accounts
   - Giving Transactions
   - Fundraising Campaigns
   - Financial Reports
6. Communications
   - Announcements
   - Email Templates
   - Telegram Inbox
   - Notification History
7. System
   - Roles & Permissions
   - Audit Log
   - Settings

Remove Organizations from the requested navigation and registration interface. Do not create a separate Flyers menu.

The global registration menu must contain:
- Register Member
- Register New Christian
- Register Staff
- Register Department
- Register Bible Study Group

## 4. Dashboard

Create a clean dashboard with:

- Total active members
- New Christians and follow-up status
- Upcoming events and regular programs
- A line chart using real database-backed activity data
- A department overview displaying five departments at a time, with pagination
- Recent programs and announcements
- Quick administrative actions

Do not invent chart values, member counts, or financial statistics.

Use real data from the backend. If data is unavailable, display a clear empty state.

## 5. Members Management

Create a functional members page with:

- Search by name, email, and phone
- Filters for member type, status, location, and registration date where supported
- Member profile and contact details
- New Christian classification
- Department and Bible study memberships
- Role assignment
- Permission management for authorized administrators
- Edit, deactivate, and reactivate actions
- Safe deletion where appropriate

Use server-side pagination if the project needs it.

Protect member information with proper authorization.

## 6. Departments Management

Create a dedicated Departments page.

Department records should support:
- Department name
- Category or age group
- Description
- Assigned leader
- Logo and banner
- Public or private visibility
- Active status
- Members
- Posts and events
- Official Telegram or social links

Allow authorized administrators to create, edit, view, activate, deactivate, and manage departments.

When a department is selected, display its information and posts as clean cards.

Department leaders must only manage their assigned departments unless they have broader permissions.

## 7. Bible Study Management

Create a dedicated Bible Study Groups page.

Each group should support:
- Group name
- Description
- Assigned leader or facilitator
- Contact information
- Location and map link
- Gathering schedule
- Current Bible study topic
- Member capacity
- Logo or profile image
- Banner
- Public or private visibility
- Active status
- Study materials
- Posts and reflections
- Official Telegram links

Allow administrators to create and manage groups.

Use existing registered members or staff when assigning leaders. Avoid creating duplicate accounts.

## 8. Group Leader Workspaces

Create role-aware workspaces for department and Bible study leaders.

### Department Management
- Dashboard
- Members
- Posts
- Department Events
- Settings

### Bible Study Management
- Dashboard
- Members
- Posts and Reflections
- Gatherings and Study Materials
- Settings

Show the relevant management link in the user's profile dropdown when they lead an assigned group.

Enforce permissions on the backend, not just by hiding frontend buttons.

## 9. Public and Member Group Pages

Allow visitors and members to discover public departments and Bible study groups.

Display:
- Logo and banner
- Group name and description
- Public leader information
- Schedule and location when public
- Study topic where relevant
- Upcoming events or gatherings
- Public posts
- Official social media and Telegram links
- Join or follow action

After a successful join, show an internal confirmation and optionally send an email.

Do not claim the user has joined a Telegram group just because they joined the website group. Provide the official Telegram link or joining instructions.

Prevent duplicate memberships and respect private-group settings.

Only implement likes, comments, replies, bookmarks, and RSVP features when they have real backend persistence.

## 10. Programs and Events

Create a responsive program grid with landscape cards.

Each card should display:
- Thumbnail
- Program category
- Title and description
- Date and time
- Location
- Publication status
- Authorized actions

Support:
- Regular Programs
- Special Events
- Announcements
- Conferences and revival programs where supported

### Create/Edit Program Form

Organize the form into sections:

1. Program details
2. Date, time, and location
3. Recurrence settings
4. Cancellation or postponement of a specific occurrence
5. Thumbnail upload or image URL
6. Target audience
7. Email and Telegram broadcast settings
8. Public visibility and homepage display

Use a large modal on desktop and a full-screen form on mobile.

Keep the form footer accessible while scrolling.

### Save Draft

Implement a working Save Draft button.

- Persist drafts through the backend and database.
- Restore saved draft data when reopened.
- Preserve entered data after validation errors.
- Warn users before discarding unsaved changes.
- Prevent duplicate submissions.
- Keep draft status separate from published status.

### Recurring Programs

Support recurring services such as Sunday worship, weekly prayer, and other regular church programs.

Use the existing recurrence model where available. Cancelling or postponing one occurrence must not accidentally delete the entire recurring series.

## 11. Financial Management

Create separate pages for:

### Giving Accounts
Support:
- Provider or bank
- Account holder
- Account number or merchant ID
- Account purpose
- Logo
- Active status
- Edit actions

### Giving Transactions
Support:
- Transaction reference
- Amount and currency
- Giving method
- Date
- Submitted receipt or evidence
- Verification status
- Reviewer and review date

Only authorized finance users can approve or reject transactions.

An uploaded receipt is not proof of successful payment by itself. Do not mark transactions verified without the required review or a real provider integration.

### Fundraising Campaigns
Support:
- Campaign title
- Description
- Banner and thumbnail
- Fundraising target
- Start and end dates
- Linked giving accounts
- Campaign status
- Verified contributions
- Progress indicator

Calculate progress from verified contributions, not pending or rejected transactions.

### Financial Reports
Show real income, approved contributions, campaign progress, and transaction summaries according to the user's permissions.

## 12. Communications

Reuse the existing email and Telegram systems.

Support:
- Email templates
- Telegram notifications
- Announcements
- Program reminders
- New member welcome messages
- Group announcements
- Delivery history
- Failure status
- Authorized retries

Make test messages distinct from real broadcasts.

Never report a message as delivered unless the integration confirms success.

Do not expose bot tokens, email credentials, or other secrets to ordinary users.

## 13. Member and Staff Registration

### Regular Member
Register members with the fields supported by the existing database, such as name, contact information, location, profile photo, and status.

### New Christian
Treat a New Christian as a member with a distinct classification and follow-up information, not as a duplicate account.

Support relevant fields such as baptism status, discipleship stage, mentor, and registration details.

Send a secure, time-limited activation link so the user can set a permanent password. Prefer this to emailing a plaintext password.

### Staff
Support:
- Personal details
- Assigned role
- Relevant department
- Profile photo
- Active status
- Permission assignment based on role

Use secure, single-use activation links and require permanent password setup.

## 14. Authentication and Permissions

Implement role-based access control using the existing architecture.

- Administrators manage users, roles, permissions, and system settings.
- Finance staff access only authorized financial workflows.
- Social media or communications staff manage permitted announcements.
- Department leaders manage only their assigned departments.
- Bible study leaders manage only their assigned groups.
- Members access their own profile and permitted member features.
- Visitors only access public content.

Check permissions on every protected Express endpoint.

Do not rely on frontend navigation restrictions as security.

Use password hashing, secure token handling, server-side validation, and audit logs for sensitive operations.

## 15. Account Settings

Provide organized settings for:
- Profile
- Password and security
- Light and dark theme
- Email preferences
- Telegram connection
- Notification preferences
- Group-specific settings for authorized leaders

## 16. Design System

Build a modern, minimalist, professional SaaS interface.

### Light theme
- Background: #F8FAFC
- Cards: #FFFFFF
- Hover surface: #F1F5F9
- Borders: #E2E8F0
- Primary text: #0F172A
- Secondary text: #64748B
- Primary accent: #6366F1
- Accent hover: #4F46E5
- Success: #10B981
- Warning: #F59E0B
- Danger: #EF4444

### Dark theme
- Background: #0F172A
- Cards: #1E293B
- Hover surface: #334155
- Primary text: #F8FAFC
- Secondary text: #94A3B8
- Primary accent: #818CF8
- Accent hover: #6366F1
- Success: #34D399
- Warning: #FBBF24
- Danger: #F87171

Use reusable CSS variables and existing theme infrastructure.

Ensure readable typography, consistent spacing, accessible controls, keyboard navigation, visible focus states, and responsive layouts.

Avoid excessive gradients, unnecessary animations, clutter, and oversized decorative elements.

## 17. Engineering Rules for GitHub Copilot

Before editing:
1. Inspect the project structure.
2. Read relevant frontend and backend files.
3. Identify existing routes, components, database tables, and permissions.
4. Check existing integrations and environment configuration.
5. Create a concise implementation plan for complex changes.

During implementation:
- Reuse existing components and patterns.
- Use JavaScript, not TypeScript.
- Do not invent database fields or API routes without checking the code.
- Create safe migrations when schema changes are necessary.
- Implement real database persistence.
- Add server-side validation and authorization.
- Handle loading, empty, success, and error states.
- Make forms responsive and preserve user input on failure.
- Keep existing features working.
- Never hardcode secrets.
- Do not use mock data to pretend a feature is complete.
- Do not leave nonfunctional buttons.
- Avoid broad rewrites when a targeted change is enough.

After implementation:
1. Run relevant tests, linting, and build checks.
2. Review imports, routes, API contracts, and permission checks.
3. Check desktop, tablet, and mobile layouts.
4. Verify light and dark themes.
5. Report files changed and features implemented.
6. State which checks were run and identify any remaining limitations.

## 18. Recommended Implementation Order

1. Inspect and document the existing architecture.
2. Establish the shared design system and admin layout.
3. Improve dashboard and members.
4. Implement department and Bible study management.
5. Build group leader workspaces and public/member group pages.
6. Implement programs, recurring schedules, occurrence overrides, and Save Draft.
7. Implement giving accounts, transaction review, campaigns, and reports.
8. Integrate email, Telegram, and reminders.
9. Improve account settings, security, accessibility, and responsive behavior.
10. Run regression checks.

## 19. Definition of Done

A feature is complete only when:
- It fits the existing project architecture.
- Required data persists through the real backend and database.
- Backend permissions are enforced.
- Validation and error handling work.
- Loading, empty, and success states are clear.
- The UI works on desktop, tablet, and mobile.
- Light and dark themes remain consistent.
- Existing functionality has not been unnecessarily broken.
- Relevant checks have been run.
- Any unfinished work is clearly documented.

## Final Instruction

Build one cohesive church platform with clear navigation, real data, secure permissions, reliable communication, and simple workflows for administrators, leaders, members, and visitors.

Prioritize correctness, usability, accessibility, and maintainability over unnecessary features or visual effects.
