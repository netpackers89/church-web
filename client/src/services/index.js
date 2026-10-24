import apiClient from './api.js';

/**
 * Feature service modules for domains the backend may or may not expose yet.
 * Each method targets the intended REST endpoint. When an endpoint is not
 * implemented the axios interceptor flags the error with `endpointMissing`,
 * and the UI renders a documented "feature not available" state instead of
 * fake data. See BACKEND_DEPENDENCIES.md for the full list.
 *
 * Expected server response envelope: { success, data } — callers unwrap it.
 */

const envelope = (url) => apiClient.get(url);

export const eventsService = {
  list: (params) => apiClient.get('/events', { params }),
  upcoming: (params) => apiClient.get('/events/upcoming', { params }),
  detail: (id) => apiClient.get(`/events/${id}`),
  // member actions
  register: (id, payload) => apiClient.post(`/events/${id}/register`, payload),
  myRegistrations: () => apiClient.get('/me/registrations'),
  // staff
  create: (payload) => apiClient.post('/events', payload),
  update: (id, payload) => apiClient.patch(`/events/${id}`, payload),
  remove: (id) => apiClient.delete(`/events/${id}`),
};

export const bibleStudyService = {
  publicGroups: () => envelope('/public/bible-study-groups'),
  list: () => apiClient.get('/bible-study/groups'),
  detail: (id) => apiClient.get(`/bible-study/groups/${id}`),
  myGroup: () => apiClient.get('/bible-study/my-group'),
  requestJoin: (id, payload) => apiClient.post(`/bible-study/groups/${id}/join`, payload),
  autoAssign: (payload) => apiClient.post('/bible-study/assign', payload),
  requestTransfer: (id, payload) => apiClient.post(`/bible-study/groups/${id}/transfer`, payload),
  // coordinator actions
  assignMember: (groupId, payload) => apiClient.post(`/bible-study/groups/${groupId}/assign`, payload),
  create: (payload) => apiClient.post('/bible-study/groups', payload),
  update: (id, payload) => apiClient.patch(`/bible-study/groups/${id}`, payload),
};

export const organizationsService = {
  list: () => apiClient.get('/organizations'),
  detail: (id) => apiClient.get(`/organizations/${id}`),
  departments: (id) => apiClient.get(`/organizations/${id}/departments`),
  department: (id) => apiClient.get(`/departments/${id}`),
  joinDepartment: (id, payload) => apiClient.post(`/departments/${id}/join`, payload),
  myRequests: () => apiClient.get('/me/department-requests'),
  members: (id) => apiClient.get(`/organizations/${id}/members`),
  announcements: (id) => apiClient.get(`/organizations/${id}/announcements`),
  // leader actions
  createDepartment: (orgId, payload) => apiClient.post(`/organizations/${orgId}/departments`, payload),
  updateDepartment: (id, payload) => apiClient.patch(`/departments/${id}`, payload),
  reviewJoinRequest: (id, payload) => apiClient.patch(`/me/department-requests/${id}`, payload),
};

export const givingService = {
  // finance
  financeQueue: (params) => apiClient.get('/admin/giving', { params }),
  approve: (id, payload = {}) => apiClient.patch(`/admin/giving/${id}/approve`, payload),
  reject: (id, payload) => apiClient.patch(`/admin/giving/${id}/reject`, payload),
  listCampaigns: () => apiClient.get('/campaigns'),
  adminCampaign: (id) => apiClient.get(`/campaigns/${id}`),
  createCampaign: (payload) => apiClient.post('/campaigns', payload),
  updateCampaign: (id, payload) => apiClient.patch(`/campaigns/${id}`, payload),
  archiveCampaign: (id) => apiClient.delete(`/campaigns/${id}`),
};

export const groupService = {
  list: () => apiClient.get('/groups'),
  detail: (id, type) => apiClient.get(`/groups/${id}`, { params: { type } }),
  followStatus: (id, type) => apiClient.get(`/groups/${id}/follow-status`, { params: { type } }),
  follow: (id, type) => apiClient.post(`/groups/${id}/follow`, null, { params: { type } }),
  unfollow: (id, type) => apiClient.delete(`/groups/${id}/follow`, { params: { type } }),
  followed: () => apiClient.get('/groups/followed'),
  joined: () => apiClient.get('/groups/joined'),
  posts: (id, type) => apiClient.get(`/groups/${id}/posts`, { params: { type } }),
  createPost: (id, type, payload) => apiClient.post(`/groups/${id}/posts`, payload, { params: { type } }),
  notificationPreferences: (id, type, payload) =>
    apiClient.patch(`/groups/${id}/notification-preferences`, payload, { params: { type } }),
};

