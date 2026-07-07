export const mockHistory = [
  {
    id: "hist-1",
    userId: "mock-user-id",
    type: "chat",
    prompt: "Write a react component for a simple Toggle Switch.",
    response: `Here is a complete, customizable toggle switch component built using **React** and **Tailwind CSS**.

### Implementation Details
- Fully responsive layout
- Smooth micro-animations for sliding
- Keyboard accessible using focus-ring and ARIA attributes

\`\`\`jsx
import React, { useState } from 'react';

export default function ToggleSwitch({ label, onChange }) {
  const [enabled, setEnabled] = useState(false);

  const handleToggle = () => {
    const nextState = !enabled;
    setEnabled(nextState);
    if (onChange) onChange(nextState);
  };

  return (
    <label className="flex items-center cursor-pointer select-none">
      <span className="mr-3 text-sm font-medium text-slate-300">
        {label || "Toggle setting"}
      </span>
      <div className="relative">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          className="sr-only"
        />
        <div className={\`block w-14 h-8 rounded-full transition-colors duration-300 \${
          enabled ? 'bg-indigo-600' : 'bg-slate-700'
        }\`} />
        <div className={\`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 transform \${
          enabled ? 'translate-x-6' : 'translate-x-0'
        }\`} />
      </div>
    </label>
  );
}
\`\`\`

### How to use:
Include this component in your application and pass in custom labels:
\`\`\`jsx
<ToggleSwitch label="Enable Notifications" onChange={(val) => console.log(val)} />
\`\`\`
`,
    model: "glm-5.1",
    createdAt: "2026-07-06T14:32:00.000Z"
  },
  {
    id: "hist-2",
    userId: "mock-user-id",
    type: "code",
    prompt: "Fix the bounds bug in binary search",
    response: `Here is the corrected binary search implementation.

### The Bug
In your original implementation, the search loop bounds were off by one, which could lead to an infinite loop or missing the last element:
- The mid calculation could overflow in other languages, so it's best to write it defensively.
- The high boundary pointer should decrease to \`mid - 1\` to avoid infinite recursion.

### Corrected Code
\`\`\`javascript
function binarySearch(arr, target) {
  let low = 0;
  let high = arr.length - 1;

  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2);
    const guess = arr[mid];

    if (guess === target) {
      return mid; // Element found, return index
    }
    
    if (guess > target) {
      high = mid - 1; // Search left half
    } else {
      low = mid + 1; // Search right half
    }
  }

  return -1; // Not found
}
\`\`\`
`,
    model: "glm-5.1",
    createdAt: "2026-07-05T09:15:30.000Z"
  },
  {
    id: "hist-3",
    userId: "mock-user-id",
    type: "project",
    prompt: "Project: e-commerce dashboard backend: express, frontend: react, db: mongo",
    response: `## Project Summary
A professional e-commerce dashboard allowing merchants to manage inventory, track orders, and view sales metrics in real-time.

## Recommended Tech Stack
- **Frontend**: React.js, Tailwind CSS, Axios, Chart.js
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (via Mongoose ODM)
- **Authentication**: JWT (JSON Web Tokens) with HTTP-only Cookies

## Folder Structure
\`\`\`text
ecommerce-dashboard/
├── server/
│   ├── controllers/
│   │   ├── authController.js
│   │   └── productController.js
│   ├── models/
│   │   ├── User.js
│   │   └── Product.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── products.js
│   ├── middleware/
│   │   └── auth.js
│   ├── server.js
│   └── .env
└── client/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── App.jsx
    │   └── main.jsx
    └── package.json
\`\`\`

## Frontend Pages
1. **Login & Register**: Authentication forms.
2. **Dashboard Overview**: Sales metrics widgets and charts.
3. **Products Catalog**: CRUD table for adding/editing items.

## Frontend Components
- \`Sidebar.jsx\`: Main dashboard navigation.
- \`StatCard.jsx\`: Key performance indicator boxes.
- \`ProductRow.jsx\`: Individual list item rendering.

## Backend APIs
- \`POST /api/auth/register\` - Create a seller account
- \`POST /api/auth/login\` - Login and receive JWT
- \`GET /api/products\` - Fetch all products
- \`POST /api/products\` - Create a product

## Database Schema
MongoDB collections:
- **users**: \`name\`, \`email\`, \`password\`
- **products**: \`title\`, \`price\`, \`stock\`, \`createdBy\`

## Authentication Flow
User submits email/password -> Express generates JWT -> JWT stored as secure cookie -> Client sends cookie on API requests -> Middleware validates token.

## Development Plan
1. Set up Database connection and Mongoose schemas.
2. Build Express authorization endpoints.
3. Scaffold React client and setup Router.
4. Implement Products dashboard table.

## Starter Code

### Starter App.jsx
\`\`\`jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
\`\`\`

### Starter Product Component
\`\`\`jsx
import React from 'react';

export default function ProductCard({ product }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h3 className="text-white font-bold">{product.name}</h3>
      <p className="text-slate-400">\${product.price}</p>
    </div>
  );
}
\`\`\`

### Starter Server.js
\`\`\`javascript
const express = require('express');
const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(5000, () => console.log('Server running on port 5000'));
\`\`\`

### Starter Express Route
\`\`\`javascript
const express = require('express');
const router = express.Router();

router.get('/products', (req, res) => {
  res.json({ products: [] });
});

module.exports = router;
\`\`\`

### Starter MongoDB Schema
\`\`\`javascript
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
\`\`\`
`,
    model: "glm-5.1",
    createdAt: "2026-07-04T18:10:00.000Z"
  }
];
