import api from './api';

export const historyService = {
  getHistory: async () => {
    const response = await api.get('/history');
    return response.data.map(item => ({
      ...item,
      id: item.id || item._id
    }));
  },

  getHistoryById: async (id) => {
    const response = await api.get(`/history/${id}`);
    const item = response.data;
    return {
      ...item,
      id: item.id || item._id
    };
  },

  deleteHistory: async (id) => {
    const response = await api.delete(`/history/${id}`);
    return response.data; // Expected: { success: true, message: "..." }
  },

  saveHistory: async (item) => {
    const response = await api.post('/history', item);
    const saved = response.data;
    return {
      ...saved,
      id: saved.id || saved._id
    };
  }
};