export const contentService = {
  sermons: () => envelope('/public/sermons'),
  verse: () => envelope('/public/verse'),
  banners: () => envelope('/public/banners'),
  ministries: () => envelope('/public/ministries'),
  media: () => apiClient.get('/admin/media'),
  uploadImage: (file, { mediaType, title, isThumbnail, onUploadProgress } = {}) => {
    const form = new FormData();
    form.append('image', file);
    if (mediaType) form.append('type', mediaType);
    if (title) form.append('title', title);
    if (isThumbnail !== undefined) form.append('isThumbnail', String(isThumbnail));
    return apiClient.post('/admin/media/upload', form, {
      onUploadProgress,
    });
  },
  createMedia: (payload) => apiClient.post('/admin/media', payload),
  updateMedia: (id, payload) => apiClient.patch(`/admin/media/${id}`, payload),
  listMedia: (params) => apiClient.get('/admin/media', { params }),
  deleteMedia: (id) => apiClient.delete(`/admin/media/${id}`),
  // staff content management
  setVerse: (payload) => apiClient.put('/admin/verse', payload),
  listVerses: () => apiClient.get('/admin/verses'),
  updateVerse: (id, payload) => apiClient.patch(`/admin/verses/${id}`, payload),
  archiveVerse: (id) => apiClient.delete(`/admin/verses/${id}`),
};

export const adminService = {
  emailTemplates: () => apiClient.get('/admin/message-templates'),
  createEmailTemplate: (payload) => apiClient.post('/admin/message-templates', payload),
  updateEmailTemplate: (id, payload) => apiClient.patch(`/admin/message-templates/${id}`, payload),
  previewEmailTemplate: (payload) => apiClient.post('/admin/message-templates/preview', payload),
  roles: () => apiClient.get('/admin/roles'),
  assignRole: (userId, payload) => apiClient.post(`/admin/users/${userId}/roles`, payload),
  auditLogs: (params) => apiClient.get('/admin/audit-logs', { params }),
  settings: () => apiClient.get('/admin/settings'),
  updateSettings: (payload) => apiClient.patch('/admin/settings', payload),
  reports: (type, params) => apiClient.get(`/admin/reports/${type}`, { params }),
  telegramInbox: (params) => apiClient.get('/admin/telegram/messages', { params }),
  replyToTelegramMessage: (id, payload) => apiClient.post(`/admin/telegram/messages/${id}/replies`, payload),
  addTelegramMessageNote: (id, payload) => apiClient.post(`/admin/telegram/messages/${id}/notes`, payload),
  updateTelegramMessage: (id, payload) => apiClient.patch(`/admin/telegram/messages/${id}`, payload),
  telegramManagementOverview: () => apiClient.get('/admin/telegram/overview'),
  checkTelegramConnection: () => apiClient.get('/admin/telegram/connection'),
  sendTelegramAdminTest: () => apiClient.post('/admin/telegram/test'),
  telegramMenuItems: () => apiClient.get('/admin/telegram/menu-items'),
  createTelegramMenuItem: (payload) => apiClient.post('/admin/telegram/menu-items', payload),
  updateTelegramMenuItem: (id, payload) => apiClient.patch(`/admin/telegram/menu-items/${id}`, payload),
  deleteTelegramMenuItem: (id) => apiClient.delete(`/admin/telegram/menu-items/${id}`),
  telegramAutoReplies: () => apiClient.get('/admin/telegram/auto-replies'),
  createTelegramAutoReply: (payload) => apiClient.post('/admin/telegram/auto-replies', payload),
  updateTelegramAutoReply: (id, payload) => apiClient.patch(`/admin/telegram/auto-replies/${id}`, payload),
  deleteTelegramAutoReply: (id) => apiClient.delete(`/admin/telegram/auto-replies/${id}`),
  previewTelegramAutoReply: (payload) => apiClient.post('/admin/telegram/auto-replies/preview', payload),
  listPermissions: () => apiClient.get('/admin/permissions'),
  createRole: (payload) => apiClient.post('/admin/roles', payload),
  updateRole: (id, payload) => apiClient.patch('/admin/roles/' + id, payload),
  setRolePermissions: (id, payload) => apiClient.put('/admin/roles/' + id + '/permissions', payload),
  deleteRole: (id) => apiClient.delete('/admin/roles/' + id),
  websiteNotifications: (params) => apiClient.get('/admin/notifications', { params }),
  createWebsiteNotification: (payload) => apiClient.post('/admin/notifications', payload),
  archiveWebsiteNotification: (id) => apiClient.patch('/admin/notifications/' + id),
  sendToRecipients: (payload) => apiClient.post('/notifications/send', payload),
  notificationStatus: () => apiClient.get('/notifications/status'),
  testCommunication: (payload) => apiClient.post('/admin/communications/test', payload),
};

export default {
  eventsService,
  groupService,
  bibleStudyService,
  organizationsService,
  givingService,
  contentService,
  adminService,
};
