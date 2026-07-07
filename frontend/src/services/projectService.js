import api from './api';

export const projectService = {
  generateProject: async (projectData) => {
    const response = await api.post('/project/generate', projectData);
    const data = response.data;

    return {
      success: data.success,
      projectName: projectData.projectName || 'GeneratedProject',
      projectType: projectData.projectType || 'Web Application',
      frontendFramework: projectData.frontendFramework || 'React.js',
      backendFramework: projectData.backendFramework || 'Express.js',
      database: projectData.database || 'MongoDB',
      authRequired: projectData.authRequired || 'Yes',
      adminRequired: projectData.adminRequired || 'No',
      designPreference: projectData.designPreference || 'Dark Navy Professional',
      result: data.result || data.message || '',
      model: data.model || 'glm-4.5-flash',
      projectId: data.projectId || null,
      files: data.files || []
    };
  }
};
