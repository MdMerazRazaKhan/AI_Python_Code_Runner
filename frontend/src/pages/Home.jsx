import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Sun, Moon, Database, Clock, RefreshCw, AlertTriangle, Edit2 } from 'lucide-react';
import CodeViewer from '../components/CodeViewer';
import OutputConsole from '../components/OutputConsole';
import { getHistory, deleteHistoryItem, clearHistory, fixCode, updateHistoryItem, createHistoryItem } from '../services/api';
import ScratchNotes from '../components/ScratchNotes';
import JSZip from 'jszip';

const DEFAULT_NOTES = '';

const CODE_TEMPLATES = {
  python: `# Welcome to the AI CodeOrbit\n# If any error occurs click AI Quick Fix\n\nprint("Hello World")`,
  c: `// Welcome to the AI CodeOrbit\n// If any error occurs click AI Quick Fix\n\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}`,
  cpp: `// Welcome to the AI CodeOrbit\n// If any error occurs click AI Quick Fix\n\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}`,
  java: `// Welcome to the AI CodeOrbit\n// If any error occurs click AI Quick Fix\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`
};

const DEFAULT_CODE = `# Welcome to the AI CodeOrbit\n# If any error occurs click AI Quick Fix\n\nprint("Hello World")`;

export default function Home() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [code, setCode] = useState(DEFAULT_CODE);
  const [explanation, setExplanation] = useState('');
  const [history, setHistory] = useState([]);
  
  // Console state
  const [consoleLines, setConsoleLines] = useState([]);
  const [consoleTime, setConsoleTime] = useState(null);
  const [consoleStatus, setConsoleStatus] = useState('');
  const [consoleEngine, setConsoleEngine] = useState('');
  const [consoleMemory, setConsoleMemory] = useState(null);
  const [consoleExitCode, setConsoleExitCode] = useState(null);
  const socketRef = useRef(null);

  // Layout state
  const [layout, setLayout] = useState('default'); // 'default' | 'leet' | 'note-taking' | 'debug'
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  // Phase 1 states
  const [fontSize, setFontSize] = useState(14);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('Saved');
  const [openTabs, setOpenTabs] = useState([]);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameItemId, setRenameItemId] = useState(null);
  const [renameItemName, setRenameItemName] = useState('');

  // Phase 2 Multiple Test Cases states
  const [testCases, setTestCases] = useState([
    { id: 1, input: '', expected: '' }
  ]);
  const [testCaseResults, setTestCaseResults] = useState(null);

  // Compiler version selection
  const [compilerVersion, setCompilerVersion] = useState('3');
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);

  const getAvailableVersions = (lang) => {
    switch (lang) {
      case 'cpp':
        return [
          { value: 'c++20', label: 'C++20' },
          { value: 'c++17', label: 'C++17' },
          { value: 'c++14', label: 'C++14' }
        ];
      case 'c':
        return [
          { value: 'c11', label: 'C11' },
          { value: 'c99', label: 'C99' }
        ];
      case 'java':
        return [
          { value: '17', label: 'Java 17' },
          { value: '8', label: 'Java 8' }
        ];
      default:
        return [{ value: '3', label: 'Python 3' }];
    }
  };

  const getCompilerVersionLabel = () => {
    const list = getAvailableVersions(selectedLanguage);
    const match = list.find(item => item.value === compilerVersion);
    return match ? match.label : 'Python 3';
  };

  // Refs for tracking tab changes and switching
  const isSwitchingFileRef = useRef(false);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(true);
  const [timerCollapsed, setTimerCollapsed] = useState(false);

  // Floating Notes panel state
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [notesContent, setNotesContent] = useState(() => {
    const stored = localStorage.getItem('personal_notes');
    if (stored && (
      stored.includes('Markdown Editor Toolbar Guide') || 
      stored.includes('italic text') || 
      stored.includes('Make your notes here') ||
      stored.includes('Alt text') ||
      stored.includes('example.com') ||
      stored.includes('Blockquote') ||
      stored.includes('Mechanism') ||
      stored.includes('preview layout')
    )) {
      localStorage.setItem('personal_notes', '');
      return '';
    }
    return stored || '';
  });
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

  // Click outside to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (showLayoutDropdown && !e.target.closest('.icon-btn-leetcode') && !e.target.closest('.glass-panel')) {
        setShowLayoutDropdown(false);
      }
      if (showLangDropdown && !e.target.closest('.action-btn') && !e.target.closest('.glass-panel')) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showLayoutDropdown, showLangDropdown]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const result = await getHistory();
      if (result) {
        const list = Array.isArray(result) ? result : (result.data || []);
        setHistory(list);
        
        // Auto-select the first named file from history on load if available and no file is active
        if (!activeFileName && list.length > 0) {
          const firstNamed = list.find(item => item.fileName && item.fileName !== 'untitled.py');
          if (firstNamed) {
            isSwitchingFileRef.current = true;
            handleSelectHistoryItem(firstNamed);
            setOpenTabs([firstNamed.id]);
          } else {
            setShowFileNameModal(true);
          }
        } else if (!activeFileName) {
          setShowFileNameModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to load history:', err);
      if (!activeFileName) {
        setShowFileNameModal(true);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  // Debounced auto-save effect
  useEffect(() => {
    if (isSwitchingFileRef.current) {
      isSwitchingFileRef.current = false;
      return;
    }

    if (!activeHistoryId) return;

    setAutoSaveStatus('Saving...');
    const delay = setTimeout(async () => {
      try {
        await updateHistoryItem(activeHistoryId, { code });
        setHistory(prev => prev.map(item => 
          item.id === activeHistoryId ? { ...item, code } : item
        ));
        setAutoSaveStatus('Saved');
      } catch (err) {
        console.error('Auto-save error:', err);
        setAutoSaveStatus('Error');
      }
    }, 1000);

    return () => clearTimeout(delay);
  }, [code]);

  const handleRenameClick = (e, id, currentName) => {
    e.stopPropagation();
    setRenameItemId(id);
    setRenameItemName(currentName || '');
    setShowRenameModal(true);
  };

  const handleSaveRename = async () => {
    let name = renameItemName.trim();
    if (!name) return;

    const item = history.find(h => h.id === renameItemId);
    const itemLang = item ? item.language : 'python';
    const extMap = { python: '.py', java: '.java', cpp: '.cpp', c: '.c' };
    const currentExt = extMap[itemLang] || '.py';

    if (!name.endsWith(currentExt)) {
      const base = name.replace(/\.[a-zA-Z0-9]+$/, '');
      name = base + currentExt;
    }

    const nameExists = history.some(h => h.id !== renameItemId && h.fileName && h.fileName.toLowerCase() === name.toLowerCase());
    if (nameExists) {
      alert(`A file named "${name}" already exists. Please enter a different name.`);
      return;
    }

    try {
      await updateHistoryItem(renameItemId, { fileName: name });
      setHistory(prev => prev.map(h => 
        h.id === renameItemId ? { ...h, fileName: name } : h
      ));
      if (renameItemId === activeHistoryId) {
        setActiveFileName(name);
      }
      setShowRenameModal(false);
    } catch (err) {
      console.error('Failed to rename file:', err);
      alert('Failed to rename file. Please try again.');
    }
  };

  const handleExportWorkspace = async () => {
    const zip = new JSZip();
    const validFiles = history.filter(h => h.fileName && h.fileName !== 'untitled.py');
    if (validFiles.length === 0) {
      alert('No files available to export in the workspace.');
      return;
    }
    validFiles.forEach(item => {
      zip.file(item.fileName, item.code);
    });
    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `codeorbit_workspace_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export workspace zip:', err);
      alert('Failed to generate ZIP archive.');
    }
  };

  const handleImportWorkspace = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const zip = await JSZip.loadAsync(event.target.result);
        const importedEntries = [];
        
        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          const content = await zipEntry.async('string');
          
          let lang = 'python';
          if (relativePath.endsWith('.java')) lang = 'java';
          else if (relativePath.endsWith('.cpp')) lang = 'cpp';
          else if (relativePath.endsWith('.c')) lang = 'c';
          
          const newEntry = await createHistoryItem(relativePath, lang, content);
          if (newEntry) {
            importedEntries.push(newEntry);
          }
        }
        
        if (importedEntries.length > 0) {
          await fetchHistory();
          alert(`Successfully imported ${importedEntries.length} files from ZIP!`);
        } else {
          alert('No files were found in the uploaded ZIP.');
        }
      } catch (err) {
        console.error('Error importing ZIP:', err);
        alert('Failed to read ZIP file. Make sure it is a valid zip archive.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleDeleteHistoryItem = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteHistoryItem(id);
      setHistory(prev => prev.filter(item => item.id !== id));
      setOpenTabs(prev => prev.filter(tid => tid !== id));
      if (activeHistoryId === id) {
        setActiveHistoryId(null);
        setActiveFileName('');
        setCode('');
        setConsoleLines([]);
        setConsoleStatus('');
        setConsoleTime(null);
        setConsoleEngine('');
        setConsoleMemory(null);
        setConsoleExitCode(null);
        setTestCaseResults(null);
      }
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const handleRunTestCases = async (activeCases) => {
    setIsExecuting(true);
    setTestCaseResults(null);
    setConsoleStatus('Running Tests...');
    setConsoleLines([]);

    try {
      const wsUrl = `ws://${window.location.hostname}:5000`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: 'run_tests',
          code,
          fileName: activeFileName,
          language: selectedLanguage,
          testCases: activeCases,
          version: compilerVersion
        }));
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'test_cases_exit') {
            setIsExecuting(false);
            if (message.error) {
              setConsoleLines([{ type: 'stderr', text: message.error + '\n' }]);
              setConsoleStatus('Compile Error');
            } else {
              setTestCaseResults(message.results);
              const passedCount = message.results.filter(r => r.passed).length;
              const totalCount = message.results.length;
              setConsoleStatus(passedCount === totalCount ? 'All Passed' : `${passedCount}/${totalCount} Passed`);
            }
            socket.close();
          }
        } catch (err) {
          console.error('Test parse error:', err);
        }
      };

      socket.onerror = (err) => {
        console.error('Test WS Error:', err);
        setConsoleLines([{ type: 'stderr', text: 'WebSocket Connection Error during test case run.\n' }]);
        setConsoleStatus('Error');
        setIsExecuting(false);
      };

      socket.onclose = () => {
        socketRef.current = null;
        setIsExecuting(false);
      };
    } catch (err) {
      setConsoleLines([{ type: 'stderr', text: err.message || 'Error occurred.\n' }]);
      setConsoleStatus('Error');
      setIsExecuting(false);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Clear all execution history?')) {
      try {
        await clearHistory();
        setHistory([]);
        setActiveHistoryId(null);
        setTestCaseResults(null);
        setConsoleLines([]);
        setConsoleStatus('');
        setConsoleTime(null);
        setConsoleEngine('');
        setConsoleMemory(null);
        setConsoleExitCode(null);
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
    setConsoleMemory(null);
    setConsoleExitCode(null);

    try {
      const wsUrl = `ws://${window.location.hostname}:5000`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'run', code: codeToRun, fileName: activeFileName, language: selectedLanguage, version: compilerVersion }));
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
            setConsoleMemory(message.memoryUsage || null);
            setConsoleExitCode(message.code !== undefined ? message.code : null);
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
      setConsoleMemory(null);
      setConsoleExitCode(null);
      setIsExecuting(false);
    }
  };

  const handleSaveFileName = async () => {
    let name = tempFileName.trim();
    const extMap = { python: '.py', java: '.java', cpp: '.cpp', c: '.c' };
    const currentExt = extMap[selectedLanguage] || '.py';
    
    if (!name || name.toLowerCase() === 'untitled' || Object.values(extMap).some(ext => name.toLowerCase() === `untitled${ext}`)) {
      alert('Please enter a custom file name.');
      return;
    }

    if (!name.endsWith(currentExt)) {
      const base = name.replace(/\.[a-zA-Z0-9]+$/, '');
      name = base + currentExt;
    }

    // Prevent duplicate filenames in history
    const nameExists = history.some(item => item.fileName && item.fileName.toLowerCase() === name.toLowerCase());
    if (nameExists) {
      alert(`A file named "${name}" already exists. Please enter a different name.`);
      return;
    }

    const defaultCodeForLang = CODE_TEMPLATES[selectedLanguage] || CODE_TEMPLATES.python;
    try {
      const newEntry = await createHistoryItem(name, selectedLanguage, defaultCodeForLang);
      if (newEntry) {
        setHistory(prev => [newEntry, ...prev]);
        isSwitchingFileRef.current = true;
        setActiveHistoryId(newEntry.id);
        setActiveFileName(name);
        setCode(defaultCodeForLang);
        setOpenTabs(prev => [...prev, newEntry.id]);
        
        // Clear console outputs
        setConsoleLines([]);
        setConsoleStatus('');
        setConsoleTime(null);
        setConsoleEngine('');
      }
    } catch (err) {
      console.error('Failed to create named file entry:', err);
      alert('Error creating file. Please try again.');
    }

    setShowFileNameModal(false);
    setTempFileName('');
  };

  const handleLanguageChange = (newLang) => {
    setSelectedLanguage(newLang);
    const defaults = { cpp: 'c++20', c: 'c11', java: '17', python: '3' };
    setCompilerVersion(defaults[newLang] || '3');
    
    // Update active file name extension accordingly
    if (activeFileName) {
      const lastDotIdx = activeFileName.lastIndexOf('.');
      const base = lastDotIdx !== -1 ? activeFileName.substring(0, lastDotIdx) : activeFileName;
      const ext = newLang === 'python' ? 'py' : newLang === 'java' ? 'java' : newLang === 'cpp' ? 'cpp' : 'c';
      setActiveFileName(`${base}.${ext}`);
    }
    
    const pyTemplate = CODE_TEMPLATES.python;
    const cTemplate = CODE_TEMPLATES.c;
    const cppTemplate = CODE_TEMPLATES.cpp;
    const javaTemplate = CODE_TEMPLATES.java;

    const trimmedCode = code.trim();
    if (!trimmedCode || 
        trimmedCode === pyTemplate.trim() || 
        trimmedCode === cTemplate.trim() || 
        trimmedCode === cppTemplate.trim() || 
        trimmedCode === javaTemplate.trim() ||
        trimmedCode === `# Welcome to the AI Python Code Runner\n# Write your Python code below\n# If any error occurs, click AI Quick Fix\n\nprint("Hello World")`.trim()
    ) {
      const nextTemplate = CODE_TEMPLATES[newLang] || CODE_TEMPLATES.python;
      setCode(nextTemplate);
    }
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
    isSwitchingFileRef.current = true;
    setActiveHistoryId(item.id);
    setCode(item.code);
    setExplanation('');
    setSelectedLanguage(item.language || 'python');
    if (item.fileName) {
      setActiveFileName(item.fileName);
    } else {
      setActiveFileName(item.language === 'java' ? 'untitled.java' : item.language === 'cpp' ? 'untitled.cpp' : item.language === 'c' ? 'untitled.c' : 'untitled.py');
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
    setConsoleMemory(item.memoryUsage || null);
    setConsoleExitCode(item.exitCode !== undefined ? item.exitCode : null);
    setTestCaseResults(null);
    setActiveHistoryId(item.id);
    
    // Add to open tabs if not present
    if (!openTabs.includes(item.id)) {
      setOpenTabs(prev => [...prev, item.id]);
    }
  };

  const handleClearConsole = () => {
    setConsoleLines([]);
    setConsoleStatus('');
    setConsoleTime(null);
    setConsoleEngine('');
    setConsoleMemory(null);
    setConsoleExitCode(null);
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
        language={selectedLanguage}
        fontSize={fontSize}
        setFontSize={setFontSize}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        openTabs={openTabs}
        activeHistoryId={activeHistoryId}
        onSelectTab={(id) => {
          const item = history.find(h => h.id === id);
          if (item) handleSelectHistoryItem(item);
        }}
        onCloseTab={(id) => {
          const tabIndex = openTabs.indexOf(id);
          const updatedTabs = openTabs.filter(tid => tid !== id);
          setOpenTabs(updatedTabs);
          
          if (id === activeHistoryId) {
            if (updatedTabs.length > 0) {
              const nextActiveId = updatedTabs[Math.min(tabIndex, updatedTabs.length - 1)];
              const nextItem = history.find(h => h.id === nextActiveId);
              if (nextItem) handleSelectHistoryItem(nextItem);
            } else {
              setActiveHistoryId(null);
              setActiveFileName('');
              setCode('');
              setConsoleLines([]);
              setConsoleStatus('');
              setConsoleTime(null);
              setConsoleEngine('');
              setConsoleMemory(null);
              setConsoleExitCode(null);
              setTestCaseResults(null);
            }
          }
        }}
        history={history}
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
        memoryUsage={consoleMemory}
        exitCode={consoleExitCode}
        testCases={testCases}
        testCaseResults={testCaseResults}
        onRunTestCases={handleRunTestCases}
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
              <svg 
                className="logo-icon animate-fade" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ flexShrink: 0 }}
              >
                <defs>
                  <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <polygon 
                  points="12 2, 21 6.5, 21 17.5, 12 22, 3 17.5, 3 6.5" 
                  stroke="url(#logo-grad)" 
                  strokeWidth="2.2" 
                  strokeLinejoin="round" 
                  fill="none" 
                />
                <path 
                  d="M8.5 9.5 L5.5 12 L8.5 14.5" 
                  stroke="#38bdf8" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  fill="none" 
                />
                <path 
                  d="M15.5 9.5 L18.5 12 L15.5 14.5" 
                  stroke="#38bdf8" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  fill="none" 
                />
                <line 
                  x1="13.5" 
                  y1="8" 
                  x2="10.5" 
                  y2="16" 
                  stroke="#38bdf8" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <div style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Code</span>
                  <span style={{
                    background: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 700
                  }}>Orbit</span>
                </div>
                <div style={{
                  fontSize: '0.52rem',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.8px',
                  fontWeight: 600,
                  marginTop: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  textTransform: 'uppercase'
                }}>
                  <span>Write</span>
                  <span style={{ color: '#38bdf8', fontSize: '0.6rem' }}>•</span>
                  <span>Run</span>
                  <span style={{ color: '#818cf8', fontSize: '0.6rem' }}>•</span>
                  <span>Debug</span>
                  <span style={{ color: '#a855f7', fontSize: '0.6rem' }}>•</span>
                  <span>Innovate</span>
                </div>
              </div>
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

          {/* Workspace ZIP utilities */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px'
          }}>
            <label
              htmlFor="import-zip-input"
              className="action-btn"
              style={{
                flex: 1,
                fontSize: '0.75rem',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px'
              }}
              title="Import Workspace (.zip)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-color)' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>Import ZIP</span>
            </label>
            <input
              type="file"
              id="import-zip-input"
              accept=".zip"
              onChange={handleImportWorkspace}
              style={{ display: 'none' }}
            />

            <button
              onClick={handleExportWorkspace}
              className="action-btn"
              style={{
                flex: 1,
                fontSize: '0.75rem',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
              title="Export Workspace (.zip)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-color)' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Export ZIP</span>
            </button>
          </div>

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
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                    <button
                      onClick={(e) => handleRenameClick(e, item.id, item.fileName)}
                      className="history-rename-btn"
                      title="Rename file"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-color)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                      className="history-delete-btn"
                      title="Remove item"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
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
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="sidebar-toggle-logo-btn"
              title={sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
            >
              {/* SVG 1: CodeOrbit Logo Icon (Visible by default) */}
              <svg 
                className="logo-icon-svg" 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="logo-grad-toggle" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <polygon 
                  points="12 2, 21 6.5, 21 17.5, 12 22, 3 17.5, 3 6.5" 
                  stroke="url(#logo-grad-toggle)" 
                  strokeWidth="2.5" 
                  strokeLinejoin="round" 
                  fill="none" 
                />
                <path 
                  d="M8.5 9.5 L5.5 12 L8.5 14.5" 
                  stroke="#38bdf8" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  fill="none" 
                />
                <path 
                  d="M15.5 9.5 L18.5 12 L15.5 14.5" 
                  stroke="#38bdf8" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  fill="none" 
                />
                <line 
                  x1="13.5" 
                  y1="8" 
                  x2="10.5" 
                  y2="16" 
                  stroke="#38bdf8" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                />
              </svg>

              {/* SVG 2: Sidebar Toggle Icon (Visible on hover) */}
              <svg 
                className="menu-icon-svg" 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <path d={sidebarOpen ? "M15 15l-3-3 3-3" : "M15 9l3 3-3 3"} />
              </svg>
            </button>
            <Terminal size={15} style={{ color: 'var(--accent-color)', marginLeft: '4px' }} />
            <span>Interactive Editor</span>
          </div>

          {/* Centered Active File Name & Language Selection Badge */}
          {activeFileName && (
            <div style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 10
            }}>
              {/* Box 1: File Name */}
              <div className="active-file-badge animate-fade" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                height: '32px',
                boxSizing: 'border-box'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-color)' }}>
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span>{activeFileName}</span>
              </div>

              {/* Box 2: Language Selector */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="action-btn animate-fade"
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--accent-color)',
                    borderColor: 'var(--border-color)',
                    background: 'var(--bg-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    height: '32px',
                    boxSizing: 'border-box'
                  }}
                  title="Select Programming Language"
                >
                  <span>{selectedLanguage === 'python' ? 'Python' : selectedLanguage === 'java' ? 'Java' : selectedLanguage === 'cpp' ? 'C++' : 'C'}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: showLangDropdown ? 'rotate(180deg)' : 'none' }}>
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>
                
                {showLangDropdown && (
                  <div className="glass-panel animate-fade" style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: '120px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-main)',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    zIndex: 200
                  }}>
                    {[
                      { value: 'python', label: 'Python' },
                      { value: 'c', label: 'C' },
                      { value: 'cpp', label: 'C++' },
                      { value: 'java', label: 'Java' }
                    ].map((lang) => (
                      <button
                        key={lang.value}
                        onClick={() => {
                          handleLanguageChange(lang.value);
                          setShowLangDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          background: selectedLanguage === lang.value ? 'rgba(var(--accent-color-rgb), 0.1)' : 'transparent',
                          color: selectedLanguage === lang.value ? 'var(--accent-color)' : 'var(--text-primary)',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: selectedLanguage === lang.value ? 600 : 400,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Box 2.5: Compiler Version Selector */}
              {(selectedLanguage === 'cpp' || selectedLanguage === 'c' || selectedLanguage === 'java') && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                    className="action-btn animate-fade"
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--accent-color)',
                      borderColor: 'var(--border-color)',
                      background: 'var(--bg-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      height: '32px',
                      boxSizing: 'border-box'
                    }}
                    title="Select Compiler Version / Standard"
                  >
                    <span>{getCompilerVersionLabel()}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: showVersionDropdown ? 'rotate(180deg)' : 'none' }}>
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>
                  
                  {showVersionDropdown && (
                    <div className="glass-panel animate-fade" style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      width: '150px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-main)',
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      zIndex: 200
                    }}>
                      {getAvailableVersions(selectedLanguage).map((ver) => (
                        <button
                          key={ver.value}
                          onClick={() => {
                            setCompilerVersion(ver.value);
                            setShowVersionDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 12px',
                            background: compilerVersion === ver.value ? 'rgba(var(--accent-color-rgb), 0.1)' : 'transparent',
                            color: compilerVersion === ver.value ? 'var(--accent-color)' : 'var(--text-primary)',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: compilerVersion === ver.value ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {ver.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Box 3: Auto Save Status Indicator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 600,
                background: autoSaveStatus === 'Saving...' ? 'rgba(234, 179, 8, 0.1)' : autoSaveStatus === 'Error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                color: autoSaveStatus === 'Saving...' ? 'var(--warning-color, #eab308)' : autoSaveStatus === 'Error' ? 'var(--error-color, #ef4444)' : 'var(--success-color, #22c55e)',
                border: autoSaveStatus === 'Saving...' ? '1px solid rgba(234, 179, 8, 0.2)' : autoSaveStatus === 'Error' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(34, 197, 94, 0.2)',
                height: '20px',
                boxSizing: 'border-box'
              }}>
                <span style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: 'currentColor',
                  display: 'inline-block'
                }} />
                <span>{autoSaveStatus}</span>
              </div>
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
                <span>Create New File</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>File Name</label>
                <input 
                  type="text"
                  value={tempFileName}
                  onChange={(e) => setTempFileName(e.target.value)}
                  placeholder="e.g. main"
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

        {/* Rename File Modal */}
        {showRenameModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div className="glass-panel animate-fade" style={{
              width: '320px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: 'var(--shadow-main)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem', marginBottom: '16px' }}>
                <Edit2 size={16} style={{ color: 'var(--accent-color)' }} />
                <span>Rename File</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>New Name</label>
                <input
                  type="text"
                  value={renameItemName}
                  onChange={(e) => setRenameItemName(e.target.value)}
                  placeholder="e.g. main"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') setShowRenameModal(false);
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => setShowRenameModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRename}
                  style={{
                    background: 'var(--accent-color)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
