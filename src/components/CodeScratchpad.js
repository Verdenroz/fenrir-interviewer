'use client';

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';

const SUPPORTED_LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', defaultCode: '// Welcome to JavaScript\nconsole.log("Hello, World!");' },
  { id: 'typescript', name: 'TypeScript', defaultCode: '// Welcome to TypeScript\nconst greeting: string = "Hello, World!";\nconsole.log(greeting);' },
  { id: 'python', name: 'Python', defaultCode: '# Welcome to Python\nprint("Hello, World!")' },
  { id: 'java', name: 'Java', defaultCode: '// Welcome to Java\npublic class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}' },
  { id: 'cpp', name: 'C++', defaultCode: '// Welcome to C++\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}' },
  { id: 'c', name: 'C', defaultCode: '// Welcome to C\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}' },
  { id: 'csharp', name: 'C#', defaultCode: '// Welcome to C#\nusing System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}' },
  { id: 'go', name: 'Go', defaultCode: '// Welcome to Go\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}' },
  { id: 'rust', name: 'Rust', defaultCode: '// Welcome to Rust\nfn main() {\n    println!("Hello, World!");\n}' },
  { id: 'php', name: 'PHP', defaultCode: '<?php\n// Welcome to PHP\necho "Hello, World!";\n?>' },
  { id: 'ruby', name: 'Ruby', defaultCode: '# Welcome to Ruby\nputs "Hello, World!"' },
  { id: 'swift', name: 'Swift', defaultCode: '// Welcome to Swift\nimport Swift\nprint("Hello, World!")' },
  { id: 'kotlin', name: 'Kotlin', defaultCode: '// Welcome to Kotlin\nfun main() {\n    println("Hello, World!")\n}' },
  { id: 'html', name: 'HTML', defaultCode: '<!-- Welcome to HTML -->\n<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello World</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>' },
  { id: 'css', name: 'CSS', defaultCode: '/* Welcome to CSS */\nbody {\n    font-family: Arial, sans-serif;\n    background-color: #f0f0f0;\n    margin: 0;\n    padding: 20px;\n}\n\nh1 {\n    color: #333;\n    text-align: center;\n}' },
  { id: 'json', name: 'JSON', defaultCode: '{\n  "message": "Hello, World!",\n  "language": "JSON",\n  "version": "1.0"\n}' },
  { id: 'sql', name: 'SQL', defaultCode: '-- Welcome to SQL\nSELECT \'Hello, World!\' AS message;' },
  { id: 'markdown', name: 'Markdown', defaultCode: '# Welcome to Markdown\n\nHello, **World**!\n\n- This is a list item\n- Another item\n\n```javascript\nconsole.log("Code block");\n```' }
];

const EDITOR_THEMES = [
  { id: 'vs-dark', name: 'Dark' },
  { id: 'vs', name: 'Light' },
  { id: 'hc-black', name: 'High Contrast Dark' },
  { id: 'hc-light', name: 'High Contrast Light' }
];

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 22, 24];

