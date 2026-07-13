import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Sun, Moon, Database, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import CodeViewer from '../components/CodeViewer';
import OutputConsole from '../components/OutputConsole';
import { getHistory, deleteHistoryItem, clearHistory, fixCode } from '../services/api';
import ScratchNotes from '../components/ScratchNotes';

const DEFAULT_NOTES = '';

const DEFAULT_CODE = `# Welcome to the AI Python Code Runner
# Write your Python code below
# If any error occurs, click AI Quick Fix

print("Hello World")
`;

export default function Home() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [code, setCode] = useState(DEFAULT_CODE);
  const [explanation, setExplanation] = useState('');
  const [history, setHistory] = useState([]);
  
  // Console state
  const [consoleLines, setConsoleLines] = useState([]);
  const [consoleTime, setConsoleTime] = useState(null);
  const [consoleStatus, setConsoleStatus] = useState('');
  const [consoleEngine, setConsoleEngine] = useState('');
  const socketRef = useRef(null);

  // Layout state
  const [layout, setLayout] = useState('default'); // 'default' | 'leet' | 'note-taking' | 'debug'
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(true);
  const [timerCollapsed, setTimerCollapsed] = useState(false);

  // Floating Notes panel state
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [notesContent, setNotesContent] = useState(() => localStorage.getItem('personal_notes') || DEFAULT_NOTES);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Active script file naming states
  const [activeFileName, setActiveFileName] = useState('');
  const [showFileNameModal, setShowFileNameModal] = useState(false);
  const [tempFileName, setTempFileName] = useState('');

  useEffect(() => {
    localStorage.setItem('personal_notes', notesContent);
  }, [notesContent]);
  
  // Loading states
  const [isExecuting, setIsExecuting] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  // Apply theme to html element on load/change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load history logs on initial mount
  useEffect(() => {
    fetchHistory();
  }, []);

  // Clear old notes guide content from local storage on mount if present
  useEffect(() => {
    const storedNotes = localStorage.getItem('personal_notes');
    if (storedNotes && (
      storedNotes.includes('Markdown Editor Toolbar Guide') || 
      storedNotes.includes('italic text') || 
      storedNotes.includes('Make your notes here') ||
      storedNotes.includes('Alt text') ||
      storedNotes.includes('example.com') ||
      storedNotes.includes('Blockquote')
    )) {
      setNotesContent('');
      localStorage.setItem('personal_notes', '');
    }
  }, []);

  // Open file naming modal unconditionally on initial site load if no file name is set
  useEffect(() => {
    if (!activeFileName) {
      setShowFileNameModal(true);
    }
  }, []);

  // Close WebSocket connection if component unmounts
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // Timer count-up effect
  useEffect(() => {
    let interval = null;
    if (timerActive) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  // Click outside to close layout dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (showLayoutDropdown && !e.target.closest('.icon-btn-leetcode') && !e.target.closest('.glass-panel')) {
        setShowLayoutDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showLayoutDropdown]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const result = await getHistory();
      if (result) {
        setHistory(Array.isArray(result) ? result : (result.data || []));
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteHistoryItem = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteHistoryItem(id);
      setHistory(prev => prev.filter(item => item.id !== id));
      if (activeHistoryId === id) {
        setActiveHistoryId(null);
      }
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Clear all execution history?')) {
      try {
        await clearHistory();
        setHistory([]);
        setActiveHistoryId(null);
      } catch (err) {
        console.error('Failed to clear history:', err);
      }
    }
  };

  const executeAndLog = async (codeToRun, runPrompt = '') => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    setIsExecuting(true);
    setApiError(null);
    setConsoleLines([]);
    setConsoleStatus('');
    setConsoleTime(null);
    setConsoleEngine('');

    try {
      const wsUrl = `ws://${window.location.hostname}:5000`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'run', code: codeToRun, fileName: activeFileName }));
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'stdout') {
            setConsoleLines((prev) => [...prev, { type: 'stdout', text: message.data }]);
          } else if (message.type === 'stderr') {
            setConsoleLines((prev) => [...prev, { type: 'stderr', text: message.data }]);
          } else if (message.type === 'exit') {
            setConsoleStatus(message.status || 'Success');
            setConsoleTime(message.executionTime);
            setConsoleEngine(message.engine || '');
            setIsExecuting(false);
            fetchHistory();
            socket.close();
          }
        } catch (err) {
          console.error('WS parsing error:', err);
        }
      };

      socket.onerror = (err) => {
        console.error('WS Error:', err);
        setConsoleLines((prev) => [...prev, { type: 'stderr', text: 'WebSocket Connection Error.\n' }]);
        setConsoleStatus('Error');
        setIsExecuting(false);
      };

      socket.onclose = () => {
        socketRef.current = null;
        setIsExecuting(false);
      };
    } catch (err) {
      setConsoleLines((prev) => [...prev, { type: 'stderr', text: err.message || 'Error occurred during execution.\n' }]);
      setConsoleStatus('Error');
      setConsoleTime(0);
      setConsoleEngine('');
      setIsExecuting(false);
    }
  };

  const handleSaveFileName = () => {
    let name = tempFileName.trim();
    if (!name || name.toLowerCase() === 'untitled' || name.toLowerCase() === 'untitled.py') {
      alert('Please enter a custom file name.');
      return;
    }
    if (!name.endsWith('.py')) name += '.py';

    // Prevent duplicate filenames in history
    const nameExists = history.some(item => item.fileName && item.fileName.toLowerCase() === name.toLowerCase());
    if (nameExists) {
      alert(`A file named "${name}" already exists. Please enter a different name.`);
      return;
    }

    // Only clear editor code and reset terminal if we are starting a subsequent new file
    if (activeFileName) {
      setCode(DEFAULT_CODE);
      setConsoleLines([]);
      setConsoleStatus('');
      setConsoleTime(null);
      setConsoleEngine('');
      setActiveHistoryId(null);
    }

    setActiveFileName(name);
    setShowFileNameModal(false);
    setTempFileName('');
  };

  const handleNewFileClick = () => {
    setTempFileName('');
    setShowFileNameModal(true);
  };

  const handleExecute = () => {
    executeAndLog(code);
  };

  const getConsoleErrorText = () => {
    return consoleLines
      .filter((line) => line.type === 'stderr')
      .map((line) => line.text)
      .join('');
  };

  const handleQuickFix = async () => {
    const errorText = getConsoleErrorText();
    if (!code || !errorText) return;
    setIsFixing(true);
    setApiError(null);
    try {
      const result = await fixCode(code, errorText);
      if (result && result.code) {
        setCode(result.code);
        setExplanation(result.explanation || '');
        await executeAndLog(result.code, 'AI Quick Fix');
      }
    } catch (err) {
      setApiError(err.message || 'Failed to auto-fix code. Make sure your Gemini API Key is configured in backend/.env.');
    } finally {
      setIsFixing(false);
    }
  };

  const handleSelectHistoryItem = (item) => {
    setActiveHistoryId(item.id);
    setCode(item.code);
    setExplanation('');
    if (item.fileName) {
      setActiveFileName(item.fileName);
    } else {
      setActiveFileName('untitled.py');
    }
    const historyLines = [];
    if (item.output) {
      historyLines.push({ type: 'stdout', text: item.output });
    }
    if (item.error) {
      historyLines.push({ type: 'stderr', text: item.error });
    }
    setConsoleLines(historyLines);
    setConsoleStatus(item.status || '');
    setConsoleTime(item.executionTime);
    setConsoleEngine(item.engine || '');
    setActiveHistoryId(item.id);
  };

  const handleClearConsole = () => {
    setConsoleLines([]);
    setConsoleStatus('');
    setConsoleTime(null);
    setConsoleEngine('');
  };

  const handleStdinSubmit = (inputValue) => {
    setConsoleLines((prev) => [...prev, { type: 'stdin', text: inputValue + '\n' }]);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'stdin', data: inputValue + '\n' }));
    }
  };

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const formatTimerValue = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };


  const renderLayoutContent = () => {
    const editor = (
      <CodeViewer
        code={code}
        onChange={setCode}
        onExecute={handleExecute}
        isLoading={isExecuting}
        theme={theme}
        explanation={explanation}
      />
    );

    const console = (
      <OutputConsole
        lines={consoleLines}
        executionTime={consoleTime}
        status={consoleStatus}
        engine={consoleEngine}
        isLoading={isExecuting}
        onClear={handleClearConsole}
        onQuickFix={handleQuickFix}
        isFixing={isFixing}
        onStdinSubmit={handleStdinSubmit}
      />
    );

    if (layout === 'default') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: '2mm' }}>
          <div style={{ flex: '7 1 0', overflow: 'hidden', minHeight: '10%', display: 'flex', flexDirection: 'column' }}>
            {editor}
          </div>
          <div style={{ flex: '3 1 0', overflow: 'hidden', minHeight: '10%', display: 'flex', flexDirection: 'column' }}>
            {console}
          </div>
        </div>
      );
    }

    if (layout === 'leet') {
      return (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', gap: '2mm' }}>
          <div style={{ flex: '3 1 0', overflow: 'hidden', minWidth: '10%', display: 'flex', flexDirection: 'column' }}>
            {editor}
          </div>
          <div style={{ flex: '2 1 0', overflow: 'hidden', minWidth: '10%', display: 'flex', flexDirection: 'column' }}>
            {console}
          </div>
        </div>
      );
    }

    if (layout === 'note-taking') {
      return (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', gap: '2mm' }}>
          <div style={{ flex: '1 1 0', overflow: 'hidden', minWidth: '10%', display: 'flex', flexDirection: 'column' }}>
            <ScratchNotes value={notesContent} onChange={setNotesContent} />
          </div>
          <div style={{ flex: '3 1 0', display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '2mm' }}>
            <div style={{ flex: '7 1 0', overflow: 'hidden', minHeight: '10%', display: 'flex', flexDirection: 'column' }}>
               {editor}
            </div>
            <div style={{ flex: '3 1 0', overflow: 'hidden', minHeight: '10%', display: 'flex', flexDirection: 'column' }}>
               {console}
            </div>
          </div>
        </div>
      );
    }

    if (layout === 'debug') {
      return (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', gap: '2mm' }}>
          {/* Center workspace area (Editor + Console) */}
          <div style={{ flex: '3 1 0', display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '2mm' }}>
            <div style={{ flex: '7 1 0', overflow: 'hidden', minHeight: '10%', display: 'flex', flexDirection: 'column' }}>
              {editor}
            </div>
            <div style={{ flex: '3 1 0', overflow: 'hidden', minHeight: '10%', display: 'flex', flexDirection: 'column' }}>
              {console}
            </div>
          </div>

          {/* Right side Scratch Notes panel */}
          <div style={{ flex: '1 1 0', overflow: 'hidden', minWidth: '10%', display: 'flex', flexDirection: 'column' }}>
            <ScratchNotes value={notesContent} onChange={setNotesContent} />
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-container">
      {/* Sidebar - History & Config */}
      <aside className="sidebar" style={{ display: sidebarOpen ? 'flex' : 'none' }}>
        <div className="sidebar-header" style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div className="logo-container">
              <Terminal className="logo-icon" size={24} />
              <span className="logo-text">AI Python Runner</span>
            </div>

            <button 
              onClick={() => setSidebarOpen(false)}
              className="icon-btn-leetcode"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '4px'
              }}
              title="Close Sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <path d="M15 15l-3-3 3-3"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="history-panel">
          <button 
            onClick={handleNewFileClick}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              background: 'var(--accent-color)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '16px',
              transition: 'background var(--transition-speed)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
            className="new-file-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <span>New File</span>
          </button>

          <div className="history-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={12} />
              Run History
            </span>
            {history.length > 0 && (
              <button onClick={handleClearHistory} className="clear-history-btn">
                Clear All
              </button>
            )}
          </div>

          {historyLoading && history.length === 0 ? (
            <div className="empty-history">
              <RefreshCw className="spin-loader" size={18} style={{ opacity: 0.5 }} />
              <span>Loading logs...</span>
            </div>
          ) : history.filter(item => item.fileName && item.fileName !== 'untitled.py').length === 0 ? (
            null
          ) : (
            <div className="history-list">
              {history
                .filter(item => item.fileName && item.fileName !== 'untitled.py')
                .map((item, index) => (
                <div
                  key={item.id}
                  className={`history-item animate-fade ${activeHistoryId === item.id ? 'active' : ''}`}
                  onClick={() => handleSelectHistoryItem(item)}
                >
                  <div className="history-item-content">
                    <div className="history-item-prompt" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
                      📄 {item.fileName || 'untitled.py'}
                    </div>
                    <div className="history-item-code-preview">
                      {item.code.substring(0, 45).replace(/\n/g, ' ')}...
                    </div>
                    <div className="history-item-meta" style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`status-indicator ${index === 0 ? 'success' : 'error'}`} />
                        <span className="history-item-time">
                          {formatTime(item.timestamp)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span>Time Taken: {item.executionTime} ms</span>
                        <span>•</span>
                        <span>Lines of Code: {item.linesCount || (item.code ? item.code.split('\n').length : 0)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                    className="history-delete-btn"
                    title="Remove item"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="workspace">
        <header className="workspace-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          borderRadius: '8px',
          flexShrink: 0,
          position: 'relative'
        }}>
          <div className="workspace-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="icon-btn-leetcode"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                  marginRight: '4px'
                }}
                title="Open Sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                  <path d="M15 9l3 3-3 3"/>
                </svg>
              </button>
            )}
            <Terminal size={15} style={{ color: 'var(--accent-color)' }} />
            <span>Interactive Editor</span>
          </div>

          {/* Centered Active File Name Badge */}
          {activeFileName && (
            <div className="active-file-badge animate-fade" style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--accent-color)',
              fontFamily: 'var(--font-mono)'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span>{activeFileName}</span>
            </div>
          )}

          <div className="workspace-controls" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Theme Toggle Button */}
            <button 
              onClick={handleToggleTheme} 
              className="icon-btn-leetcode" 
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '4px'
              }}
              title={theme === 'dark' ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {theme === 'dark' ? (
                <Sun size={18} style={{ color: '#fbbf24' }} />
              ) : (
                <Moon size={18} style={{ color: '#475569' }} />
              )}
            </button>

            {/* Layout Dropdown Button */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
                className="icon-btn-leetcode" 
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  borderRadius: '4px'
                }}
                title="Change Layout"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
              </button>

              {showLayoutDropdown && (
                <div 
                  className="glass-panel animate-fade"
                  style={{
                    position: 'absolute',
                    top: '32px',
                    right: 0,
                    width: '280px',
                    padding: '16px',
                    zIndex: 100,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-main)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Layouts
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div 
                      onClick={() => { setLayout('default'); setShowLayoutDropdown(false); }}
                      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
                    >
                      <div style={{
                        height: '70px',
                        background: 'var(--bg-primary)',
                        border: layout === 'default' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ flex: 3, background: 'var(--bg-tertiary)', borderRadius: '3px' }} />
                        <div style={{ flex: 2, background: 'var(--layout-preview-bg)', border: '1px dashed var(--layout-preview-border)', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', textAlign: 'center', color: layout === 'default' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: layout === 'default' ? 600 : 400 }}>Default</span>
                    </div>

                    <div 
                      onClick={() => { setLayout('leet'); setShowLayoutDropdown(false); }}
                      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
                    >
                      <div style={{
                        height: '70px',
                        background: 'var(--bg-primary)',
                        border: layout === 'leet' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '6px',
                        display: 'flex',
                        gap: '4px'
                      }}>
                        <div style={{ flex: 3, background: 'var(--bg-tertiary)', borderRadius: '3px' }} />
                        <div style={{ flex: 2, background: 'var(--layout-preview-bg)', border: '1px dashed var(--layout-preview-border)', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', textAlign: 'center', color: layout === 'leet' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: layout === 'leet' ? 600 : 400 }}>Split Screen</span>
                    </div>

                    <div 
                      onClick={() => { setLayout('note-taking'); setShowLayoutDropdown(false); }}
                      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
                    >
                      <div style={{
                        height: '70px',
                        background: 'var(--bg-primary)',
                        border: layout === 'note-taking' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '6px',
                        display: 'flex',
                        gap: '4px'
                      }}>
                        <div style={{ flex: 1.5, background: 'var(--text-muted)', borderRadius: '3px' }} />
                        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ flex: 3, background: 'var(--bg-tertiary)', borderRadius: '3px' }} />
                          <div style={{ flex: 2, background: 'var(--layout-preview-bg)', border: '1px dashed var(--layout-preview-border)', borderRadius: '3px' }} />
                        </div>
                      </div>
                      <span style={{ fontSize: '0.75rem', textAlign: 'center', color: layout === 'note-taking' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: layout === 'note-taking' ? 600 : 400 }}>Note-taking</span>
                    </div>

                    <div 
                      onClick={() => { setLayout('debug'); setShowLayoutDropdown(false); }}
                      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
                    >
                      <div style={{
                        height: '70px',
                        background: 'var(--bg-primary)',
                        border: layout === 'debug' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '6px',
                        display: 'flex',
                        gap: '4px'
                      }}>
                        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ flex: 3, background: 'var(--bg-tertiary)', borderRadius: '3px' }} />
                          <div style={{ flex: 2, background: 'var(--layout-preview-bg)', border: '1px dashed var(--layout-preview-border)', borderRadius: '3px' }} />
                        </div>
                        <div style={{ flex: 1.5, background: 'var(--text-muted)', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', textAlign: 'center', color: layout === 'debug' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: layout === 'debug' ? 600 : 400 }}>Developer Workspace</span>
                    </div>
                  </div>
                </div>
              )}
            </div>


            {/* Notes Toggle Button */}
            <button 
              onClick={() => setShowNotesDrawer(!showNotesDrawer)}
              className="icon-btn-leetcode" 
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: showNotesDrawer ? 'var(--accent-color)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '4px'
              }}
              title="Toggle Notes Panel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
            </button>

            {/* Count-Up Timer */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-secondary)',
                padding: '4px 10px',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                color: '#38bdf8',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                fontWeight: 600,
                gap: '8px',
                userSelect: 'none'
              }}
            >
              <button 
                onClick={() => setTimerCollapsed(!timerCollapsed)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                {timerCollapsed ? '〉' : '〈'}
              </button>

              <button 
                onClick={() => setTimerActive(!timerActive)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#38bdf8', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                {timerActive ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                )}
              </button>

              {!timerCollapsed && <span>{formatTimerValue(timerSeconds)}</span>}

              <button 
                onClick={() => setTimerSeconds(0)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}
                title="Reset Timer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
              </button>
            </div>
          </div>
        </header>

        {apiError && (
          <div className="api-key-warning-overlay animate-fade" style={{ margin: '0 auto 2mm auto', width: '100%', flexShrink: 0 }}>
            <AlertTriangle size={24} style={{ color: 'var(--error-color)', flexShrink: 0 }} />
            <div style={{ textAlign: 'left', flex: 1 }}>
              <h4 style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>AI Error Warning</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {apiError}
              </p>
            </div>
            <button
              onClick={() => setApiError(null)}
              className="action-btn"
              style={{ padding: '4px 12px', fontSize: '0.75rem', background: 'var(--bg-tertiary)' }}
            >
              Close
            </button>
          </div>
        )}
        
        {renderLayoutContent()}

        {/* Floating Notes Drawer */}
        {showNotesDrawer && (
          <div 
            style={{
              position: 'absolute',
              top: '60px',
              right: '16px',
              bottom: '16px',
              width: '320px',
              zIndex: 90,
              boxShadow: 'var(--shadow-main)'
            }}
          >
            <ScratchNotes value={notesContent} onChange={setNotesContent} onClose={() => setShowNotesDrawer(false)} />
          </div>
        )}

        {/* Pop-up modal overlay for file naming */}
        {showFileNameModal && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            borderRadius: '8px'
          }}>
            <div className="glass-panel animate-fade" style={{
              width: '320px',
              padding: '24px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-main)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-color)' }}>
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span>Create Python File</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>File Name</label>
                <input 
                  type="text"
                  value={tempFileName}
                  onChange={(e) => setTempFileName(e.target.value)}
                  placeholder="e.g. main.py"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveFileName();
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={handleSaveFileName}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--accent-color)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
