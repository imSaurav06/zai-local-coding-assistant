import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiEye, FiEyeOff, FiLock, FiMail, FiUser, FiCpu } from 'react-icons/fi';
import ErrorMessage from '../components/ErrorMessage';

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await register(name, email, password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
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
          <p className="text-[11px] text-dark-muted mt-1 uppercase tracking-wider font-mono">Create account</p>
        </div>

        {/* Card */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6.5 shadow-2xl">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-5 border-b border-dark-border/40 pb-2">
            Sign Up
          </h2>

          {error && (
            <div className="mb-4">
              <ErrorMessage message={error} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="regName" className="block text-[10px] font-bold text-dark-muted uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-muted">
                  <FiUser className="w-4 h-4" />
                </div>
                <input
                  id="regName"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-dark-border rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-brand-500 text-xs font-semibold"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="regEmail" className="block text-[10px] font-bold text-dark-muted uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-muted">
                  <FiMail className="w-4 h-4" />
                </div>
                <input
                  id="regEmail"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-dark-border rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-brand-500 text-xs font-semibold"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="regPassword" className="block text-[10px] font-bold text-dark-muted uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-muted">
                  <FiLock className="w-4 h-4" />
                </div>
                <input
                  id="regPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-9 py-2 bg-slate-900 border border-dark-border rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-brand-500 text-xs font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-dark-muted hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="regConfirmPassword" className="block text-[10px] font-bold text-dark-muted uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-muted">
                  <FiLock className="w-4 h-4" />
                </div>
                <input
                  id="regConfirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-9 pr-9 py-2 bg-slate-900 border border-dark-border rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-brand-500 text-xs font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-dark-muted hover:text-white transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-wider cursor-pointer"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          {/* Links */}
          <p className="mt-5 text-center text-xs text-dark-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand-500 hover:underline transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
