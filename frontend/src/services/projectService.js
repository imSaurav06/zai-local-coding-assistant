import api from './api';

export const projectService = {
  analyzeProject: async (payload) => {
    const response = await api.post('/project/analyze', payload);
    return {
      success: response.data.success,
      projectSpec: response.data.projectSpec
    };
  },

  generateProject: async ({ originalPrompt, projectSpec }, onProgress) => {
    const token = localStorage.getItem('zai_token');
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

    const response = await fetch(`${baseURL}/project/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ originalPrompt, projectSpec })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Generation failed.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep last incomplete line

      for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine.startsWith('data: ')) {
          const data = JSON.parse(cleanLine.substring(6));
          if (data.stage === 'Error') {
            throw new Error(data.error || 'Generation orchestrator failed.');
          }
          if (data.stage === 'Ready') {
            return {
              success: data.result.success,
              projectName: data.result.projectName || projectSpec.projectName || 'GeneratedProject',
              projectType: projectSpec.projectType || 'Web Application',
              frontendFramework: projectSpec.frontend || 'React.js',
              backendFramework: projectSpec.backend || 'Express.js',
              database: projectSpec.database || 'MongoDB',
              authRequired: projectSpec.authentication || 'None',
              result: data.result.result || '',
              model: data.result.model || 'glm-4.5-flash',
              projectId: data.result.projectId || null,
              files: data.result.files || [],
              runInstructions: data.result.runInstructions || null,
              summary: data.result.summary || '',
              generationStatus: data.result.generationStatus || 'success'
            };
          }
          if (onProgress) {
            onProgress(data);
          }
        }
      }
    }
    throw new Error('Response ended unexpectedly without completion.');
  },

  getProjectById: async (projectId) => {
    const response = await api.get(`/project/${projectId}`);
    return response.data; // Expected: Project model object containing files, runInstructions, etc.
  }
};
