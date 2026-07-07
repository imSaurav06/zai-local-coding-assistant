import React from 'react';
import ReactMarkdown from 'react-markdown';
import { FiUser, FiCpu } from 'react-icons/fi';
import CodeBlock from './CodeBlock';
import GeneratedProjectPanel from './GeneratedProjectPanel';

export default function MessageBubble({ msg }) {
  const isUser = msg.sender === 'user';

  return (
    <div className={`flex gap-4 p-5 rounded-2xl border transition-all ${
      isUser
        ? 'bg-dark-card/30 border-dark-border/40 max-w-3xl ml-auto flex-row-reverse'
        : 'bg-dark-card/85 border-dark-border/60 max-w-4xl mr-auto'
    }`}>
      {/* Avatar Icon */}
      <div className={`p-2 rounded-xl h-fit flex-shrink-0 border select-none ${
        isUser
          ? 'bg-dark-composer text-dark-muted border-dark-border'
          : 'bg-brand-500/10 text-brand-500 border-brand-500/20'
      }`}>
        {isUser ? <FiUser className="w-4 h-4" /> : <FiCpu className="w-4 h-4" />}
      </div>

      {/* Message Content */}
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-center mb-1.5 select-none text-[10px] text-dark-muted font-mono">
          <span className="font-bold text-dark-text/70">
            {isUser ? 'You' : 'Z.ai Assistant'}
          </span>
          <span>
            {!isUser && msg.model && `[${msg.model}] `}
            {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>

        {isUser ? (
          <p className="text-slate-200 text-sm whitespace-pre-wrap font-mono leading-relaxed">
            {msg.content}
          </p>
        ) : (
          <div className="space-y-4">
            {/* Standard AI Markdown Response */}
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

            {/* Render Generated Project Scaffolding Panel (if applicable) */}
            {msg.generatedProject && (
              <div className="pt-2 border-t border-dark-border/40">
                <GeneratedProjectPanel generatedProject={msg.generatedProject} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
