import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { historyService } from '../services/historyService';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import CodeBlock from '../components/CodeBlock';
import { 
  FiClock, 
  FiArrowLeft, 
  FiTrash2, 
  FiCopy, 
  FiCheckCircle, 
  FiX, 
  FiCheck,
  FiFileText,
  FiCpu
} from 'react-icons/fi';
import { formatDate } from '../utils/formatDate';
import { copyToClipboard } from '../utils/copyToClipboard';

export default function HistoryDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await historyService.getHistoryById(id);
        setItem(data);
      } catch (err) {
        setError(err.message || 'The specified history record does not exist or has been deleted.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const handleCopy = async () => {
    if (!item?.response) return;
    const success = await copyToClipboard(item.response);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = async () => {
    try {
      await historyService.deleteHistory(id);
      navigate('/history');
    } catch (err) {
      setError('Could not delete history record.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-lg mx-auto py-8">
        <ErrorMessage message={error} />
        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-dark-border mx-auto cursor-pointer"
        >
          <FiArrowLeft className="w-3.5 h-3.5" />
          <span>Return to History list</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
      {/* Navigation & Actions Top bar */}
      <div className="flex justify-between items-center border-b border-dark-border pb-4">
        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-dark-border rounded-lg text-xs font-semibold transition-all cursor-pointer select-none"
        >
          <FiArrowLeft className="w-3.5 h-3.5" />
          <span>Back to List</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-dark-border rounded-lg text-xs font-semibold transition-all cursor-pointer select-none"
          >
            {copied ? (
              <>
                <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <FiCopy className="w-3.5 h-3.5" />
                <span>Copy Output</span>
              </>
            )}
          </button>

          {/* Delete Action (with inline confirm trigger) */}
          {confirmDelete ? (
            <div className="flex items-center gap-2 animate-fadeIn bg-slate-900 border border-red-500/30 p-1 rounded-lg">
              <span className="text-[10px] font-bold text-red-400 px-2">Are you sure?</span>
              <button
                onClick={handleDelete}
                className="p-1 text-emerald-400 hover:bg-emerald-950/20 rounded cursor-pointer"
                title="Confirm delete record"
              >
                <FiCheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="p-1 text-slate-400 hover:bg-slate-800 rounded cursor-pointer"
                title="Cancel deletion"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-red-900/30 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none"
            >
              <FiTrash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Details Document */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl space-y-6">
        {/* Meta Header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-dark-border/40 pb-4">
          <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded border ${
            item.type === 'chat'
              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              : item.type === 'project'
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}>
            {item.type} session
          </span>
          <span className="text-[10px] font-mono text-dark-muted bg-slate-900 border border-dark-border px-2 py-1 rounded">
            model: {item.model}
          </span>
          <span className="text-[10px] text-dark-muted flex items-center gap-1">
            <FiClock className="w-3.5 h-3.5 text-brand-400" />
            <span>{formatDate(item.createdAt)}</span>
          </span>
        </div>

        {/* Prompt Card */}
        <div className="bg-slate-900/60 border border-dark-border rounded-xl p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-dark-muted mb-2 flex items-center gap-1.5">
            <FiFileText className="text-brand-400" />
            <span>Prompt Sent</span>
          </h2>
          <p className="text-sm font-semibold text-white leading-relaxed font-mono whitespace-pre-wrap">
            {item.prompt}
          </p>
        </div>

        {/* AI Output Response Markdown */}
        <div className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-dark-muted flex items-center gap-1.5 select-none">
            <FiCpu className="text-brand-400" />
            <span>AI Response Output</span>
          </h2>
          <div className="prose-custom border border-dark-border bg-slate-900/25 p-5 rounded-xl">
            <ReactMarkdown
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match;
                  return !isInline ? (
                    <CodeBlock
                      code={String(children).replace(/\n$/, '')}
                      language={match[1]}
                    />
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {item.response}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
