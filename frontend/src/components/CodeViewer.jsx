import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Copy, Check, Download, AlertCircle, FileCode, Info } from 'lucide-react';

export default function CodeViewer({ code, onChange, onExecute, isLoading, theme, explanation }) {
  const [copied, setCopied] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!code) return;
    const element = document.createElement("a");
    const file = new Blob([code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "script.py";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleEditorBeforeMount = (monaco) => {
    monaco.editor.defineTheme('creamBrown', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '9c8470', fontStyle: 'italic' },
        { token: 'keyword', foreground: '895129', fontWeight: 'bold' },
        { token: 'string', foreground: '059669' },
        { token: 'number', foreground: 'd97706' },
        { token: 'delimiter', foreground: '3d2b1f' },
      ],
      colors: {
        'editor.background': '#fdfbf7',
        'editor.lineHighlightBackground': '#f5efe6',
        'editorLineNumber.foreground': '#9c8470',
        'editorLineNumber.activeForeground': '#895129',
        'editor.foreground': '#3d2b1f',
        'editorCursor.foreground': '#895129',
      }
    });
  };

  return (
    <div className="glass-panel editor-panel animate-fade" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="editor-header">
        <div className="editor-title-container">
          <FileCode size={18} className="editor-icon" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Python Code Editor</h3>
        </div>
        
        <div className="editor-actions">
          {explanation && (
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="action-btn"
              title="Toggle AI Explanation"
              style={{ borderColor: showExplanation ? 'var(--accent-color)' : 'var(--border-color)' }}
            >
              <Info size={14} />
              <span>Explanation</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="action-btn"
            disabled={!code}
            title="Copy Code"
          >
            {copied ? <Check size={14} style={{ color: 'var(--success-color)' }} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          
          <button
            onClick={handleDownload}
            className="action-btn"
            disabled={!code}
            title="Download .py File"
          >
            <Download size={14} />
            <span>Download</span>
          </button>
          
          <button
            onClick={onExecute}
            className="action-btn btn-run"
            disabled={!code || isLoading}
            title="Execute Code in Sandbox"
          >
            {isLoading ? (
              <svg className="spin-loader" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            <span>Run Code</span>
          </button>
        </div>
      </div>

      {explanation && showExplanation && (
        <div
          className="animate-fade"
          style={{
            padding: '12px 16px',
            background: 'rgba(var(--accent-color-rgb), 0.05)',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}
        >
          <AlertCircle size={15} style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>AI Explanation: </strong>
            {explanation}
          </div>
        </div>
      )}

      <div className="editor-body">
        <Editor
          height="100%"
          defaultLanguage="python"
          value={code}
          onChange={onChange}
          theme={theme === 'dark' ? 'vs-dark' : 'creamBrown'}
          beforeMount={handleEditorBeforeMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "var(--font-mono)",
            automaticLayout: true,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            tabSize: 4,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            padding: { top: 12, bottom: 12 }
          }}
          loading={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <span>Loading Monaco Code Editor...</span>
            </div>
          }
        />
      </div>
    </div>
  );
}
