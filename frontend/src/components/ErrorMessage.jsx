import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';

export default function ErrorMessage({ message = 'An unexpected error occurred.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-red-950/20 border border-red-900/50 rounded-xl text-center">
      <div className="text-red-500 mb-2">
        <FiAlertCircle className="w-8 h-8" />
      </div>
      <p className="text-red-400 text-sm font-medium mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800 rounded-lg text-xs transition-all font-semibold"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
