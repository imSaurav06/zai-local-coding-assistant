import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { copyToClipboard } from '../utils/copyToClipboard';

export default function CodeBlock({ code, language = 'javascript' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const cleanCode = code ? code.trim() : '';
    const success = await copyToClipboard(cleanCode);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group border border-dark-border rounded-lg overflow-hidden my-4 bg-[#151b27]">
      {/* CodeBlock Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0e131d] border-b border-dark-border select-none">
        <span className="text-xs font-semibold text-dark-muted font-mono uppercase">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-dark-muted hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-all"
          title="Copy code to clipboard"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <FiCopy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="overflow-x-auto text-sm font-mono leading-relaxed">
        <SyntaxHighlighter
          language={language.toLowerCase()}
          style={atomDark}
          customStyle={{
            margin: 0,
            padding: '1.25rem',
            background: 'transparent',
            fontSize: '0.875rem',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'Fira Code, Courier New, monospace',
            }
          }}
        >
          {code ? code.trim() : ''}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
