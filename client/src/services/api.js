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
    return apiClient.post('/users/me/profile-image', formData);
  },
  updatePassword: (payload) => apiClient.patch('/users/me/password', payload),
  requestEmailChange: (payload) => apiClient.post('/users/me/email-change', payload),
  verifyEmailChange: (token) => apiClient.post('/users/me/email-change/verify', { token }),
  updateNotificationPreferences: (payload) => apiClient.patch('/users/me/notification-preferences', payload),
  telegramLinkToken: () => apiClient.post('/users/me/telegram/link-token'),
  telegramReplace: () => apiClient.post('/users/me/telegram/replace'),
  telegramRecoveryStatus: (token) => apiClient.post('/users/me/telegram/recovery/status', { token }),
  confirmTelegramRecovery: (token, password) => apiClient.post('/users/me/telegram/recovery/confirm', { token, password }),
  telegramLinkStatus: (token) => apiClient.post('/users/me/telegram/link-status', { token }),
  telegramUnlink: (password) => apiClient.delete('/users/me/telegram', { data: { password } }),
  telegramDisconnect: (password) => apiClient.delete('/telegram/disconnect', { data: { password } }),
  directory: () => apiClient.get('/users'),
  notifications: () => apiClient.get('/users/me/notifications'),
  markNotificationRead: (id) => apiClient.patch(`/users/me/notifications/${id}/read`),
  markAllNotificationsRead: () => apiClient.patch('/users/me/notifications/read'),
  testMyTelegram: () => apiClient.post('/users/me/telegram/test'),
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
  calendarEvents: (params) => apiClient.get('/public/events/calendar', { params }),
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
  joinDepartment: (id) => apiClient.post(`/public/departments/${id}/join`),
  joinBibleStudyGroup: (id) => apiClient.post(`/public/bible-study-groups/${id}/join`),
  partners: () => apiClient.get('/public/partners'),
  contact: (payload) => apiClient.post('/public/contact', payload),

  /* ----------------------------- Groups (community workspaces) ---------------------------- */
  groups: () => apiClient.get('/groups'),
  group: (id, type) => apiClient.get(`/groups/${id}`, { params: { type } }),
  groupFollowStatus: (id, type) => apiClient.get(`/groups/${id}/follow-status`, { params: { type } }),
  followGroup: (id, type) => apiClient.post(`/groups/${id}/follow`, null, { params: { type } }),
  unfollowGroup: (id, type) => apiClient.delete(`/groups/${id}/follow`, { params: { type } }),
  followedGroups: () => apiClient.get('/groups/followed'),
  groupPosts: (id, type) => apiClient.get(`/groups/${id}/posts`, { params: { type } }),
  groupPrograms: (id, type) => apiClient.get(`/groups/${id}/programs`, { params: { type } }),
  createGroupProgram: (id, type, payload) => apiClient.post(`/groups/${id}/programs`, payload, { params: { type } }),
  createGroupPost: (id, type, payload) => apiClient.post(`/groups/${id}/posts`, payload, { params: { type } }),
  retryGroupPostTelegram: (id, type, postId) => apiClient.post(`/groups/${id}/posts/${postId}/telegram/retry`, null, { params: { type } }),
  uploadGroupPostImage: (id, type, file) => { const form = new FormData(); form.append('image', file); return apiClient.post(`/groups/${id}/media/upload`, form, { params: { type } }); },
  updateGroupPost: (id, type, postId, payload) => apiClient.patch(`/groups/${id}/posts/${postId}`, payload, { params: { type } }),
  deleteGroupPost: (id, type, postId) => apiClient.delete(`/groups/${id}/posts/${postId}`, { params: { type } }),
  likeGroupPost: (id, type, postId) => apiClient.post(`/groups/${id}/posts/${postId}/like`, null, { params: { type } }),
  unlikeGroupPost: (id, type, postId) => apiClient.delete(`/groups/${id}/posts/${postId}/like`, { params: { type } }),
  groupPostComments: (id, type, postId, params) => apiClient.get(`/groups/${id}/posts/${postId}/comments`, { params: { type, ...params } }),
  createGroupPostComment: (id, type, postId, payload) => apiClient.post(`/groups/${id}/posts/${postId}/comments`, payload, { params: { type } }),
  updateGroupPostComment: (id, type, postId, commentId, payload) => apiClient.patch(`/groups/${id}/posts/${postId}/comments/${commentId}`, payload, { params: { type } }),
  deleteGroupPostComment: (id, type, postId, commentId) => apiClient.delete(`/groups/${id}/posts/${postId}/comments/${commentId}`, { params: { type } }),
  groupManagementOverview: (id, type) => apiClient.get(`/groups/${id}/management`, { params: { type } }),
  groupManagementPosts: (id, type) => apiClient.get(`/groups/${id}/management/posts`, { params: { type } }),
  updateGroupSettings: (id, type, payload) => apiClient.patch(`/groups/${id}/settings`, payload, { params: { type } }),
  testGroupCommunication: (id, type, channel) => apiClient.post(`/groups/${id}/communications/test`, { confirm: true, channel }, { params: { type } }),
  groupFollowers: (id, type, params) => apiClient.get(`/groups/${id}/followers`, { params: { type, ...params } }),
  groupNotificationPreferences: (id, type, payload) =>
    apiClient.patch(`/groups/${id}/notification-preferences`, payload, { params: { type } }),
  getGroupNotificationPreferences: (id, type) => apiClient.get(`/groups/${id}/notification-preferences`, { params: { type } }),
};

