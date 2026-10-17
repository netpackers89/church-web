import axios from 'axios';

/**
 * Centralized Axios client.
 * - Base URL comes from VITE_API_BASE_URL (public config only).
 * - Credentials (HttpOnly session cookie) are sent with every request.
 * - The server never issues tokens to the browser; authentication is the
 *   `church_session` cookie, so nothing sensitive is stored in localStorage.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Error thrown when a requested feature has no backend endpoint yet (HTTP 404/501). */
export class EndpointNotAvailableError extends Error {
  constructor(message = 'This feature is not connected to the server yet.') {
    super(message);
    this.name = 'EndpointNotAvailableError';
    this.status = 404;
    this.endpointMissing = true;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const payload = error.response?.data ?? {};
    const message = payload.error || payload.message || error.message || 'The request could not be completed.';
    const enhanced = new Error(message);
    enhanced.status = status;
    enhanced.response = error.response;
    // Treat 404/501/405 on API feature routes as "endpoint not implemented".
    if (status === 404 || status === 501 || status === 405) {
      enhanced.endpointMissing = true;
    }
    throw enhanced;
  },
);

/** Normalize a backend envelope into the useful data payload. */
export function unwrap(response) {
  const body = response?.data;
  if (body && typeof body === 'object' && ('data' in body || 'user' in body)) {
    return body.data ?? body.user ?? body;
  }
  return body;
}

/* ----------------------------- Auth ----------------------------- */
export const authService = {
  login: (payload) => apiClient.post('/auth/login', payload),
  register: (payload) => apiClient.post('/auth/register', payload),
  forgotPassword: (payload) => apiClient.post('/auth/forgot-password', payload),
  verifyResetOtp: (payload) => apiClient.post('/auth/verify-reset-otp', payload),
  resetPassword: (payload) => apiClient.post('/auth/reset-password', payload),
  keepCurrentPassword: (payload) => apiClient.post('/auth/keep-current-password', payload),
  logout: () => apiClient.post('/auth/logout'),
  identity: () => apiClient.get('/auth/me'),
};

