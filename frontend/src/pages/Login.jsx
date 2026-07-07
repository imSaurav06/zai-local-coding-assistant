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
    <div className="min-h-screen bg-dark-bg text-dark-text flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans select-none">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-brand-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm z-10 space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center">
          <div className="p-3 bg-brand-500/10 text-brand-500 border border-brand-500/20 rounded-2xl mb-4 shadow-sm shadow-brand-500/5">
            <FiCpu className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Z.ai Assistant</h1>
          <p className="text-[11px] text-dark-muted mt-1 uppercase tracking-wider font-mono">Conversational Coding Companion</p>
        </div>

        {/* Card */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6.5 shadow-2xl">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-5 border-b border-dark-border/40 pb-2">
            Sign In
          </h2>

          {error && (
            <div className="mb-4">
              <ErrorMessage message={error} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="loginEmail" className="block text-[10px] font-bold text-dark-muted uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-muted">
                  <FiMail className="w-4 h-4" />
                </div>
                <input
                  id="loginEmail"
                  type="email"
                  required
                  placeholder="e.g. developer@zai.dev"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-dark-border rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-brand-500 text-xs font-semibold"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="loginPassword" className="block text-[10px] font-bold text-dark-muted uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-muted">
                  <FiLock className="w-4 h-4" />
                </div>
                <input
                  id="loginPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-9 py-2 bg-slate-900 border border-dark-border rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-brand-500 text-xs font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-dark-muted hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-wider cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Links */}
          <p className="mt-5 text-center text-xs text-dark-muted">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-brand-500 hover:underline transition-colors">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
