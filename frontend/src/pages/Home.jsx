import React, { useState, useEffect } from 'react';
import { Terminal, Trash2, Sun, Moon, Database, Clock, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Key, ChevronRight, Sparkles, Check } from 'lucide-react';
import CodeViewer from '../components/CodeViewer';
import OutputConsole from '../components/OutputConsole';
import { executeCode, getHistory, deleteHistoryItem, clearHistory, getApiKeyStatus, saveApiKey, fixCode } from '../services/api';

const DEFAULT_CODE = `# Welcome to the AI Python Code Runner!
# Write your Python code below. If any error occurs, click "AI Quick Fix" to debug.

def divide_numbers(a, b):
    # Intentional error to demonstrate AI Quick Fix: b is a string instead of float
    b = "0"
    return a / b

print("Starting calculation...")
result = divide_numbers(10, 2)
print("Result is:", result)
`;

export default function Home() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [code, setCode] = useState(DEFAULT_CODE);
  const [explanation, setExplanation] = useState('');
  const [history, setHistory] = useState([]);
  
  // Console state
  const [consoleOutput, setConsoleOutput] = useState('');
  const [consoleError, setConsoleError] = useState('');
  const [consoleTime, setConsoleTime] = useState(null);
  const [consoleStatus, setConsoleStatus] = useState('');
  const [consoleEngine, setConsoleEngine] = useState('');
  
  // Loading states
  const [isExecuting, setIsExecuting] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  // API Key state
  const [isKeyLinked, setIsKeyLinked] = useState(false);
  const [inputApiKey, setInputApiKey] = useState('');
  const [keySaving, setKeySaving] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Sync theme with document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load history & API key status on mount
  useEffect(() => {
    fetchHistory();
    checkKeyStatus();
  }, []);

  const checkKeyStatus = async () => {
    try {
      const status = await getApiKeyStatus();
      setIsKeyLinked(status?.isKeySet || false);
    } catch (err) {
      console.error('Error checking API Key status:', err);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await getHistory();
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!inputApiKey.trim()) return;
    setKeySaving(true);
    setApiError(null);
    try {
      await saveApiKey(inputApiKey);
      setIsKeyLinked(true);
      setInputApiKey('');
      setShowKeyInput(false);
    } catch (err) {
      setApiError(err.message || 'Failed to link API Key.');
    } finally {
      setKeySaving(false);
    }
  };

  const executeAndLog = async (codeToRun, runPrompt = '') => {
    setIsExecuting(true);
    setApiError(null);
    setConsoleOutput('');
    setConsoleError('');
    setConsoleStatus('');
    setConsoleTime(null);
    setConsoleEngine('');

    try {
      const result = await executeCode(codeToRun, runPrompt);
      if (result) {
        setConsoleOutput(result.output || '');
        setConsoleError(result.error || '');
        setConsoleStatus(result.status || 'Success');
        setConsoleTime(result.executionTime);
        setConsoleEngine(result.engine || '');
        fetchHistory();
      }
    } catch (err) {
      setConsoleError(err.message || 'Error occurred during execution.');
      setConsoleStatus('Error');
      setConsoleTime(0);
      setConsoleEngine('');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecute = () => {
    executeAndLog(code);
  };

  const handleQuickFix = async () => {
    if (!code || !consoleError) return;
    setIsFixing(true);
    setApiError(null);
    try {
      // Pass the code and the error message to Gemini
      const result = await fixCode(code, consoleError);
      if (result && result.code) {
        setCode(result.code);
        setExplanation(result.explanation || '');
        
        // Auto-run the corrected code immediately
        await executeAndLog(result.code, 'AI Quick Fix');
      }
    } catch (err) {
      setApiError(err.message || 'Failed to auto-fix code. Make sure your Gemini API Key is linked.');
    } finally {
      setIsFixing(false);
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

  const handleSelectHistoryItem = (item) => {
    setCode(item.code);
    setExplanation('');
    setConsoleOutput(item.output || '');
    setConsoleError(item.error || '');
    setConsoleStatus(item.status || '');
    setConsoleTime(item.executionTime);
    setConsoleEngine(item.engine || '');
    setActiveHistoryId(item.id);
  };

  const handleClearConsole = () => {
    setConsoleOutput('');
    setConsoleError('');
    setConsoleStatus('');
    setConsoleTime(null);
    setConsoleEngine('');
  };

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar - History & Config */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <Terminal className="logo-icon" size={24} />
            <span className="logo-text">AI Python Runner</span>
          </div>

          <button onClick={handleToggleTheme} className="theme-toggle-btn" style={{ width: '100%' }}>
            {theme === 'dark' ? (
              <>
                <Sun size={15} style={{ color: '#fbbf24' }} />
                <span>Light Theme</span>
              </>
            ) : (
              <>
                <Moon size={15} style={{ color: '#475569' }} />
                <span>Dark Theme</span>
              </>
            )}
          </button>
        </div>

        <div className="history-panel">
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
          ) : history.length === 0 ? (
            <div className="empty-history animate-fade">
              <Clock className="empty-history-icon" size={24} />
              <span>No runs recorded yet</span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Runs will be recorded here automatically.
              </p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`history-item animate-fade ${activeHistoryId === item.id ? 'active' : ''}`}
                  onClick={() => handleSelectHistoryItem(item)}
                >
                  <div className="history-item-content">
                    <div className="history-item-prompt" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      {item.prompt === 'AI Quick Fix' ? '✨ Fixed & Re-run' : '📄 Local Script Run'}
                    </div>
                    <div className="history-item-code-preview">
                      {item.code.substring(0, 45).replace(/\n/g, ' ')}...
                    </div>
                    <div className="history-item-meta">
                      <span className={`status-indicator ${item.status?.toLowerCase() || 'success'}`} />
                      <span className="history-item-time">
                        {formatTime(item.timestamp)} • {item.executionTime} ms
                      </span>
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
        {apiError && (
          <div className="api-key-warning-overlay animate-fade" style={{ margin: '0 auto 12px auto', width: '100%' }}>
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
        
        <CodeViewer
          code={code}
          onChange={setCode}
          onExecute={handleExecute}
          isLoading={isExecuting}
          theme={theme}
          explanation={explanation}
        />
        
        <OutputConsole
          output={consoleOutput}
          error={consoleError}
          executionTime={consoleTime}
          status={consoleStatus}
          engine={consoleEngine}
          isLoading={isExecuting}
          onClear={handleClearConsole}
          onQuickFix={handleQuickFix}
          isFixing={isFixing}
        />
      </main>
    </div>
  );
}
