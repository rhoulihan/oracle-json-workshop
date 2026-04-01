/**
 * API client — thin wrapper around fetch for all backend endpoints.
 * Every method returns a plain object, never throws.
 */
export const api = {
  async get(url) {
    const res = await fetch(url, { method: 'GET', credentials: 'same-origin' });
    return res.json();
  },

  async del(url) {
    const res = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
    return res.json();
  },

  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  },

  // Auth
  async register(displayName, email) {
    return this.post('/api/auth/register', { displayName, email });
  },

  async login(schemaName, password) {
    return this.post('/api/auth/login', { schemaName, password });
  },

  async logout() {
    return this.post('/api/auth/logout');
  },

  async resetWorkspace() {
    return this.post('/api/auth/reset');
  },

  async getMe() {
    const res = await fetch('/api/auth/me', { method: 'GET', credentials: 'same-origin' });
    if (!res.ok) return null;
    return res.json();
  },

  // Labs
  async getModules() {
    const data = await this.get('/api/labs');
    return data.modules || [];
  },

  async getModule(moduleId) {
    return this.get(`/api/labs/${moduleId}`);
  },

  async checkExercise(moduleId, exerciseId) {
    return this.post(`/api/labs/${moduleId}/check/${exerciseId}`);
  },

  async getProgress() {
    const data = await this.get('/api/labs/progress');
    return data.progress || {};
  },

  // Query execution
  async executeSql(sql) {
    return this.post('/api/query/sql', { sql });
  },

  async executeJs(code) {
    return this.post('/api/query/js', { code });
  },

  async executeMongo(command) {
    return this.post('/api/query/mongo', { command });
  },

  // Admin
  async adminLogin(password) {
    return this.post('/api/admin/login', { password });
  },

  async adminLogout() {
    return this.post('/api/admin/logout');
  },

  async getWorkspaces() {
    const data = await this.get('/api/admin/workspaces');
    return data.workspaces || [];
  },

  async teardownWorkspace(schemaName) {
    return this.del(`/api/admin/workspaces/${schemaName}`);
  },

  async teardownAll() {
    return this.del('/api/admin/workspaces');
  },
};
