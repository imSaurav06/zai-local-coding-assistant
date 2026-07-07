import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiEye, FiEyeOff, FiLock, FiMail, FiCpu } from 'react-icons/fi';
import ErrorMessage from '../components/ErrorMessage';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to workspace
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-brand-500/10 text-brand-400 rounded-2xl mb-4 border border-brand-500/20 shadow-lg shadow-brand-500/5">
            <FiCpu className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Z.ai <span className="text-brand-400">Assistant</span>
          </h1>
          <p className="text-sm text-dark-muted mt-2 text-center">
            Professional Browser-Based AI Coding Dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold mb-6 text-white text-center">Sign In to Your Account</h2>

          {error && (
            <div className="mb-5">
              <ErrorMessage message={error} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <FiMail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-dark-border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="block text-xs font-semibold text-dark-muted uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <FiLock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-dark-border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-500/10 hover:shadow-brand-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none text-sm cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          {/* Create Account Link */}
          <p className="mt-6 text-center text-sm text-dark-muted">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-brand-400 hover:text-brand-300 transition-colors">
              Create an account
            </Link>
          </p>
        </div>

        {/* Demo Credentials Note */}
        <div className="mt-6 bg-indigo-950/15 border border-indigo-900/40 rounded-xl p-4 text-center">
          <p className="text-xs text-indigo-300">
            <span className="font-semibold uppercase tracking-wider mr-2">Demo Credentials:</span>
            Email: <span className="font-mono text-white bg-slate-800/40 px-1 py-0.5 rounded">demo@zai.dev</span> | 
            Password: <span className="font-mono text-white bg-slate-800/40 px-1 py-0.5 rounded">password123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
