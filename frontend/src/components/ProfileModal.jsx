import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import { 
  FiX, 
  FiUser, 
  FiMail, 
  FiCheckCircle, 
  FiSave,
  FiCalendar 
} from 'react-icons/fi';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, updateProfile } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const getInitials = (name) => {
    if (!name) return 'Z';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name field cannot be empty.');
      return;
    }

    setError('');
    setLoading(true);
    setSuccess(false);

    try {
      await updateProfile(name.trim());
      setSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Could not update profile display name.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || '');
    setError('');
    setIsEditing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden text-dark-text select-none animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-sm p-6 shadow-2xl z-15 relative space-y-5 animate-scaleUp">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-dark-muted hover:text-white transition-colors cursor-pointer"
          aria-label="Close profile modal"
        >
          <FiX className="w-5 h-5" />
        </button>

        {/* Avatar Display */}
        <div className="flex flex-col items-center border-b border-dark-border/40 pb-5">
          <div className="w-20 h-20 rounded-full bg-brand-500 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg border-2 border-dark-border">
            {getInitials(user?.name || name)}
          </div>
          <h3 className="text-base font-bold text-white mt-3.5 leading-none">
            {user?.name || 'Developer'}
          </h3>
          <p className="text-[10px] text-dark-muted font-mono tracking-wider uppercase mt-1">Z.ai Member Account</p>
        </div>

        {success && (
          <div className="flex items-center gap-2 bg-emerald-950/20 border border-emerald-500/30 p-3.5 rounded-xl text-emerald-400 text-xs font-semibold select-none animate-fadeIn">
            <FiCheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>Profile name updated successfully!</span>
          </div>
        )}

        {error && <ErrorMessage message={error} />}

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Input name */}
            <div>
              <label htmlFor="profileModalName" className="block text-[10px] font-bold text-dark-muted mb-1.5 uppercase tracking-wider">
                Full Name
              </label>
              <input
                id="profileModalName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="block w-full px-3 py-2 bg-slate-900 border border-dark-border rounded-lg text-white text-xs font-semibold focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-[10px] font-bold text-dark-muted mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 border border-dark-border/60 rounded-lg text-slate-500 text-xs font-medium">
                <FiMail className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-grow flex items-center justify-center gap-1.5 py-2 px-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer"
              >
                {loading ? <Loader size="sm" /> : (
                  <>
                    <FiSave className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="flex-grow flex items-center justify-center gap-1.5 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white border border-dark-border rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer"
              >
                <FiX className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 text-xs leading-relaxed">
              <div className="flex justify-between border-b border-dark-border/30 pb-2">
                <span className="text-dark-muted font-semibold flex items-center gap-1.5">
                  <FiUser className="w-3.5 h-3.5 text-brand-500" />
                  <span>Display Name:</span>
                </span>
                <span className="font-bold text-white">{user?.name}</span>
              </div>
              <div className="flex justify-between border-b border-dark-border/30 pb-2">
                <span className="text-dark-muted font-semibold flex items-center gap-1.5">
                  <FiMail className="w-3.5 h-3.5 text-brand-500" />
                  <span>Email:</span>
                </span>
                <span className="font-bold text-white">{user?.email}</span>
              </div>
              <div className="flex justify-between border-b border-dark-border/30 pb-2">
                <span className="text-dark-muted font-semibold flex items-center gap-1.5">
                  <FiCalendar className="w-3.5 h-3.5 text-brand-500" />
                  <span>Created:</span>
                </span>
                <span className="font-bold text-white">
                  {new Date(user?.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border border-dark-border cursor-pointer"
            >
              Update Display Name
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
