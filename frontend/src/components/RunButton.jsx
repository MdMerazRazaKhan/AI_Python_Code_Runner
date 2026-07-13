import React from 'react';
import { Play } from 'lucide-react';

export default function RunButton({ onClick, isLoading, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className="action-btn btn-run"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        fontSize: '0.85rem'
      }}
    >
      {isLoading ? (
        <svg className="spin-loader" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10" />
        </svg>
      ) : (
        <Play size={14} fill="currentColor" />
      )}
      <span>Run Python Script</span>
    </button>
  );
}
