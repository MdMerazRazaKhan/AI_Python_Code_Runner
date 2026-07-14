import React, { useState } from 'react';
import { marked } from 'marked';

export default function ScratchNotes({ value, onChange, onClose }) {
  const [isPreview, setIsPreview] = useState(false);

  const getMarkdownHtml = () => {
    try {
      // Configure marked option to enable line breaks
      return { __html: marked.parse(value || '', { breaks: true, gfm: true }) };
    } catch (e) {
      return { __html: value || '' };
    }
  };

  return (
    <div className="glass-panel animate-fade" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-color)' }}>
              <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
            <span>Scratch Notes</span>
          </div>
          
          {/* Segmented Control */}
          <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px', gap: '2px' }}>
            <button
              onClick={() => setIsPreview(false)}
              style={{
                background: !isPreview ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                color: !isPreview ? 'var(--accent-color)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '3px',
                padding: '2px 8px',
                fontSize: '0.65rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Edit
            </button>
            <button
              onClick={() => setIsPreview(true)}
              style={{
                background: isPreview ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                color: isPreview ? 'var(--accent-color)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '3px',
                padding: '2px 8px',
                fontSize: '0.65rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Preview
            </button>
          </div>
        </div>

        {onClose && (
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, padding: '0 4px' }}
          >
            &times;
          </button>
        )}
      </div>

      {/* Body Area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {!isPreview ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type scratch notes here (supports markdown syntax, e.g., # Headers, * Bullets, **Bold**)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              resize: 'none',
              outline: 'none',
              lineHeight: '1.6'
            }}
          />
        ) : (
          <div 
            dangerouslySetInnerHTML={getMarkdownHtml()} 
            style={{
              flex: 1,
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              lineHeight: '1.6',
              overflowY: 'auto',
              textAlign: 'left'
            }}
            className="notes-markdown-preview"
          />
        )}
      </div>
    </div>
  );
}