export default function CodeScratchpad() {
  const [currentLanguage, setCurrentLanguage] = useState('javascript');
  const [theme, setTheme] = useState('vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const [codeContent, setCodeContent] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const editorRef = useRef(null);

  // Load saved preferences and code from localStorage
  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem('codeScratchpad.language');
      const savedTheme = localStorage.getItem('codeScratchpad.theme');
      const savedFontSize = localStorage.getItem('codeScratchpad.fontSize');
      const savedCode = localStorage.getItem('codeScratchpad.code');

      if (savedLanguage && SUPPORTED_LANGUAGES.find(lang => lang.id === savedLanguage)) {
        setCurrentLanguage(savedLanguage);
      }
      if (savedTheme && EDITOR_THEMES.find(t => t.id === savedTheme)) {
        setTheme(savedTheme);
      }
      if (savedFontSize && FONT_SIZES.includes(parseInt(savedFontSize))) {
        setFontSize(parseInt(savedFontSize));
      }
      if (savedCode) {
        setCodeContent(JSON.parse(savedCode));
      }
    } catch (error) {
      console.warn('Failed to load saved preferences:', error);
    }
    setIsLoading(false);
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('codeScratchpad.language', currentLanguage);
      localStorage.setItem('codeScratchpad.theme', theme);
      localStorage.setItem('codeScratchpad.fontSize', fontSize.toString());
    }
  }, [currentLanguage, theme, fontSize, isLoading]);

  // Save code content to localStorage
  useEffect(() => {
    if (!isLoading && Object.keys(codeContent).length > 0) {
      localStorage.setItem('codeScratchpad.code', JSON.stringify(codeContent));
    }
  }, [codeContent, isLoading]);

  const getCurrentCode = () => {
    const currentLang = SUPPORTED_LANGUAGES.find(lang => lang.id === currentLanguage);
    return codeContent[currentLanguage] || currentLang?.defaultCode || '';
  };

  const handleLanguageChange = (newLanguage) => {
    setCurrentLanguage(newLanguage);
  };

  const handleEditorChange = (value) => {
    setCodeContent(prev => ({
      ...prev,
      [currentLanguage]: value || ''
    }));
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure editor options for better coding experience
    editor.updateOptions({
      automaticLayout: true,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
      renderWhitespace: 'selection',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      multiCursorModifier: 'ctrlCmd',
      formatOnPaste: true,
      formatOnType: true,
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      autoIndent: 'full',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true
      }
    });

    // Add custom keybindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Prevent browser save dialog
      // Could implement save functionality here
    });

    // Focus the editor
    editor.focus();
  };

  const formatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
    }
  };

  const clearCode = () => {
    if (confirm('Are you sure you want to clear all code for this language?')) {
      setCodeContent(prev => ({
        ...prev,
        [currentLanguage]: ''
      }));
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(getCurrentCode());
      // Could add toast notification here
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const downloadCode = () => {
    const currentLang = SUPPORTED_LANGUAGES.find(lang => lang.id === currentLanguage);
    const code = getCurrentCode();
    const filename = `scratchpad.${getFileExtension(currentLanguage)}`;

    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileExtension = (languageId) => {
    const extensions = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      csharp: 'cs',
      go: 'go',
      rust: 'rs',
      php: 'php',
      ruby: 'rb',
      swift: 'swift',
      kotlin: 'kt',
      html: 'html',
      css: 'css',
      json: 'json',
      sql: 'sql',
      markdown: 'md'
    };
    return extensions[languageId] || 'txt';
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">💻</div>
          <p className="text-lg text-gray-600">Loading Code Scratchpad...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 mb-2 flex-shrink-0" style={{ height: 'auto' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-800">
            Code Scratchpad
          </h2>

          <div className="flex flex-wrap items-center gap-4">
            {/* Language Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Language:</label>
              <select
                value={currentLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.id} value={lang.id}>{lang.name}</option>
                ))}
              </select>
            </div>

            {/* Theme Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Theme:</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EDITOR_THEMES.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Font Size Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Size:</label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FONT_SIZES.map(size => (
                  <option key={size} value={size}>{size}px</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            onClick={formatCode}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors"
          >
            Format
          </button>
          <button
            onClick={copyCode}
            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-medium transition-colors"
          >
            Copy
          </button>
          <button
            onClick={downloadCode}
            className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm font-medium transition-colors"
          >
            Download
          </button>
          <button
            onClick={clearCode}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="bg-white shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        <Editor
          height="100%"
          language={currentLanguage}
          value={getCurrentCode()}
          theme={theme}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize,
            fontFamily: 'Consolas, "Courier New", monospace',
            automaticLayout: true,
            minimap: { enabled: window.innerWidth > 1024 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            glyphMargin: true,
            folding: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            renderWhitespace: 'selection',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            multiCursorModifier: 'ctrlCmd',
            formatOnPaste: true,
            formatOnType: true,
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoIndent: 'full'
          }}
        />
      </div>

      {/* Status Bar */}
      <div className="bg-gray-100 px-4 py-2 mt-2 flex-shrink-0" style={{ height: 'auto' }}>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span>Language: {SUPPORTED_LANGUAGES.find(lang => lang.id === currentLanguage)?.name}</span>
            <span>Theme: {EDITOR_THEMES.find(t => t.id === theme)?.name}</span>
            <span>Font: {fontSize}px</span>
          </div>
          <div className="text-xs">
            Ctrl/Cmd + S to save • Ctrl/Cmd + / to comment • Alt + Shift + F to format
          </div>
        </div>
      </div>
    </div>
  );
}