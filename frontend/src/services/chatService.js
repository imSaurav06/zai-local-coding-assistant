import api from './api';

export const chatService = {
  sendMessage: async ({ prompt }) => {
    const response = await api.post('/ai/chat', { prompt });
    const data = response.data;

    return {
      message: data.result || data.message || '',
      model: data.model || 'glm-4.5-flash',
      createdAt: new Date().toISOString(),
    };
  },

  generateCode: async ({ prompt }) => {
    return chatService.sendMessage({ prompt });
  },

  explainCode: async ({ prompt, code }) => {
    return chatService.sendMessage({
      prompt: `${prompt || "Explain this code"}\n\nCode:\n${code}`,
    });
  },

  fixCode: async ({ prompt, code }) => {
    return chatService.sendMessage({
      prompt: `${prompt || "Find and fix bugs in this code"}\n\nCode:\n${code}`,
    });
  },
};