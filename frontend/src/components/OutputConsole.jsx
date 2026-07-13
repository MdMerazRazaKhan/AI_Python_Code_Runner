import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Trash2, Cpu, Sparkles } from 'lucide-react';

export default function OutputConsole({
  lines = [],
  executionTime,
  status,
  engine,
  isLoading,
  onClear,
  onQuickFix,
  isFixing,
  onStdinSubmit
}) {
  const [inputValue, setInputValue] = useState('');
  const consoleBodyRef = useRef(null);
  const inputRef = useRef(null);

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

  // Check if there are errors in the execution
  const hasError = lines.some((line) => line.type === 'stderr') || status === 'Error';

  // Auto-scroll to the bottom of the console whenever output changes
  useEffect(() => {
    if (consoleBodyRef.current) {
      consoleBodyRef.current.scrollTop = consoleBodyRef.current.scrollHeight;
    }
  }, [lines, isLoading]);

  // Focus the input field when clicking anywhere on the terminal console
  const handleConsoleClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const data = inputValue;
      onStdinSubmit(data);
      setInputValue('');
    }
  };

  return (
    <div className="glass-panel console-panel animate-fade" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="console-header" style={{ flexShrink: 0 }}>
        <div className="console-title-container">
          <Terminal size={14} className="console-title-icon" />
          <span>Execution Output Console</span>
        </div>
        
        <div className="console-meta">
          {/* AI Quick Fix Button */}
          {hasError && !isLoading && onQuickFix && (
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
            disabled={isLoading || lines.length === 0}
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>
      
      <div 
        ref={consoleBodyRef}
        onClick={handleConsoleClick}
        className="console-body"
        style={{ 
          flexGrow: 1, 
          overflowY: 'auto', 
          cursor: 'text', 
          padding: '16px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.85rem',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}
      >
        {lines.length > 0 ? (
          <div style={{ display: 'inline' }}>
            {lines.map((line, idx) => (
              <span
                key={idx}
                className={`console-text-${line.type}`}
                style={{
                  color: line.type === 'stdout' ? 'var(--text-primary)' : line.type === 'stderr' ? '#f87171' : '#34d399',
                  fontWeight: line.type === 'stdin' ? 'bold' : 'normal'
                }}
              >
                {line.text}
              </span>
            ))}
            
            {/* Inline dynamic terminal input */}
            {isLoading && (
              <span style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#34d399',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    padding: 0,
                    margin: 0,
                    fontWeight: 'bold',
                    width: `${Math.max(1, inputValue.length) * 8}px`,
                    minWidth: '10px',
                    caretColor: 'var(--accent-color)'
                  }}
                  autoFocus
                />
              </span>
            )}
          </div>
        ) : isLoading ? (
          <div className="console-text-idle" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', color: 'var(--text-secondary)' }}>
            <svg className="spin-loader" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10" />
            </svg>
            <span>Starting execution environment...</span>
          </div>
        ) : (
          <div className="console-text-idle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            <span>You must run your code first</span>
          </div>
        )}
      </div>
    </div>
  );
}
