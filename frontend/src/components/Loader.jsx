import React from 'react';

export default function Loader({ size = 'md' }) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div className={`animate-spin rounded-full border-t-brand-500 border-r-transparent border-b-brand-500 border-l-transparent ${sizeClasses[size] || sizeClasses.md}`}></div>
    </div>
  );
}
