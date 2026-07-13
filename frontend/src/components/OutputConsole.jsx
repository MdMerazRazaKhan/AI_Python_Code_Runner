import React from 'react';
import { Terminal, Trash2, Cpu, Sparkles } from 'lucide-react';

export default function OutputConsole({ output, error, executionTime, status, engine, isLoading, onClear, onQuickFix, isFixing }) {
  const getStatusClass = () => {
    if (isLoading) return 'idle';
    if (!status) return 'idle';
    return status.toLowerCase();
  };

  const getStatusLabel = () => {
    if (isLoading) return 'Running...';
    if (!status) return 'Idle';
    return status;
  };

  const isError = status === 'Error' || (error && error.trim().length > 0);

  return (
    <div className="glass-panel console-panel animate-fade" style={{ height: '240px', minHeight: '180px', maxHeight: '380px' }}>
      <div className="console-header">
        <div className="console-title-container">
          <Terminal size={14} className="console-title-icon" />
          <span>Execution Output Console</span>
        </div>
        
        <div className="console-meta">
          {/* AI Quick Fix Button - Only shown when there is an active error */}
          {isError && !isLoading && onQuickFix && (
            <button
              onClick={onQuickFix}
              disabled={isFixing}
              className="action-btn"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                borderColor: 'transparent',
                color: 'white',
                fontWeight: 600,
                boxShadow: '0 0 10px rgba(124, 58, 237, 0.4)',
                animation: 'pulse 2s infinite',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Click to automatically let AI debug and fix the code"
            >
              {isFixing ? (
                <>
                  <svg className="spin-loader" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10" />
                  </svg>
                  <span>Fixing Code...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>AI Quick Fix</span>
                </>
              )}
            </button>
          )}

          {executionTime !== undefined && executionTime !== null && !isLoading && status && (
            <div className="console-time" title="Execution Time">
              <Cpu size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {executionTime} ms
            </div>
          )}
          
          {engine && !isLoading && (
            <div
              className="console-status-pill"
              style={{
                background: engine === 'docker' ? 'var(--success-glow)' : 'var(--warning-glow)',
                color: engine === 'docker' ? 'var(--success-color)' : 'var(--warning-color)',
                borderColor: engine === 'docker' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              {engine === 'docker' ? 'Docker Sandbox' : 'Local Host (Sandbox)'}
            </div>
          )}

          <div className={`console-status-pill ${getStatusClass()}`}>
            {getStatusLabel()}
          </div>
          
          <button
            onClick={onClear}
            className="clear-history-btn"
            title="Clear Console"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            disabled={isLoading || (!output && !error)}
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>
      
      <div className="console-body">
        {isLoading ? (
          <div className="console-text-idle" style={{ flexDirection: 'column', gap: '10px' }}>
            <svg className="spin-loader" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10" />
            </svg>
            <span>Executing Python code in sandboxed runtime...</span>
          </div>
        ) : error || output ? (
          <>
            {output && <div className="console-text-stdout">{output}</div>}
            {error && <div className="console-text-stderr">{error}</div>}
          </>
        ) : (
          <div className="console-text-idle">
            <span>Terminal ready. Write Python code in the editor above and click "Run Code".</span>
          </div>
        )}
      </div>
    </div>
  );
}
