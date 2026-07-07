/**
 * Simulated authentication service for Z.ai Local Coding Assistant.
 * Uses localStorage to simulate user storage.
 */
export const authService = {
  login: async ({ email, password }) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (email === 'demo@zai.dev' && password === 'password123') {
          const user = {
            id: 'mock-user-id',
            name: 'Demo Developer',
            email: 'demo@zai.dev',
            createdAt: new Date().toISOString()
          };
          resolve({
            user,
            token: 'mock-jwt-token-xyz-12345'
          });
        } else {
          reject(new Error('Invalid email or password. Use demo@zai.dev / password123.'));
        }
      }, 800);
    });
  },

  register: async ({ name, email, password }) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = {
          id: 'mock-user-' + Math.random().toString(36).substr(2, 9),
          name: name || 'New Developer',
          email: email,
          createdAt: new Date().toISOString()
        };
        resolve({
          user,
          token: 'mock-jwt-token-new-' + Math.random().toString(36).substr(2, 9)
        });
      }, 800);
    });
  },

  getProfile: async () => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const storedUser = localStorage.getItem('zai_mock_user');
        if (storedUser) {
          resolve(JSON.parse(storedUser));
        } else {
          reject(new Error('Unauthorized'));
        }
      }, 300);
    });
  },

  logout: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ message: 'Logged out successfully' });
      }, 200);
    });
  },

  updateProfile: async ({ name }) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const storedUser = localStorage.getItem('zai_mock_user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          user.name = name;
          resolve(user);
        } else {
          reject(new Error('User session not found'));
        }
      }, 500);
    });
  }
};
