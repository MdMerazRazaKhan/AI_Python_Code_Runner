import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Trash2, Cpu, Sparkles, Play } from 'lucide-react';

export default function OutputConsole({
  lines = [],
  executionTime,
  status,
  engine,
  isLoading,
  onClear,
  onQuickFix,
  isFixing,
  onStdinSubmit,
  memoryUsage,
  exitCode,
  testCases = [],
  testCaseResults = null,
  onRunTestCases
}) {
  const [inputValue, setInputValue] = useState('');
  const consoleBodyRef = useRef(null);
  const inputRef = useRef(null);

  // Tabs: 'output' | 'testcases'
  const [activeConsoleTab, setActiveConsoleTab] = useState('output');
  const [localTestCases, setLocalTestCases] = useState(() => {
    return testCases.length > 0 ? testCases : [{ id: 1, input: '', expected: '' }];
  });
  const [activeCaseId, setActiveCaseId] = useState(1);

  // Floating & Draggable state
  const [isFloating, setIsFloating] = useState(false);
  const [position, setPosition] = useState({ x: 300, y: 250 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (testCases && testCases.length > 0) {
      setLocalTestCases(testCases);
      if (!testCases.some(tc => tc.id === activeCaseId)) {
        setActiveCaseId(testCases[0].id);
      }
    }
  }, [testCases]);

  const getStatusClass = () => {
    if (isLoading) return 'idle';
    if (!status) return 'idle';
    const s = status.toLowerCase();
    if (s.includes('limit')) return 'timeout';
    if (s.includes('compile') || s.includes('error')) return 'error';
    return 'success';
  };

  const getStatusLabel = () => {
    if (isLoading) return 'Running...';
    if (!status) return 'Idle';
    return status;
  };

  // Check if there are errors in the execution
  const hasError = lines.some((line) => line.type === 'stderr') || (status && (status.toLowerCase().includes('error') || status.toLowerCase().includes('limit')));

  // Auto-scroll to the bottom of the console whenever output changes
  useEffect(() => {
    if (consoleBodyRef.current && activeConsoleTab === 'output') {
      consoleBodyRef.current.scrollTop = consoleBodyRef.current.scrollHeight;
    }
  }, [lines, isLoading, activeConsoleTab]);

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

  // Dragging event handlers
  const handleHeaderMouseDown = (e) => {
    if (!isFloating) return;
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const renderHeader = () => (
    <div 
      className="console-header" 
      style={{ 
        flexShrink: 0, 
        cursor: isFloating ? 'move' : 'default',
        userSelect: 'none'
      }}
      onMouseDown={handleHeaderMouseDown}
    >
      <div className="console-title-container">
        <Terminal size={14} className="console-title-icon" />
        <span>Execution Output Console {isFloating && '(Floating)'}</span>
      </div>
      
      <div className="console-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {/* Run Test Cases Button */}
        {activeConsoleTab === 'testcases' && onRunTestCases && (
          <button
            onClick={() => onRunTestCases(localTestCases)}
            disabled={isLoading}
            className="action-btn animate-fade"
            style={{
              background: 'var(--accent-color)',
              borderColor: 'transparent',
              color: '#ffffff',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              height: '32px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(56, 189, 248, 0.2)'
            }}
            title="Execute active code against all test cases"
          >
            {isLoading ? (
              <>
                <svg className="spin-loader" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10" />
                </svg>
                <span>Running Cases...</span>
              </>
            ) : (
              <>
                <Play size={12} fill="currentColor" />
                <span>Run Test Cases</span>
              </>
            )}
          </button>
        )}

        {/* AI Quick Fix Button */}
        {hasError && !isLoading && onQuickFix && activeConsoleTab === 'output' && (
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
            title="Click to let AI automatically fix this code"
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

        {executionTime !== undefined && executionTime !== null && !isLoading && status && activeConsoleTab === 'output' && (
          <div className="console-status-pill idle" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Execution Time">
            <Cpu size={12} style={{ color: 'var(--accent-color)' }} />
            <span>{executionTime} ms</span>
          </div>
        )}

        {memoryUsage !== undefined && memoryUsage !== null && memoryUsage > 0 && !isLoading && activeConsoleTab === 'output' && (
          <div className="console-status-pill idle" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Memory Usage">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-color)' }}>
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
              <line x1="6" y1="6" x2="6.01" y2="6"/>
              <line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
            <span>{(memoryUsage / (1024 * 1024)).toFixed(2)} MB</span>
          </div>
        )}

        {exitCode !== undefined && exitCode !== null && !isLoading && status && activeConsoleTab === 'output' && (
          <div className={`console-status-pill ${exitCode === 0 ? 'success' : 'error'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Exit Code">
            <span>Exit Code: {exitCode}</span>
          </div>
        )}
        
        {engine && !isLoading && activeConsoleTab === 'output' && (
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

        {/* Floating pop-out/dock button */}
        <button
          onClick={() => setIsFloating(!isFloating)}
          className="clear-history-btn"
          title={isFloating ? "Dock Console Panel" : "Float Console Panel"}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          {isFloating ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-color)' }}>
                <rect x="3" y="9" width="9" height="12" rx="2"/>
                <rect x="12" y="3" width="9" height="12" rx="2"/>
              </svg>
              <span>Dock</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-color)' }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              <span>Float</span>
            </>
          )}
        </button>
        
        {activeConsoleTab === 'output' && (
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
        )}
      </div>
    </div>
  );

  const renderTabs = () => (
    <div style={{
      display: 'flex',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0 16px',
      gap: '16px',
      flexShrink: 0
    }}>
      <button
        onClick={() => setActiveConsoleTab('output')}
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: activeConsoleTab === 'output' ? '2px solid var(--accent-color)' : '2px solid transparent',
          color: activeConsoleTab === 'output' ? 'var(--text-primary)' : 'var(--text-muted)',
          padding: '8px 4px',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        Console Output
      </button>
      <button
        onClick={() => setActiveConsoleTab('testcases')}
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: activeConsoleTab === 'testcases' ? '2px solid var(--accent-color)' : '2px solid transparent',
          color: activeConsoleTab === 'testcases' ? 'var(--text-primary)' : 'var(--text-muted)',
          padding: '8px 4px',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        <span>Test Cases Suite</span>
        <span style={{
          fontSize: '10px',
          background: 'rgba(56, 189, 248, 0.15)',
          color: 'var(--accent-color)',
          padding: '1px 6px',
          borderRadius: '10px'
        }}>Beta</span>
      </button>
    </div>
  );

  const renderBody = () => {
    if (activeConsoleTab === 'output') {
      return (
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
      );
    } else {
      return (
        <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {/* Test cases list sidebar */}
          <div style={{
            width: '130px',
            borderRight: '1px solid var(--border-color)',
            background: 'rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            padding: '12px 8px',
            overflowY: 'auto',
            flexShrink: 0
          }}>
            {localTestCases.map((tc, idx) => {
              const isActive = tc.id === activeCaseId;
              const result = Array.isArray(testCaseResults) ? testCaseResults.find(r => r.id === tc.id || r.id === idx) : null;
              
              let statusDot = null;
              if (result) {
                statusDot = (
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: result.passed ? '#22c55e' : '#ef4444',
                    display: 'inline-block'
                  }} />
                );
              }

              return (
                <div
                  key={tc.id}
                  onClick={() => setActiveCaseId(tc.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                    border: isActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                    borderRadius: '6px',
                    color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {statusDot}
                    <span>Case {idx + 1}</span>
                  </div>
                  {localTestCases.length > 1 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = localTestCases.filter(item => item.id !== tc.id);
                        setLocalTestCases(updated);
                        if (isActive && updated.length > 0) {
                          setActiveCaseId(updated[0].id);
                        }
                      }}
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0 2px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      &times;
                    </span>
                  )}
                </div>
              );
            })}

            <button
              onClick={() => {
                const newId = Date.now();
                const newCases = [...localTestCases, { id: newId, input: '', expected: '' }];
                setLocalTestCases(newCases);
                setActiveCaseId(newId);
              }}
              style={{
                width: '100%',
                padding: '6px',
                background: 'transparent',
                border: '1px dashed var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-muted)',
                fontSize: '0.7rem',
                cursor: 'pointer',
                textAlign: 'center',
                marginTop: '4px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-color)';
                e.currentTarget.style.color = 'var(--accent-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              + Add Case
            </button>
          </div>

          {/* Selected case details */}
          {(() => {
            const activeCase = localTestCases.find(tc => tc.id === activeCaseId) || localTestCases[0];
            if (!activeCase) {
              return (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <span>No active test case. Click + Add Case to add one.</span>
                </div>
              );
            }
            const activeIdx = localTestCases.findIndex(tc => tc.id === activeCase.id);
            const result = Array.isArray(testCaseResults) ? testCaseResults.find(r => r.id === activeCase.id || r.id === activeIdx) : null;

            return (
              <div style={{
                flex: 1,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Input (stdin)</label>
                    <textarea
                      value={activeCase.input}
                      onChange={(e) => {
                        const updated = localTestCases.map(tc => tc.id === activeCase.id ? { ...tc, input: e.target.value } : tc);
                        setLocalTestCases(updated);
                      }}
                      placeholder="e.g. 5"
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-mono)',
                        outline: 'none',
                        resize: 'none',
                        minHeight: '60px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Expected Output</label>
                    <textarea
                      value={activeCase.expected}
                      onChange={(e) => {
                        const updated = localTestCases.map(tc => tc.id === activeCase.id ? { ...tc, expected: e.target.value } : tc);
                        setLocalTestCases(updated);
                      }}
                      placeholder="e.g. Hello World"
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-mono)',
                        outline: 'none',
                        resize: 'none',
                        minHeight: '60px'
                      }}
                    />
                  </div>
                </div>

                {result && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    marginTop: '8px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border-color)',
                    animation: 'fadeIn 0.2s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Result:</span>
                        <span className={`console-status-pill ${result.passed ? 'success' : 'error'}`} style={{ fontWeight: 600 }}>
                          {result.passed ? 'PASSED' : result.status === 'Success' ? 'FAILED' : result.status}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>Time: {result.executionTime} ms</span>
                        <span>•</span>
                        <span>RAM: {(result.memoryUsage / (1024 * 1024)).toFixed(2)} MB</span>
                        {result.exitCode !== undefined && (
                          <>
                            <span>•</span>
                            <span>Exit: {result.exitCode}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Actual Output</label>
                      <pre style={{
                        background: 'rgba(0,0,0,0.15)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        color: result.passed ? 'var(--text-primary)' : '#f87171',
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-mono)',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        minHeight: '40px'
                      }}>
                        {result.actual || (result.error ? result.error : '(No Output)')}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      );
    }
  };

  if (isFloating) {
    return (
      <>
        {/* Placeholder in normal split layout grid */}
        <div className="glass-panel" style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          gap: '8px',
          border: '1px dashed var(--border-color)',
          borderRadius: '12px',
          background: 'rgba(0,0,0,0.05)'
        }}>
          <Terminal size={14} />
          <span>Console popped out into floating mode.</span>
          <button
            onClick={() => setIsFloating(false)}
            style={{
              padding: '4px 8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--accent-color)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            Dock Panel
          </button>
        </div>

        {/* Real floating panel container */}
        <div
          className="glass-panel console-panel animate-fade"
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: '580px',
            height: '380px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
            background: 'var(--bg-secondary)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            userSelect: 'none'
          }}
        >
          {renderHeader()}
          {renderTabs()}
          {renderBody()}
        </div>
      </>
    );
  }

  return (
    <div className="glass-panel console-panel animate-fade" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {renderHeader()}
      {renderTabs()}
      {renderBody()}
    </div>
  );
}