export const adminService = {
  newChristianFollowups: (params) => apiClient.get('/admin/new-christian-followups', { params }),
  followupAssignees: () => apiClient.get('/admin/new-christian-followups/assignees'),
  followupLinkCandidates: (id, params) => apiClient.get(`/admin/new-christian-followups/${id}/link-candidates`, { params }),
  linkFollowupToMember: (id, userId) => apiClient.post(`/admin/new-christian-followups/${id}/link-member`, { userId }),
  updateNewChristianFollowup: (id, payload) => apiClient.patch(`/admin/new-christian-followups/${id}`, payload),
  retryNewChristianWelcome: (id, channel) => apiClient.post(`/admin/new-christian-followups/${id}/retry-welcome`, { channel }),
  retryMemberWelcome: (userId, channel) => apiClient.post(`/admin/users/${userId}/retry-welcome`, { channel }),
  updateUserStatus: (userId, payload) => apiClient.patch(`/admin/users/${userId}/status`, payload),
  roles: () => apiClient.get('/admin/roles'),
  departments: () => apiClient.get('/admin/departments'),
  departmentDetails: (id) => apiClient.get(`/admin/departments/${id}`),
  bibleStudyGroups: () => apiClient.get('/admin/bible-study-groups'),
  bibleStudyGroupDetails: (id) => apiClient.get(`/admin/bible-study-groups/${id}`),
  groupLeaderCandidates: (params) => apiClient.get('/admin/group-leader-candidates', { params }),
  createDepartment: (payload) => apiClient.post('/admin/departments', payload),
  updateDepartment: (id, payload) => apiClient.patch(`/admin/departments/${id}`, payload),
  updateDepartmentStatus: (id, isActive) => apiClient.patch(`/admin/departments/${id}/status`, { isActive }),
  deleteDepartment: (id) => apiClient.delete(`/admin/departments/${id}`),
  updateDepartmentCommunityLinks: (id, communityLinks) => apiClient.patch(`/admin/departments/${id}/community-links`, { communityLinks }),
  organizations: () => apiClient.get('/admin/organizations'),
  createOrganization: (payload) => apiClient.post('/admin/organizations', payload),
  announcements: (params) => apiClient.get('/admin/announcements', { params }),
  createAnnouncement: (payload) => apiClient.post('/admin/announcements', payload),
  updateAnnouncement: (id, payload) => apiClient.patch(`/admin/announcements/${id}`, payload),
  programs: () => apiClient.get('/admin/programs'),
  events: (params) => apiClient.get('/admin/events', { params }),
  createEvent: (payload) => apiClient.post('/admin/events', payload),
  updateEvent: (id, payload) => apiClient.patch(`/admin/events/${id}`, payload),
  deleteEvent: (id) => apiClient.delete(`/admin/events/${id}`),
  createProgram: (payload) => apiClient.post('/admin/programs', payload),
  updateProgram: (id, payload) => apiClient.patch(`/admin/programs/${id}`, payload),
  promoteProgram: (id, payload) => apiClient.post(`/admin/programs/${id}/promote`, payload),
  createBibleStudyGroup: (payload) => apiClient.post('/admin/bible-study-groups', payload),
  updateBibleStudyGroup: (id, payload) => apiClient.patch(`/admin/bible-study-groups/${id}`, payload),
  updateBibleStudyGroupStatus: (id, isActive) => apiClient.patch(`/admin/bible-study-groups/${id}/status`, { isActive }),
  deleteBibleStudyGroup: (id) => apiClient.delete(`/admin/bible-study-groups/${id}`),
  updateBibleStudyCommunityLinks: (id, communityLinks) => apiClient.patch(`/admin/bible-study-groups/${id}/community-links`, { communityLinks }),
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
