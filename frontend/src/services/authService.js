import api from './api';

export const authService = {
  login: async ({ email, password }) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data; // Expected response: { success: true, token: "...", user: { id, name, email } }
  },

  register: async ({ name, email, password }) => {
    const response = await api.post('/auth/register', { name, email, password });
    return response.data; // Expected response: { success: true, token: "...", user: { id, name, email } }
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data.user; // Expected response: { id, name, email, createdAt }
  },

  logout: async () => {
    return { message: 'Logged out successfully' };
  },

  updateProfile: async ({ name }) => {
    const response = await api.put('/auth/profile', { name });
    return response.data.user; // Expected response: { id, name, email, createdAt }
  }
};
