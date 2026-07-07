import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { historyService } from '../services/historyService';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import { 
  FiClock, 
  FiSearch, 
  FiEye, 
  FiTrash2, 
  FiX, 
  FiCheckCircle, 
  FiFilter 
} from 'react-icons/fi';
import { formatDate } from '../utils/formatDate';

export default function History() {
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  
  // Track item ID that is in deletion confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await historyService.getHistory();
      setHistory(data);
    } catch (err) {
      setError('Could not retrieve activity history records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id) => {
    try {
      await historyService.deleteHistory(id);
      // Remove local copy
      setHistory(prev => prev.filter(item => item.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError('Failed to delete history item.');
    }
  };

  // Filter history based on search query and type filter
  const filteredHistory = history.filter((item) => {
    const matchesSearch = item.prompt.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.response.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === 'All' || item.type.toLowerCase() === selectedType.toLowerCase();
    
    return matchesSearch && matchesType;
  });

  const typeOptions = ['All', 'Chat', 'Project', 'Code'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-dark-border pb-4">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <FiClock className="text-brand-400" />
          <span>Activity History</span>
        </h1>
        <p className="text-xs text-dark-muted mt-0.5">
          Review, analyze, or delete your previous generation prompt results.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-dark-card border border-dark-border p-4 rounded-xl shadow">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <FiSearch className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search prompts or output responses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-4 py-2 bg-slate-900 border border-dark-border rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 text-xs font-medium"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
          <FiFilter className="w-3.5 h-3.5 text-dark-muted mr-1.5 flex-shrink-0" />
          {typeOptions.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer select-none flex-shrink-0 ${
                selectedType === type
                  ? 'bg-brand-500/10 text-brand-400 border-brand-500/40'
                  : 'text-dark-muted border-dark-border bg-slate-900 hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchHistory} />}

      {/* List */}
      {filteredHistory.length === 0 ? (
        <EmptyState
          title="No history items found"
          message="No records match your filters or queries. Try expanding your search terms or generate new items."
          icon={FiClock}
        />
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className={`bg-dark-card border rounded-xl p-5 shadow transition-all duration-300 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 ${
                confirmDeleteId === item.id ? 'border-red-500/40 bg-red-950/5' : 'border-dark-border hover:border-brand-500/20'
              }`}
            >
              {/* Info Column */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                    item.type === 'chat'
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      : item.type === 'project'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {item.type}
                  </span>
                  <span className="text-[10px] font-mono text-dark-muted bg-slate-900 border border-dark-border px-1.5 py-0.5 rounded">
                    {item.model}
                  </span>
                  <span className="text-[10px] text-dark-muted flex items-center gap-1">
                    <span>•</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </span>
                </div>
                <div>
                  <h3 className="text-white text-sm font-bold truncate leading-tight">
                    {item.prompt}
                  </h3>
                  <p className="text-dark-muted text-xs line-clamp-2 mt-1 leading-relaxed font-mono">
                    {item.response.replace(/[#*`]/g, '').trim()}
                  </p>
                </div>
              </div>

              {/* Actions Column */}
              <div className="flex items-center justify-end gap-2 border-t border-dark-border/40 md:border-t-0 pt-3 md:pt-0">
                {confirmDeleteId === item.id ? (
                  // Inline Delete Confirmation
                  <div className="flex items-center gap-2 animate-fadeIn bg-slate-900/60 p-1.5 rounded-lg border border-red-500/25">
                    <span className="text-[10px] font-bold text-red-400 px-2">Are you sure?</span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 text-emerald-400 hover:bg-emerald-950/20 rounded cursor-pointer"
                      title="Confirm deletion"
                    >
                      <FiCheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="p-1 text-slate-400 hover:bg-slate-800 rounded cursor-pointer"
                      title="Cancel deletion"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  // Standard Action Buttons
                  <>
                    <button
                      onClick={() => navigate(`/history/${item.id}`)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-dark-border transition-all cursor-pointer"
                      title="Open details"
                    >
                      <FiEye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="p-2 text-dark-muted hover:text-red-400 hover:bg-red-950/25 hover:border-red-900/30 border border-transparent rounded-lg transition-all cursor-pointer"
                      title="Delete activity record"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
