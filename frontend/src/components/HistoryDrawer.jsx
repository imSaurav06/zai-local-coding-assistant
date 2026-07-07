import React, { useState, useEffect } from 'react';
import { historyService } from '../services/historyService';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import EmptyState from './EmptyState';
import { 
  FiClock, 
  FiSearch, 
  FiX, 
  FiTrash2, 
  FiChevronRight, 
  FiCheck,
  FiFilter
} from 'react-icons/fi';
import { formatDate } from '../utils/formatDate';

export default function HistoryDrawer({ 
  isOpen, 
  onClose, 
  onSelectHistoryItem 
}) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await historyService.getHistory();
      setHistory(data);
    } catch (err) {
      setError('Could not retrieve history records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await historyService.deleteHistory(id);
      setHistory((prev) => prev.filter(item => item.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError('Failed to delete history item.');
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch = item.prompt.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.response.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === 'All' || item.type.toLowerCase() === selectedType.toLowerCase();
    
    return matchesSearch && matchesType;
  });

  const typeOptions = ['All', 'Chat', 'Project', 'Code'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden text-dark-text select-none animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide drawer */}
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-dark-sidebar border-l border-dark-border shadow-2xl flex flex-col justify-between">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-dark-border/40 bg-dark-card/20">
          <div className="flex items-center gap-2">
            <FiClock className="text-brand-500 w-4.5 h-4.5" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Conversation History</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-dark-muted hover:text-white transition-colors cursor-pointer"
            aria-label="Close history drawer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Searches */}
        <div className="px-5 py-3.5 space-y-3 border-b border-dark-border/40 bg-dark-sidebar">
          {/* Search bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-muted">
              <FiSearch className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white placeholder-slate-650 focus:outline-none focus:border-brand-500 text-xs font-semibold"
            />
          </div>

          {/* Filter Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            <FiFilter className="w-3 text-dark-muted flex-shrink-0" />
            {typeOptions.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex-shrink-0 ${
                  selectedType === type
                    ? 'bg-brand-500/10 text-brand-500 border-brand-500/30'
                    : 'text-dark-muted border-dark-border bg-slate-900 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-grow overflow-y-auto px-4 py-4 space-y-3 bg-dark-bg/25">
          {loading && (
            <div className="py-12">
              <Loader size="md" />
            </div>
          )}

          {error && <ErrorMessage message={error} />}

          {!loading && filteredHistory.length === 0 && (
            <div className="py-6">
              <EmptyState 
                title="No history items" 
                message="Your search results returned no workspace logs." 
                icon={FiClock} 
              />
            </div>
          )}

          {!loading && filteredHistory.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onSelectHistoryItem(item);
                onClose();
              }}
              className={`p-3.5 rounded-xl border bg-dark-card hover:bg-dark-hover transition-all duration-200 cursor-pointer flex justify-between gap-3 group relative overflow-hidden ${
                confirmDeleteId === item.id ? 'border-red-500/40' : 'border-dark-border hover:border-brand-500/20 shadow-sm'
              }`}
            >
              <div className="flex-grow min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                    item.type === 'chat'
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      : item.type === 'project'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {item.type}
                  </span>
                  <span className="text-[8px] font-mono text-dark-muted">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white truncate leading-tight pr-4">
                  {item.prompt}
                </h4>
                <p className="text-[10px] text-dark-muted font-mono line-clamp-2 leading-relaxed">
                  {item.response.replace(/[#*`]/g, '').trim()}
                </p>
              </div>

              {/* Actions Column */}
              <div className="flex items-center flex-shrink-0 self-center">
                {confirmDeleteId === item.id ? (
                  <div className="flex items-center gap-1 bg-slate-900 border border-red-500/35 p-1 rounded-lg z-10 animate-fadeIn">
                    <button
                      onClick={(e) => handleDelete(e, item.id)}
                      className="p-1 text-emerald-400 hover:bg-emerald-950/20 rounded cursor-pointer"
                      title="Confirm delete"
                    >
                      <FiCheck className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(null);
                      }}
                      className="p-1 text-slate-400 hover:bg-slate-800 rounded cursor-pointer"
                      title="Cancel delete"
                    >
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(item.id);
                      }}
                      className="p-1.5 text-dark-muted hover:text-red-400 rounded-lg hover:bg-red-950/20 border border-transparent hover:border-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                      title="Delete activity record"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                    <FiChevronRight className="w-4 h-4 text-dark-muted group-hover:text-white transition-colors flex-shrink-0 group-hover:translate-x-0.5 duration-200" />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
