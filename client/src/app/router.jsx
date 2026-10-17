import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout.jsx';
import AuthLayout from '../layouts/AuthLayout.jsx';
import MemberLayout from '../layouts/MemberLayout.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';
import OrganizationLayout from '../layouts/OrganizationLayout.jsx';
import ProtectedRoute, { GuestOnlyRoute } from '../components/ProtectedRoute.jsx';
import { canAccessAdminArea, canAccessWorkspace } from './authNavigation.js';


/* Public */
import HomePage from '../pages/public/HomePage.jsx';
import AboutPage from '../pages/public/AboutPage.jsx';
import EventsPage from '../pages/public/EventsPage.jsx';
import ProgramsPage from '../pages/public/ProgramsPage.jsx';
import EventDetailsPage from '../pages/public/EventDetailsPage.jsx';
import MinistriesPage from '../pages/public/MinistriesPage.jsx';
import SermonsPage from '../pages/public/SermonsPage.jsx';
import CampaignsPage from '../pages/public/CampaignsPage.jsx';
import GivePage from '../pages/public/GivePage.jsx';
import ContactPage from '../pages/public/ContactPage.jsx';
import NewChristianPage from '../pages/public/NewChristianPage.jsx';

/* Auth */
import LoginPage from '../pages/auth/LoginPage.jsx';
import RegisterPage from '../pages/auth/RegisterPage.jsx';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage.jsx';

/* Member */
import MemberDashboardPage from '../pages/member/MemberDashboardPage.jsx';
import MyProfilePage from '../pages/member/MyProfilePage.jsx';
import EditProfilePage from '../pages/member/EditProfilePage.jsx';
import AccountSettingsPage from '../pages/member/AccountSettingsPage.jsx';
import MyCalendarPage from '../pages/member/MyCalendarPage.jsx';
import MyEventsPage from '../pages/member/MyEventsPage.jsx';
import BibleStudyGroupsPage from '../pages/bible-study/BibleStudyGroupsPage.jsx';
import BibleStudyDetailsPage from '../pages/bible-study/BibleStudyDetailsPage.jsx';
import GroupAssignmentPage from '../pages/bible-study/GroupAssignmentPage.jsx';
import MyBibleStudyPage from '../pages/bible-study/MyBibleStudyPage.jsx';
import OrganizationsPage from '../pages/organizations/OrganizationsPage.jsx';
import OrganizationDetailsPage from '../pages/organizations/OrganizationDetailsPage.jsx';
import OrganizationDepartmentsPage from '../pages/organizations/OrganizationDepartmentsPage.jsx';
import DepartmentDetailsPage from '../pages/organizations/DepartmentDetailsPage.jsx';
import MyNotificationsPage from '../pages/member/MyNotificationsPage.jsx';
import MyGivingPage from '../pages/member/MyGivingPage.jsx';
import GivingReceiptPage from '../pages/member/GivingReceiptPage.jsx';

/* Admin */
import AdminDashboardPage from '../pages/admin/AdminDashboardPage.jsx';
import MembersPage from '../pages/admin/MembersPage.jsx';
import RolesPermissionsPage from '../pages/admin/RolesPermissionsPage.jsx';
import DepartmentsPage from '../pages/admin/DepartmentsPage.jsx';
import OrganizationsAdminPage from '../pages/admin/OrganizationsAdminPage.jsx';
import EventsManagementPage from '../pages/admin/EventsManagementPage.jsx';
import ProgramLibraryPage from '../pages/admin/ProgramLibraryPage.jsx';
import BibleStudyManagementPage from '../pages/admin/BibleStudyManagementPage.jsx';
import BibleVersesManagementPage from '../pages/admin/BibleVersesManagementPage.jsx';
import CampaignManagementPage from '../pages/admin/CampaignManagementPage.jsx';
import GivingManagementPage from '../pages/admin/GivingManagementPage.jsx';
import ReportsPage from '../pages/admin/ReportsPage.jsx';
import AuditLogsPage from '../pages/admin/AuditLogsPage.jsx';
import WebsiteNotificationsPage from '../pages/admin/WebsiteNotificationsPage.jsx';
import CommunicationTestPanel from '../pages/admin/CommunicationTestPanel.jsx';
import SettingsPage from '../pages/admin/SettingsPage.jsx';
import NewChristianFollowupsPage from '../pages/admin/NewChristianFollowupsPage.jsx';
import TelegramInboxPage from '../pages/admin/TelegramInboxPage.jsx';
import AnnouncementsManagementPage from '../pages/admin/AnnouncementsManagementPage.jsx';
import EmailMessageTemplatesPage from '../pages/admin/EmailMessageTemplatesPage.jsx';
import AdminRegistrationPage from '../pages/admin/AdminRegistrationPage.jsx';

/* Errors */
import NotFoundPage from '../pages/errors/NotFoundPage.jsx';

/** Staff roles allowed into the administration area (nav further scopes items). */

