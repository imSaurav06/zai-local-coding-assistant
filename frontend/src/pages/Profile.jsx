import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import { 
  FiUser, 
  FiEdit3, 
  FiSave, 
  FiX, 
  FiMail, 
  FiCalendar, 
  FiCheckCircle 
} from 'react-icons/fi';

export default function Profile() {
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
      
      // Clear success banner after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Could not update profile info.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || '');
    setError('');
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="border-b border-dark-border pb-4">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <FiUser className="text-brand-400" />
          <span>My Profile</span>
        </h1>
        <p className="text-xs text-dark-muted mt-0.5">
          Manage your personal developer account details and display configurations.
        </p>
      </div>

      {/* Success Notification Banner */}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-xl text-emerald-400 text-sm font-semibold animate-fadeIn select-none">
          <FiCheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>Profile saved successfully!</span>
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      {/* Profile Card */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl space-y-6">
        {/* Avatar Display */}
        <div className="flex flex-col items-center border-b border-dark-border/40 pb-6">
          <div className="w-24 h-24 rounded-full bg-brand-500 text-white font-extrabold text-3xl flex items-center justify-center shadow-lg border-4 border-slate-800">
            {getInitials(user?.name || name)}
          </div>
          <h2 className="text-xl font-bold text-white mt-4">{user?.name || 'Developer'}</h2>
          <p className="text-xs text-dark-muted mt-1">AI Coding Assistant Account</p>
        </div>

        {/* Details Form / View */}
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Name Input */}
            <div>
              <label htmlFor="profileName" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Full Name
              </label>
              <input
                id="profileName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="block w-full px-3 py-2 bg-slate-900 border border-dark-border rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 text-sm font-medium"
              />
            </div>

            {/* Email (Disabled/Read-only) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Email Address (Not editable)
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900/50 border border-dark-border/60 rounded-lg text-slate-500 text-sm font-medium">
                <FiMail className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <Loader size="sm" />
                ) : (
                  <>
                    <FiSave className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-dark-border rounded-lg text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
              >
                <FiX className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        ) : (
          // View Mode
          <div className="space-y-5">
            <div className="space-y-4">
              {/* Name Details */}
              <div className="flex justify-between items-center border-b border-dark-border/30 pb-3">
                <div>
                  <span className="block text-[10px] font-bold text-dark-muted uppercase tracking-wider">Full Name</span>
                  <span className="text-white text-sm font-semibold mt-1 block">{user?.name}</span>
                </div>
              </div>

              {/* Email Details */}
              <div className="flex justify-between items-center border-b border-dark-border/30 pb-3">
                <div>
                  <span className="block text-[10px] font-bold text-dark-muted uppercase tracking-wider">Email Address</span>
                  <span className="text-white text-sm font-semibold mt-1 block">{user?.email}</span>
                </div>
              </div>

              {/* Created Date */}
              <div className="flex justify-between items-center pb-1">
                <div>
                  <span className="block text-[10px] font-bold text-dark-muted uppercase tracking-wider">Registered Since</span>
                  <span className="text-white text-sm font-semibold mt-1 block flex items-center gap-1.5">
                    <FiCalendar className="text-brand-400 w-4 h-4" />
                    <span>{new Date(user?.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Edit Button */}
            <button
              onClick={() => setIsEditing(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-dark-border rounded-xl text-xs uppercase tracking-wider transition-all font-bold cursor-pointer"
            >
              <FiEdit3 className="w-3.5 h-3.5" />
              <span>Edit Display Name</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
