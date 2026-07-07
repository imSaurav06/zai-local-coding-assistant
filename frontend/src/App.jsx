import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Workspace from './pages/Workspace';
import History from './pages/History';
import HistoryDetails from './pages/HistoryDetails';
import Profile from './pages/Profile';

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
            <Route path="history" element={<History />} />
            <Route path="history/:id" element={<HistoryDetails />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
