import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatService } from '../services/chatService';
import { historyService } from '../services/historyService';
import PromptTemplates from './PromptTemplates';
import CodeBlock from './CodeBlock';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import { 
  FiSend, 
  FiTrash2, 
  FiCpu, 
  FiUser, 
  FiMessageSquare 
} from 'react-icons/fi';

export default function AskAIMode() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const activePrompt = textToSend || prompt;
    if (!activePrompt.trim()) return;

    setError('');
    setLoading(true);

    const userMsg = { sender: 'user', content: activePrompt, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');

    try {
      const response = await chatService.sendMessage({ prompt: activePrompt });

      // Save to mock history
      const savedItem = await historyService.saveHistory({
        prompt: activePrompt,
        response: response.message,
        type: 'chat',
        model: response.model
      });

      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          content: response.message,
          model: response.model,
          timestamp: new Date(response.createdAt),
          historyId: savedItem.id
        }
      ]);
    } catch (err) {
      setError(err.message || 'Chat assistant failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] space-y-4">
      {/* Top controls */}
      <div className="flex justify-between items-center border-b border-dark-border/40 pb-3 select-none">
        <span className="text-xs text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-full font-mono font-medium">
          GLM-5.1 Active
        </span>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-red-950/20 text-slate-400 hover:text-red-400 border border-dark-border hover:border-red-900/30 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          >
            <FiTrash2 className="w-3.5 h-3.5" />
            <span>Clear Thread</span>
          </button>
        )}
      </div>

      {/* Messages Gutter */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="text-center max-w-lg mx-auto bg-dark-card border border-dark-border rounded-xl p-6 shadow-md mt-4">
              <div className="p-3 bg-slate-800/40 text-brand-400 rounded-full w-fit mx-auto mb-3">
                <FiMessageSquare className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-white text-base font-bold mb-1">Interactive Coding Chat</h3>
              <p className="text-dark-muted text-xs leading-relaxed">
                Describe code files you want constructed or paste code errors. Click on suggestions templates below to populate prompts instantly.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-dark-muted mb-2 px-1">
                Suggestions
              </p>
              <PromptTemplates onSelect={(txt) => handleSend(txt)} />
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto w-full">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-4 p-4 rounded-xl border ${
                  msg.sender === 'user'
                    ? 'bg-slate-900/30 border-dark-border'
                    : 'bg-dark-card border-[#1E2942]/40'
                }`}
              >
                <div className={`p-2 rounded-lg h-fit flex-shrink-0 border ${
                  msg.sender === 'user'
                    ? 'bg-slate-800 text-slate-400 border-slate-750'
                    : 'bg-brand-500/10 text-brand-400 border-brand-500/20'
                }`}>
                  {msg.sender === 'user' ? <FiUser className="w-4 h-4" /> : <FiCpu className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1.5 select-none">
                    <span className="text-xs font-bold text-white">
                      {msg.sender === 'user' ? 'You' : 'Assistant'}
                    </span>
                    <span className="text-[9px] text-dark-muted font-mono">
                      {msg.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>

                  {msg.sender === 'user' ? (
                    <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed font-mono">
                      {msg.content}
                    </p>
                  ) : (
                    <div className="prose-custom">
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
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-4 p-4 rounded-xl bg-dark-card border border-dark-border w-fit max-w-sm">
                <div className="p-2 bg-brand-500/10 text-brand-400 rounded-lg animate-pulse">
                  <FiCpu className="w-4 h-4" />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-xs font-semibold text-slate-300">Assistant is thinking...</span>
                  <div className="mt-1 flex justify-start">
                    <Loader size="sm" />
                  </div>
                </div>
              </div>
            )}

            {error && <ErrorMessage message={error} />}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input textbox */}
      <div className="border-t border-dark-border/40 pt-3 bg-dark-bg mt-auto w-full max-w-4xl mx-auto">
        <div className="relative bg-slate-900 border border-dark-border rounded-xl focus-within:border-brand-500/80 transition-all p-2 flex items-end">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={2}
            placeholder="Ask coding assistant queries... (Enter to send, Shift+Enter for new line)"
            className="flex-1 bg-transparent border-0 outline-none text-xs text-white placeholder-slate-650 p-2.5 resize-none max-h-32 scrollbar-thin"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !prompt.trim()}
            className="p-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg transition-all ml-2 cursor-pointer flex-shrink-0"
          >
            <FiSend className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
