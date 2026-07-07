import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Workspace from './pages/Workspace';

function HistoryRedirect() {
  const { id } = useParams();
  return <Navigate to="/app" state={{ historyId: id }} replace />;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes (under DashboardLayout) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Redirect / to /app */}
            <Route index element={<Navigate to="/app" replace />} />
            <Route path="app" element={<Workspace />} />
            <Route path="history" element={<Navigate to="/app" state={{ openHistory: true }} replace />} />
            <Route path="history/:id" element={<HistoryRedirect />} />
            <Route path="profile" element={<Navigate to="/app" state={{ openProfile: true }} replace />} />
          </Route>

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

