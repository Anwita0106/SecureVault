import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor - attach JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401, refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token, refresh_token } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  refreshToken: (refresh_token) => api.post('/auth/refresh', { refresh_token }),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/password-change', data),
  requestPasswordReset: (email) => api.post('/auth/password-reset-request', { email }),
  resetPassword: (token, new_password) => api.post('/auth/password-reset', { token, new_password }),
};

// Files API
export const filesAPI = {
  upload: (formData, onProgress) => api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  }),
  list: (params) => api.get('/files/', { params }),
  search: (q) => api.get('/files/search', { params: { q } }),
  get: (id) => api.get(`/files/${id}`),
  update: (id, data) => api.put(`/files/${id}`, data),
  delete: (id) => api.delete(`/files/${id}`),
  download: (id) => api.get(`/files/${id}/download`, { responseType: 'blob' }),
  shareFile: (id, data) => api.post(`/files/${id}/share`, data),
  getSharedLinks: () => api.get('/files/shared/links'),
  getVersions: (id) => api.get(`/files/${id}/versions`),
  uploadVersion: (id, formData) => api.post(`/files/${id}/version`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getSharedFile: (token, password) => api.get(`/files/share/${token}`, { params: password ? { password } : {} }),
  downloadShared: (token, password) => api.get(`/files/share/${token}/download`, {
    params: password ? { password } : {},
    responseType: 'blob',
  }),
};

// Users API
export const usersAPI = {
  getMe: () => api.get('/users/me'),
  updateMe: (data) => api.put('/users/me', data),
  listUsers: (params) => api.get('/users/', { params }),
  getUser: (id) => api.get(`/users/${id}`),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deactivateUser: (id) => api.delete(`/users/${id}`),
  getUserStats: (id) => api.get(`/users/${id}/stats`),
  listRoles: () => api.get('/users/roles/all'),
  createRole: (data) => api.post('/users/roles', data),
};

// Security API
export const securityAPI = {
  getDashboard: () => api.get('/security/dashboard'),
  getAuditLogs: (params) => api.get('/security/audit-logs', { params }),
  getMyActivity: (params) => api.get('/security/my-activity', { params }),
  getActivitySummary: (days) => api.get('/security/activity-summary', { params: { days } }),
  getFindings: (params) => api.get('/security/findings', { params }),
  createFinding: (data) => api.post('/security/findings', data),
  resolveFinding: (id) => api.put(`/security/findings/${id}/resolve`),
  quarantineFile: (id) => api.post(`/security/files/${id}/quarantine`),
  unquarantineFile: (id) => api.post(`/security/files/${id}/unquarantine`),
  runAIAnalysis: () => api.post('/security/ai/analyze'),
  generateReport: (days) => api.post('/security/ai/report', null, { params: { days } }),
  getAllFiles: (params) => api.get('/security/files/all', { params }),
};

export default api;
