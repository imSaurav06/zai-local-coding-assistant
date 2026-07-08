const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const spec = {
  projectName: "LandingPage",
  projectType: "React Landing Page",
  frontend: "React with Vite and Tailwind CSS",
  backend: "None",
  database: "None",
  authentication: "None",
  mainFeatures: [
    "Hero section",
    "Pricing grid",
    "Testimonials",
    "Responsive menu"
  ],
  importantDependencies: [
    "react",
    "react-dom",
    "vite",
    "tailwindcss",
    "@vitejs/plugin-react"
  ],
  environmentVariables: []
};

const prompt = `You are a principal software engineer. Generate a complete, minimal, runnable codebase for the project specified below.

ORIGINAL USER REQUEST:
"Create a React landing page with Tailwind CSS."

APPROVED PROJECT SPECIFICATION:
- Project Name: ${spec.projectName}
- Project Type: ${spec.projectType}
- Frontend: ${spec.frontend}
- Backend: ${spec.backend}
- Database: ${spec.database}
- Authentication: ${spec.authentication}
- Main Features:
${spec.mainFeatures.map(f => `  - ${f}`).join("\n")}
- Important Dependencies:
${spec.importantDependencies.map(d => `  - ${d}`).join("\n")}
- Environment Variables Required:
${spec.environmentVariables.map(v => `  - ${v}`).join("\n")}

GENERATION REQUIREMENTS:
1. Generate the actual minimum complete runnable project files.
2. Scaffold all necessary config and code files required by the selected technology (e.g. package.json, requirements.txt, .env.example, index.html, index.js, App.jsx, app.py, README.md, etc.) to make it fully functional.
3. Keep the file count minimal (5 to 8 files total). Write extremely clean, concise, and short code (avoid long comments, keep files under 30-40 lines of code).
4. Never include real secrets, API keys, or passwords. Use placeholder values in any .env.example file.
5. Create a complete README.md that includes a detailed "Run Locally Guide" with prerequisites, installation steps, and start commands tailored exactly to this generated codebase.
6. The files block must be enclosed exactly within:
--- START_FILES ---

For each file, use this exact separator structure (including the dashes):
--- FILE: path/to/filename ---
\`\`\`language
// Complete file content here
\`\`\`
--- END_FILE ---

--- END_FILES ---`;

console.log("Calling Z.ai...");
axios.post(`${process.env.ZAI_BASE_URL}/chat/completions`, {
    model: process.env.ZAI_MODEL,
    messages: [
        { role: 'system', content: 'You are an expert AI coder that scaffolds full-stack runnable software project files.' },
        { role: 'user', content: prompt }
    ]
}, {
    headers: {
        Authorization: `Bearer ${process.env.ZAI_API_KEY}`,
        'Content-Type': 'application/json'
    }
}).then(res => {
    const raw = res.data.choices[0].message.content;
    console.log("Received raw output length:", raw.length);
    fs.writeFileSync('raw_zai_output.txt', raw, 'utf8');
    console.log("Saved raw output to raw_zai_output.txt");
}).catch(err => {
    console.error("ZAI ERROR:", err.message);
});
