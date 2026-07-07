export const promptTemplates = [
  {
    id: "gen-react-component",
    title: "Generate React Component",
    description: "Create a modern, responsive React component with Tailwind CSS.",
    category: "frontend",
    prompt: "Generate a premium React functional component for a dark-themed User Profile Card. Include hover states, avatar image placeholder, badge indicators, and action buttons. Style it completely using Tailwind CSS. Provide only the React component code inside a code block."
  },
  {
    id: "gen-express-api",
    title: "Generate Express API",
    description: "Create a RESTful Express endpoint with standard routes.",
    category: "backend",
    prompt: "Write a clean Express router file for a /products resource. Implement GET (all with query filtering), GET (by id), POST (with validation), PUT (update), and DELETE. Make it highly professional and modular. Use standard status codes and structured responses."
  },
  {
    id: "create-mongo-schema",
    title: "Create MongoDB Schema",
    description: "Design a Mongoose schema with validations and middleware.",
    category: "database",
    prompt: "Create a Mongoose schema for a User model with these fields: username (unique, required), email (validation), password (min length), role (enum: user, admin), profile (nested object containing avatar, bio, location), and timestamps. Include basic validators and a pre-save hook placeholder."
  },
  {
    id: "fix-code-bug",
    title: "Fix Code Bug",
    description: "Find and fix bugs in your existing code snippet.",
    category: "utility",
    prompt: "Review the following code, identify the logic bug/errors, explain why they occur, and provide the corrected version:\n\n```javascript\nfunction calculateAverage(users) {\n  let total = 0;\n  for (let i = 0; i <= users.length; i++) {\n    total += users[i].age;\n  }\n  return total / users.length;\n}\n```"
  },
  {
    id: "explain-code",
    title: "Explain Code",
    description: "Break down complex code files step-by-step.",
    category: "utility",
    prompt: "Analyze and explain the purpose, design pattern, complexity (Time and Space), and detailed step-by-step logic of the following function:\n\n```javascript\nconst memoize = (fn) => {\n  const cache = {};\n  return (...args) => {\n    const key = JSON.stringify(args);\n    if (key in cache) return cache[key];\n    const result = fn(...args);\n    cache[key] = result;\n    return result;\n  };\n};\n```"
  },
  {
    id: "create-project-struct",
    title: "Create Full Project Structure",
    description: "Plan the file structure for a full stack boilerplate.",
    category: "architecture",
    prompt: "Create a full-stack MERN dashboard application folder structure. Present it as a tree diagram and explain the role of each directory. Include server folder (controllers, models, routes, config, middleware) and client folder (components, pages, context, services, hooks)."
  },
  {
    id: "create-auth-flow",
    title: "Create Authentication Flow",
    description: "Design secure login/signup flow recommendations.",
    category: "security",
    prompt: "Explain how to implement JWT authentication in a MERN stack application. Cover token storage strategy (cookies vs localStorage), token expiration, middleware validation on the backend, and route guards/refresh tokens on the frontend. Show code snippets where needed."
  },
  {
    id: "create-dashboard-ui",
    title: "Create Dashboard UI",
    description: "Outline layouts for analytical dashboards.",
    category: "frontend",
    prompt: "Create a design specification and HTML/CSS blueprint for a responsive SaaS Dashboard. The layout should include a collapsible sidebar, a top navbar with profile/notification badges, a 3-column metric card grid, a main chart area, and a recent activities table."
  }
];
