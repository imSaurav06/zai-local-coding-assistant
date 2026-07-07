import { mockHistory } from '../data/mockData';

// Helper to initialize mock history in localStorage if it doesn't exist
const initializeHistory = () => {
  const history = localStorage.getItem('zai_mock_history');
  if (!history) {
    localStorage.setItem('zai_mock_history', JSON.stringify(mockHistory));
  }
};

export const historyService = {
  getHistory: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        initializeHistory();
        const history = JSON.parse(localStorage.getItem('zai_mock_history') || '[]');
        // Sort by date descending
        history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(history);
      }, 500);
    });
  },

  getHistoryById: async (id) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        initializeHistory();
        const history = JSON.parse(localStorage.getItem('zai_mock_history') || '[]');
        const found = history.find(item => item.id === id);
        if (found) {
          resolve(found);
        } else {
          reject(new Error('History item not found.'));
        }
      }, 300);
    });
  },

  deleteHistory: async (id) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        initializeHistory();
        const history = JSON.parse(localStorage.getItem('zai_mock_history') || '[]');
        const index = history.findIndex(item => item.id === id);
        if (index !== -1) {
          history.splice(index, 1);
          localStorage.setItem('zai_mock_history', JSON.stringify(history));
          resolve({ success: true, message: 'Item deleted.' });
        } else {
          reject(new Error('History item not found.'));
        }
      }, 400);
    });
  },

  saveHistory: async (item) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        initializeHistory();
        const history = JSON.parse(localStorage.getItem('zai_mock_history') || '[]');
        const newItem = {
          id: 'hist-' + Math.random().toString(36).substr(2, 9),
          userId: 'mock-user-id',
          createdAt: new Date().toISOString(),
          model: 'glm-5.1',
          ...item
        };
        history.unshift(newItem);
        localStorage.setItem('zai_mock_history', JSON.stringify(history));
        resolve(newItem);
      }, 300);
    });
  }
};