/* ----------------------------- Users ---------------------------- */
export const userService = {
  profile: () => apiClient.get('/users/me'),
  updateProfile: (payload) => apiClient.patch('/users/me', payload),
  uploadProfileImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return apiClient.post('/users/me/profile-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  updatePassword: (payload) => apiClient.patch('/users/me/password', payload),
  requestEmailChange: (payload) => apiClient.post('/users/me/email-change', payload),
  verifyEmailChange: (token) => apiClient.post('/users/me/email-change/verify', { token }),
  updateNotificationPreferences: (payload) => apiClient.patch('/users/me/notification-preferences', payload),
  telegramLinkToken: () => apiClient.post('/users/me/telegram/link-token'),
  telegramLinkStatus: (token) => apiClient.post('/users/me/telegram/link-status', { token }),
  telegramUnlink: () => apiClient.delete('/users/me/telegram'),
  directory: () => apiClient.get('/users'),
  notifications: () => apiClient.get('/users/me/notifications'),
  markNotificationRead: (id) => apiClient.patch(`/users/me/notifications/${id}/read`),
  myGiving: () => apiClient.get('/users/me/giving'),
  myReceipt: (id) => apiClient.get(`/users/me/giving/${id}/receipt`),
  submitGiving: (payload) => apiClient.post('/users/me/giving', payload),
};

/* --------------------------- Public ----------------------------- */
/**
 * Public (unauthenticated) API surface. Routes marked as pending are the
 * intended contract; until the backend implements them they return 404, which
 * the client flags as `endpointMissing` so pages render a graceful empty state
 * rather than fabricated data. See BACKEND_DEPENDENCIES.md.
 */
export const publicService = {
  registrationOptions: () => apiClient.get('/public/registration-options'),
  newChristian: (payload) => apiClient.post('/public/new-christian', payload),
  newChristianTelegramLinkToken: (payload) => apiClient.post('/public/new-christian/telegram/link-token', payload),
  newChristianTelegramStatus: (payload) => apiClient.post('/public/new-christian/telegram/status', payload),
  events: (params) => apiClient.get('/public/events', { params }),
  upcomingEvents: (params) => apiClient.get('/public/events', { params: { upcoming: true, ...params } }),
  programSchedules: () => apiClient.get('/public/program-schedules'),
  nextGathering: () => apiClient.get('/public/events/next-gathering'),
  event: (id) => apiClient.get(`/public/events/${id}`),
  bibleStudyGroups: (params) => apiClient.get('/public/bible-study-groups', { params }),
  bibleStudyGroup: (id) => apiClient.get(`/public/bible-study-groups/${id}`),
  campaigns: () => apiClient.get('/public/campaigns'),
  bankAccount: () => apiClient.get('/public/bank-account'),
  givingCategories: () => apiClient.get('/public/giving-categories'),
  sermons: (params) => apiClient.get('/public/sermons', { params }),
  announcements: () => apiClient.get('/public/announcements'),
  dailyVerse: () => apiClient.get('/public/verse'),
  verses: (params) => apiClient.get('/public/verses', { params }),
  banners: () => apiClient.get('/public/banners'),
  ministries: () => apiClient.get('/public/ministries'),
  organizations: () => apiClient.get('/public/organizations'),
  organization: (id) => apiClient.get(`/public/organizations/${id}`),
  organizationDepartments: (id) => apiClient.get(`/public/organizations/${id}/departments`),
  department: (id) => apiClient.get(`/public/departments/${id}`),
  partners: () => apiClient.get('/public/partners'),
  contact: (payload) => apiClient.post('/public/contact', payload),
};

export const adminService = {
  newChristianFollowups: (params) => apiClient.get('/admin/new-christian-followups', { params }),
  followupAssignees: () => apiClient.get('/admin/new-christian-followups/assignees'),
  followupLinkCandidates: (id, params) => apiClient.get(`/admin/new-christian-followups/${id}/link-candidates`, { params }),
  linkFollowupToMember: (id, userId) => apiClient.post(`/admin/new-christian-followups/${id}/link-member`, { userId }),
  updateNewChristianFollowup: (id, payload) => apiClient.patch(`/admin/new-christian-followups/${id}`, payload),
  retryNewChristianWelcome: (id, channel) => apiClient.post(`/admin/new-christian-followups/${id}/retry-welcome`, { channel }),
  retryMemberWelcome: (userId, channel) => apiClient.post(`/admin/users/${userId}/retry-welcome`, { channel }),
  roles: () => apiClient.get('/admin/roles'),
  departments: () => apiClient.get('/admin/departments'),
  bibleStudyGroups: () => apiClient.get('/admin/bible-study-groups'),
  createDepartment: (payload) => apiClient.post('/admin/departments', payload),
  organizations: () => apiClient.get('/admin/organizations'),
  createOrganization: (payload) => apiClient.post('/admin/organizations', payload),
  announcements: (params) => apiClient.get('/admin/announcements', { params }),
  programs: () => apiClient.get('/admin/programs'),
  events: (params) => apiClient.get('/admin/events', { params }),
  createEvent: (payload) => apiClient.post('/admin/events', payload),
  updateEvent: (id, payload) => apiClient.patch(`/admin/events/${id}`, payload),
  deleteEvent: (id) => apiClient.delete(`/admin/events/${id}`),
  createProgram: (payload) => apiClient.post('/admin/programs', payload),
  updateProgram: (id, payload) => apiClient.patch(`/admin/programs/${id}`, payload),
  promoteProgram: (id, payload) => apiClient.post(`/admin/programs/${id}/promote`, payload),
  createBibleStudyGroup: (payload) => apiClient.post('/admin/bible-study-groups', payload),
  registration: (payload) => apiClient.post('/admin/registrations', payload),
  activateAccount: (payload) => apiClient.post('/admin/activate-account', payload),
};

/* ------------------------- Notifications ------------------------ */
export const notificationService = {
  status: () => apiClient.get('/notifications/status'),
};

/**
 * Backwards-compatible named export used by AuthContext.
 * Prefer the granular service modules above for new code.
 */
export const api = {
  login: authService.login,
  register: authService.register,
  logout: authService.logout,
  getAuthIdentity: authService.identity,
  getProfile: userService.profile,
  getMembers: userService.directory,
  updateProfile: userService.updateProfile,
  updatePassword: userService.updatePassword,
  requestEmailChange: userService.requestEmailChange,
  updateNotificationPreferences: userService.updateNotificationPreferences,
  getRegistrationOptions: publicService.registrationOptions,
};

export default apiClient;

