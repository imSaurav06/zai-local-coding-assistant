/**
 * Simulated chat assistant and code generator services.
 * Generates custom markdown coding answers based on keywords.
 */
export const chatService = {
  sendMessage: async ({ prompt }) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const lowerPrompt = prompt.toLowerCase();
        let markdownResponse = '';

        if (lowerPrompt.includes('react') || lowerPrompt.includes('component')) {
          markdownResponse = `### Interactive React Component Generated

Here is a responsive, customizable component built using **React** and styled with **Tailwind CSS**.

\`\`\`jsx
import React, { useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';

export default function ActionCard({ title, desc, onAction }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-indigo-500 transition-colors shadow-lg">
      <h3 className="text-white text-lg font-bold mb-2">{title || "Card Title"}</h3>
      <p className="text-slate-400 text-sm mb-4">{desc || "Provide brief summary cards."}</p>
      <button 
        onClick={onAction}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-all"
      >
        Execute Action
      </button>
    </div>
  );
}
\`\`\`

#### Highlights:
1. Reusable styling.
2. Smooth border hover states.
3. Clean modern typography.
`;
        } else if (lowerPrompt.includes('express') || lowerPrompt.includes('api') || lowerPrompt.includes('node')) {
          markdownResponse = `### Express.js Routing Module

Below is a modular Router script implementing clean RESTful API standards.

\`\`\`javascript
const express = require('express');
const router = express.Router();

// Mock database
let tasks = [
  { id: 1, title: 'Learn React Router', completed: true },
  { id: 2, title: 'Connect local services', completed: false }
];

// GET /api/tasks
router.get('/', (req, res) => {
  res.status(200).json({ success: true, count: tasks.length, data: tasks });
});

// POST /api/tasks
router.post('/', (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: 'Please provide a title' });
  }
  const newTask = { id: tasks.length + 1, title, completed: false };
  tasks.push(newTask);
  res.status(201).json({ success: true, data: newTask });
});

module.exports = router;
\`\`\`

#### Key design notes:
- Request body validation.
- Standard HTTP status code representations.
- Modular exports.
`;
        } else if (lowerPrompt.includes('mongo') || lowerPrompt.includes('schema') || lowerPrompt.includes('database')) {
          markdownResponse = `### Mongoose MongoDB Database Schema

Here is a standard mongoose model schema defining strict validation.

\`\`\`javascript
const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  bio: String,
  avatar: String,
  github: String
});

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email']
  },
  profile: ProfileSchema
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
\`\`\`
`;
        } else if (lowerPrompt.includes('bug') || lowerPrompt.includes('fix')) {
          markdownResponse = `### Code Bug Remediation

I've analyzed the error and fixed the implementation logic:

#### The Issue:
The loop condition used \`i <= array.length\` which attempts to access an out-of-bounds index (i.e. \`array[array.length]\` is \`undefined\`), causing a \`TypeError\`.

#### Fixed Code:
\`\`\`javascript
function processData(list) {
  if (!list || list.length === 0) return 0;
  
  let total = 0;
  // Loop condition corrected to strict inequality (<)
  for (let i = 0; i < list.length; i++) {
    total += list[i].value || 0;
  }
  return total;
}
\`\`\`
`;
        } else {
          // Generic coding helper response
          markdownResponse = `### Z.ai local assistant response

Thank you for your prompt. Here are some recommendations to tackle this coding problem:

1. **Keep Functions Pure**: Avoid side-effects.
2. **Handle Errors Gracefully**: Use \`try/catch\` blocks.
3. **Use Descriptive Names**: Avoid short, generic variables.

Here is a quick code utility example:
\`\`\`javascript
// Utility to debounce search queries
export function debounce(func, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}
\`\`\`

Let me know if you need to build React layouts, Mongoose DB connections, or Express API modules!
`;
        }

        resolve({
          message: markdownResponse,
          model: 'glm-5.1',
          createdAt: new Date().toISOString()
        });
      }, 1000);
    });
  },

  generateCode: async ({ prompt }) => {
    return chatService.sendMessage({ prompt });
  },

  explainCode: async ({ prompt, code }) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          message: `### Code Walkthrough & Explanation

Here is the explanation for the provided code:

#### Code Analyzed:
\`\`\`javascript
${code || '// No code provided'}
\`\`\`

#### Step-by-Step Breakdown:
1. **Inputs and Validation**: The script validates inputs and assigns default configurations.
2. **Processing Strategy**: It processes items using standard iteration methods.
3. **Performance Impact**: Time complexity is $O(N)$ and Space complexity is $O(1)$.

*Prompt user notes: ${prompt || 'No additional explanation prompt provided.'}*
`,
          model: 'glm-5.1',
          createdAt: new Date().toISOString()
        });
      }, 1000);
    });
  },

  fixCode: async ({ prompt, code }) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          message: `### Refactored and Corrected Script

I have reviewed the code below and resolved issues around syntax, logic, and edge cases.

#### Original Input:
\`\`\`javascript
${code || '// No code provided'}
\`\`\`

#### Improvements Made:
- Standardized array bounds checks.
- Prevented potential variable leaks.
- Wrapped operations in try-catch handlers to increase safety.

#### Rectified Code:
\`\`\`javascript
function resolvedWrapper() {
  try {
    // Corrected implementation:
    const baseCode = ${JSON.stringify(code)};
    console.log("Successfully ran base evaluation of content.");
    return baseCode;
  } catch (error) {
    console.error("Execution failed:", error);
    return null;
  }
}
\`\`\`

*Notes on request: ${prompt || 'No notes.'}*
`,
          model: 'glm-5.1',
          createdAt: new Date().toISOString()
        });
      }, 1000);
    });
  }
};