export default function AppRouter() {
  return (
    <Routes>
      {/* Public website */}
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="programs" element={<ProgramsPage />} />
        <Route path="events/:id" element={<EventDetailsPage />} />
        <Route path="ministries" element={<MinistriesPage />} />
        <Route path="sermons" element={<SermonsPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="give" element={<GivePage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="new-christian" element={<NewChristianPage />} />
        <Route path="bible-study" element={<Navigate to="/login" replace />} />
        <Route path="verses" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Authentication */}
      <Route element={<AuthLayout />}>
        <Route path="login" element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
        <Route path="register" element={<GuestOnlyRoute><RegisterPage /></GuestOnlyRoute>} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Member portal */}
      <Route
        path="me"
        element={
          <ProtectedRoute>
            <MemberLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MemberDashboardPage />} />
        <Route path="profile" element={<MyProfilePage />} />
        <Route path="profile/edit" element={<EditProfilePage />} />
        <Route path="account" element={<AccountSettingsPage />} />
        <Route path="calendar" element={<MyCalendarPage />} />
        <Route path="events" element={<MyEventsPage />} />
        <Route path="bible-study" element={<BibleStudyGroupsPage />} />
        <Route path="bible-study/groups/:id" element={<BibleStudyDetailsPage />} />
        <Route path="bible-study/assign" element={<GroupAssignmentPage />} />
        <Route path="bible-study/my-group" element={<MyBibleStudyPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="organizations/:id" element={<OrganizationDetailsPage />} />
        <Route path="organizations/:id/departments" element={<OrganizationDepartmentsPage />} />
        <Route path="departments/:id" element={<DepartmentDetailsPage />} />
        <Route path="notifications" element={<MyNotificationsPage />} />
        <Route path="giving" element={<MyGivingPage />} />
        <Route path="giving/:id/receipt" element={<GivingReceiptPage />} />
      </Route>

      {/* Organization workspaces (scoped leaders) */}
      <Route
        path="organizations/:id/workspace"
        element={
          <ProtectedRoute require={(u, _location, params) => canAccessWorkspace(u, 'organization', params.id)}>
            <OrganizationLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage scoped />} />
      </Route>

      <Route path="departments/:id/workspace" element={<ProtectedRoute require={(u, _location, params) => canAccessWorkspace(u, 'department', params.id)}><OrganizationLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboardPage scoped />} />
      </Route>

      <Route path="bible-study/groups/:id/workspace" element={<ProtectedRoute require={(u, _location, params) => canAccessWorkspace(u, 'bible-study', params.id)}><OrganizationLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboardPage scoped />} />
      </Route>

      {/* Administration */}
      <Route
        path="admin"
        element={
          <ProtectedRoute require={canAccessAdminArea}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="members" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('users.read')}><MembersPage /></ProtectedRoute>} />
        <Route path="staff" element={<Navigate to="/admin/members" replace />} />
        <Route path="new-christians" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('membership.manage')}><NewChristianFollowupsPage /></ProtectedRoute>} />
        <Route path="telegram-inbox" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('telegram.manage')}><TelegramInboxPage /></ProtectedRoute>} />
        <Route path="roles" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('roles.manage')}><RolesPermissionsPage /></ProtectedRoute>} />
        <Route path="permissions" element={<Navigate to="/admin/roles" replace />} />
        <Route path="departments" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('staff.manage')}><DepartmentsPage /></ProtectedRoute>} />
        <Route path="organizations" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('staff.manage')}><OrganizationsAdminPage /></ProtectedRoute>} />
        <Route path="registrations" element={<ProtectedRoute require={(u) => ((u.permissions ?? []).includes('users.create') && (u.permissions ?? []).includes('roles.manage')) || (u.permissions ?? []).includes('staff.manage') || (u.permissions ?? []).includes('programs.manage')}><AdminRegistrationPage /></ProtectedRoute>} />
        <Route path="departments/register" element={<Navigate to="/admin/registrations?type=department" replace />} />
        <Route path="bible-study-groups/register" element={<Navigate to="/admin/registrations?type=bible-study-group" replace />} />
        <Route path="events" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('events.manage')}><EventsManagementPage /></ProtectedRoute>} />
        <Route path="program-library" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('programs.manage')}><ProgramLibraryPage /></ProtectedRoute>} />
        <Route path="bible-study" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('programs.manage')}><BibleStudyManagementPage /></ProtectedRoute>} />
        <Route path="verse" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('bible.publish')}><BibleVersesManagementPage /></ProtectedRoute>} />
        <Route path="banners" element={<Navigate to="/admin/announcements" replace />} />
        <Route path="flyers" element={<Navigate to="/admin/announcements" replace />} />
        <Route path="announcements" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('announcements.manage')}><AnnouncementsManagementPage /></ProtectedRoute>} />
        <Route path="notifications" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('notifications.manage') || (u.permissions ?? []).includes('announcements.manage')}><WebsiteNotificationsPage /></ProtectedRoute>} />
        <Route path="message-templates" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('announcements.manage')}><EmailMessageTemplatesPage /></ProtectedRoute>} />
        <Route path="communications-test" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('notifications.test') || (u.permissions ?? []).includes('system.owner.manage')}><CommunicationTestPanel /></ProtectedRoute>} />
        <Route path="campaigns" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('fundraising_campaigns.view')}><CampaignManagementPage /></ProtectedRoute>} />
        <Route path="giving" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('finance.manage')}><GivingManagementPage /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('reports.read')}><ReportsPage /></ProtectedRoute>} />
        <Route path="audit" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('audit.read')}><AuditLogsPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute require={(u) => (u.permissions ?? []).includes('settings.manage')}><SettingsPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

