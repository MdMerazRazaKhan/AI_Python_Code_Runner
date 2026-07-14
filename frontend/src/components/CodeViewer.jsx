import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Copy, Check, Download, AlertCircle, FileCode, Info, AlignLeft, Maximize2, Minimize2 } from 'lucide-react';

export default function CodeViewer({ 
  code, 
  onChange, 
  onExecute, 
  isLoading, 
  theme, 
  explanation, 
  language = 'python',
  fontSize = 14,
  setFontSize,
  isFullscreen,
  onToggleFullscreen,
  openTabs = [],
  activeHistoryId,
  onSelectTab,
  onCloseTab,
  history = []
}) {
  const [copied, setCopied] = useState(false);
  const [showExplanationModal, setShowExplanationModal] = useState(false);

  useEffect(() => {
    if (explanation) {
      setShowExplanationModal(true);
    }
  }, [explanation]);

  const getBulletPoints = (text) => {
    if (!text) return [];
    if (text.includes('\n')) {
      return text.split('\n')
        .map(line => line.trim())
        .map(line => line.replace(/^[-*•\d+.\)]\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    const parts = text.split(/(?=\b\d+[\)]\s*)|(?=\b\d+\.\s+[A-Z])/);
    if (parts.length > 1) {
      return parts
        .map(part => part.trim())
        .map(part => part.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(part => part.length > 0);
    }
    const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g);
    if (sentences && sentences.length > 0) {
      return sentences.map(s => s.trim()).filter(s => s.length > 0);
    }
    return [text.trim()];
  };

  const handleAutoIndent = () => {
    if (!code) return;
    const lines = code.split('\n');
    
    const indentStack = [{ originalSpaces: 0, formattedSpaces: 0 }];
    let lastLineWasBlockStart = false;
    const formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i];
      const expandedLine = originalLine.replace(/\t/g, '    ');
      const trimmed = expandedLine.trim();

      if (!trimmed) {
        formattedLines.push('');
        continue;
      }

      // Calculate leading spaces
      const match = expandedLine.match(/^ */);
      const originalSpaces = match ? match[0].length : 0;

      // Pop from stack to match current indentation level
      while (
        indentStack.length > 1 && 
        originalSpaces <= indentStack[indentStack.length - 1].originalSpaces &&
        !lastLineWasBlockStart
      ) {
        indentStack.pop();
      }

      let renderIndentSpaces = 0;

      if (lastLineWasBlockStart) {
        // Force one level deeper than parent block
        const parent = indentStack[indentStack.length - 1];
        const newFormatted = parent.formattedSpaces + 4;
        const newOriginal = Math.max(originalSpaces, parent.originalSpaces + 1);
        indentStack.push({ originalSpaces: newOriginal, formattedSpaces: newFormatted });
        renderIndentSpaces = newFormatted;
      } else {
        if (originalSpaces > indentStack[indentStack.length - 1].originalSpaces) {
          // User indented explicitly
          const parent = indentStack[indentStack.length - 1];
          const newFormatted = parent.formattedSpaces + 4;
          indentStack.push({ originalSpaces, formattedSpaces: newFormatted });
          renderIndentSpaces = newFormatted;
        } else {
          renderIndentSpaces = indentStack[indentStack.length - 1].formattedSpaces;
        }
      }

      // Render the line
      const spaces = ' '.repeat(renderIndentSpaces);
      formattedLines.push(spaces + trimmed);

      // Check if this line starts a block
      const lineWithoutComments = trimmed.split('#')[0].trim();
      const isBlockStart = lineWithoutComments.endsWith(':');
      lastLineWasBlockStart = isBlockStart;
    }

    onChange(formattedLines.join('\n'));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extMap = { python: 'py', java: 'java', cpp: 'cpp', c: 'c' };
    const ext = extMap[language] || 'py';
    
    let fileName = 'main';
    const activeFile = Array.isArray(history) ? history.find(h => h.id === activeHistoryId) : null;
    if (activeFile && activeFile.fileName) {
      fileName = activeFile.fileName.replace(/\.[a-zA-Z0-9]+$/, '');
    }

    const element = document.createElement("a");
    const file = new Blob([code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${fileName}.${ext}`;
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
        { token: 'keyword', foreground: '895129', fontStyle: 'bold' },
        { token: 'string', foreground: '5c7a5c' },
        { token: 'number', foreground: 'a05a5a' },
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

  const validTabs = Array.isArray(history) ? history.filter(h => openTabs.includes(h.id)) : [];

  return (
    <div className={`glass-panel editor-panel animate-fade ${isFullscreen ? 'fullscreen-editor-container' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="editor-header">
        <div className="editor-title-container">
          <FileCode size={18} className="editor-icon" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
            {language === 'python' ? 'Python' : language === 'java' ? 'Java' : language === 'cpp' ? 'C++' : 'C'} Code Editor
          </h3>
        </div>
        
        <div className="editor-actions">

          {explanation && (
            <button
              onClick={() => setShowExplanationModal(true)}
              className="action-btn"
              title="Show AI Explanation Pop-up"
            >
              <Info size={14} />
              <span>Explanation</span>
            </button>
          )}

          <button
            onClick={handleAutoIndent}
            className="action-btn"
            disabled={!code}
            title="Auto Indent / Format Code"
          >
            <AlignLeft size={14} />
            <span>Format</span>
          </button>

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
            title={`Download File`}
          >
            <Download size={14} />
            <span>Download</span>
          </button>

          <button
            onClick={onToggleFullscreen}
            className="action-btn"
            title={isFullscreen ? "Exit Fullscreen Editor" : "Fullscreen Editor"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
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

      {validTabs.length > 0 && (
        <div className="editor-tabs-bar" style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto',
          gap: '2px',
          padding: '4px 8px 0 8px',
          flexShrink: 0
        }}>
          {validTabs.map(tab => {
            const isActive = tab.id === activeHistoryId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  background: isActive ? 'var(--bg-primary)' : 'rgba(0,0,0,0.15)',
                  borderTopLeftRadius: '6px',
                  borderTopRightRadius: '6px',
                  border: '1px solid var(--border-color)',
                  borderBottom: isActive ? '1px solid var(--bg-primary)' : '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  top: '1px',
                  height: '28px',
                  boxSizing: 'border-box'
                }}
              >
                <span>{tab.fileName}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0 2px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '14px',
                    height: '14px',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  &times;
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="editor-body">
        <Editor
          height="100%"
          language={language === 'python' ? 'python' : language === 'java' ? 'java' : language === 'cpp' ? 'cpp' : 'c'}
          value={code}
          onChange={onChange}
          theme={theme === 'dark' ? 'vs-dark' : 'creamBrown'}
          beforeMount={handleEditorBeforeMount}
          options={{
            minimap: { enabled: false },
            fontSize: fontSize,
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

      {showExplanationModal && explanation && (
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
            width: '420px',
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
              <Info size={16} style={{ color: 'var(--accent-color)' }} />
              <span>AI Debug Explanation</span>
            </div>
            
            <div style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
              maxHeight: '260px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              <ul style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {getBulletPoints(explanation).map((point, idx) => (
                  <li key={idx} style={{ listStyleType: 'disc' }}>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => setShowExplanationModal(false)}
                className="action-btn"
                style={{
                  padding: '8px 20px',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
