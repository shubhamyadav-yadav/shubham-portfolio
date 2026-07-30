const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PROJECT_ROOT = path.join(__dirname, '..');
const PORT = 7700;

const EDITABLE_FILES = [
  'index.html',
  'support.html',
  'README.md'
];

function getContentType(ext) {
  const map = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  return map[ext] || 'text/plain';
}

const editorHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>✏️ Portfolio Editor</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --dim: #8b949e;
      --accent: #f78166;
      --accent2: #79c0ff;
      --green: #56d364;
      --yellow: #e3b341;
      --red: #f85149;
      --tab-bg: #1c2128;
    }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── TITLE BAR ── */
    .titlebar {
      height: 38px;
      background: #010409;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      user-select: none;
    }
    .titlebar-left { display: flex; align-items: center; gap: 10px; }
    .titlebar-icon { font-size: 16px; }
    .titlebar-title { font-size: 13px; color: var(--dim); font-weight: 500; }
    .titlebar-title strong { color: var(--text); }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot.red { background: #ff5f57; }
    .dot.yellow { background: #febc2e; }
    .dot.green { background: #28c840; }
    .dots { display: flex; gap: 8px; }
    .save-indicator {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 20px;
      background: rgba(86, 211, 100, 0.1);
      border: 1px solid rgba(86, 211, 100, 0.3);
      color: var(--green);
      transition: all 0.3s;
    }
    .save-indicator.unsaved {
      background: rgba(227, 179, 65, 0.1);
      border-color: rgba(227, 179, 65, 0.3);
      color: var(--yellow);
    }
    .save-indicator.saving {
      background: rgba(121, 192, 255, 0.1);
      border-color: rgba(121, 192, 255, 0.3);
      color: var(--accent2);
    }

    /* ── TOOLBAR ── */
    .toolbar {
      height: 44px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      padding: 0 12px;
      gap: 8px;
      flex-shrink: 0;
    }
    .toolbar-btn {
      height: 30px;
      padding: 0 14px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      border-radius: 6px;
      font: 600 12px 'Inter', sans-serif;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .toolbar-btn:hover { border-color: var(--accent2); color: var(--accent2); background: rgba(121,192,255,0.05); }
    .toolbar-btn.primary {
      background: linear-gradient(135deg, #238636, #2ea043);
      border-color: #2ea043;
      color: #fff;
    }
    .toolbar-btn.primary:hover { background: linear-gradient(135deg, #2ea043, #3fb950); box-shadow: 0 0 16px rgba(46,160,67,0.4); }
    .toolbar-btn.danger { border-color: var(--red); color: var(--red); }
    .toolbar-btn.danger:hover { background: rgba(248,81,73,0.08); }
    .toolbar-sep { width: 1px; height: 22px; background: var(--border); margin: 0 4px; }
    .toolbar-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
    .shortcut-hint { font-size: 11px; color: var(--dim); }
    kbd {
      display: inline-block;
      padding: 1px 5px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font: 10px 'JetBrains Mono', monospace;
      color: var(--dim);
      background: var(--bg);
    }

    /* ── FILE TABS ── */
    .tabs-bar {
      height: 36px;
      background: var(--tab-bg);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: flex-end;
      padding: 0 8px;
      gap: 2px;
      overflow-x: auto;
      flex-shrink: 0;
    }
    .tabs-bar::-webkit-scrollbar { height: 3px; }
    .tabs-bar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
    .tab {
      height: 32px;
      padding: 0 14px;
      background: var(--tab-bg);
      border: 1px solid transparent;
      border-bottom: none;
      border-radius: 6px 6px 0 0;
      color: var(--dim);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 7px;
      white-space: nowrap;
      transition: all 0.15s;
      position: relative;
    }
    .tab:hover { color: var(--text); background: rgba(255,255,255,0.04); }
    .tab.active {
      background: var(--bg);
      color: var(--text);
      border-color: var(--border);
      border-bottom-color: var(--bg);
    }
    .tab.active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--accent2);
      border-radius: 2px 2px 0 0;
    }
    .tab-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--yellow); display: none; }
    .tab.modified .tab-dot { display: block; }
    .file-icon { font-size: 13px; }

    /* ── MAIN LAYOUT ── */
    .main {
      flex: 1;
      display: flex;
      overflow: hidden;
    }

    /* ── MINIMAP / SIDEBAR ── */
    .sidebar {
      width: 220px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow: hidden;
    }
    .sidebar-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--dim);
      padding: 10px 14px 8px;
      border-bottom: 1px solid var(--border);
    }
    .file-tree { padding: 6px 0; overflow-y: auto; flex: 1; }
    .file-item {
      padding: 7px 14px;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--dim);
      transition: all 0.15s;
      border-left: 2px solid transparent;
    }
    .file-item:hover { background: rgba(255,255,255,0.04); color: var(--text); }
    .file-item.active {
      background: rgba(121,192,255,0.08);
      color: var(--accent2);
      border-left-color: var(--accent2);
    }
    .file-item.modified { color: var(--yellow); }
    .file-item.modified.active { color: var(--yellow); border-left-color: var(--yellow); }

    /* ── EDITOR AREA ── */
    .editor-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #monaco-editor {
      flex: 1;
      overflow: hidden;
    }

    /* ── STATUS BAR ── */
    .statusbar {
      height: 24px;
      background: #0969da;
      display: flex;
      align-items: center;
      padding: 0 12px;
      gap: 16px;
      flex-shrink: 0;
      font-size: 11px;
      color: rgba(255,255,255,0.85);
    }
    .statusbar-item { display: flex; align-items: center; gap: 5px; }
    .statusbar-right { margin-left: auto; display: flex; gap: 16px; }

    /* ── TOAST ── */
    .toast {
      position: fixed;
      bottom: 36px;
      right: 20px;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      z-index: 9999;
      transform: translateY(60px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.34, 1.25, 0.64, 1);
      pointer-events: none;
    }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast.success { background: rgba(86,211,100,0.15); border: 1px solid rgba(86,211,100,0.4); color: var(--green); }
    .toast.error { background: rgba(248,81,73,0.15); border: 1px solid rgba(248,81,73,0.4); color: var(--red); }
    .toast.info { background: rgba(121,192,255,0.15); border: 1px solid rgba(121,192,255,0.4); color: var(--accent2); }

    /* ── SEARCH BAR ── */
    .search-bar {
      height: 0;
      overflow: hidden;
      background: var(--surface);
      border-bottom: 1px solid transparent;
      display: flex;
      align-items: center;
      padding: 0 12px;
      gap: 8px;
      transition: all 0.25s;
      flex-shrink: 0;
    }
    .search-bar.open { height: 42px; border-bottom-color: var(--border); }
    .search-input {
      flex: 1;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font: 13px 'Inter', sans-serif;
      padding: 5px 10px;
      outline: none;
    }
    .search-input:focus { border-color: var(--accent2); }
    .search-count { font-size: 12px; color: var(--dim); white-space: nowrap; }
    .search-close { cursor: pointer; color: var(--dim); font-size: 16px; padding: 2px 6px; border-radius: 4px; }
    .search-close:hover { color: var(--text); background: rgba(255,255,255,0.05); }
  </style>
</head>
<body>

  <!-- Title Bar -->
  <div class="titlebar">
    <div class="titlebar-left">
      <div class="dots">
        <div class="dot red"></div>
        <div class="dot yellow"></div>
        <div class="dot green"></div>
      </div>
      <span class="titlebar-icon">✏️</span>
      <span class="titlebar-title"><strong>Portfolio Editor</strong> — Shubham Yadav</span>
    </div>
    <span class="save-indicator" id="saveIndicator">● All Saved</span>
  </div>

  <!-- Toolbar -->
  <div class="toolbar">
    <button class="toolbar-btn primary" onclick="saveFile()" id="saveBtn">
      💾 Save
    </button>
    <button class="toolbar-btn" onclick="formatDoc()">⚡ Format</button>
    <button class="toolbar-btn" onclick="toggleSearch()">🔍 Find</button>
    <div class="toolbar-sep"></div>
    <button class="toolbar-btn" onclick="undoEdit()">↩ Undo</button>
    <button class="toolbar-btn" onclick="redoEdit()">↪ Redo</button>
    <div class="toolbar-sep"></div>
    <button class="toolbar-btn" onclick="openPreview()" title="Open live preview">🌐 Preview</button>
    <div class="toolbar-right">
      <span class="shortcut-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> to save &nbsp;|&nbsp; <kbd>Ctrl</kbd>+<kbd>F</kbd> to find</span>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs-bar" id="tabsBar"></div>

  <!-- Search Bar -->
  <div class="search-bar" id="searchBar">
    <input class="search-input" id="searchInput" placeholder="Find in file..." />
    <span class="search-count" id="searchCount"></span>
    <span class="search-close" onclick="toggleSearch()">✕</span>
  </div>

  <!-- Main -->
  <div class="main">
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="sidebar-title">📁 Explorer</div>
      <div class="file-tree" id="fileTree"></div>
    </div>

    <!-- Editor -->
    <div class="editor-container">
      <div id="monaco-editor"></div>
    </div>
  </div>

  <!-- Status Bar -->
  <div class="statusbar">
    <div class="statusbar-item">🌿 main</div>
    <div class="statusbar-item" id="sb-file">No file open</div>
    <div class="statusbar-right">
      <div class="statusbar-item" id="sb-pos">Ln 1, Col 1</div>
      <div class="statusbar-item" id="sb-lang">HTML</div>
      <div class="statusbar-item" id="sb-lines">0 lines</div>
      <div class="statusbar-item">UTF-8</div>
    </div>
  </div>

  <!-- Toast -->
  <div class="toast" id="toast"></div>

  <!-- Monaco Loader -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js"></script>
  <script>
    const FILES = ${JSON.stringify(EDITABLE_FILES)};
    let editor = null;
    let currentFile = null;
    let fileContents = {};
    let fileModified = {};
    let decorations = [];

    // ── INIT MONACO ──────────────────────────────────
    require.config({
      paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }
    });
    require(['vs/editor/editor.main'], () => {
      monaco.editor.defineTheme('github-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
          { token: 'keyword', foreground: 'ff7b72' },
          { token: 'string', foreground: 'a5d6ff' },
          { token: 'number', foreground: '79c0ff' },
          { token: 'tag', foreground: '7ee787' },
          { token: 'attribute.name', foreground: 'ffa657' },
          { token: 'attribute.value', foreground: 'a5d6ff' },
        ],
        colors: {
          'editor.background': '#0d1117',
          'editor.foreground': '#e6edf3',
          'editor.lineHighlightBackground': '#161b22',
          'editorCursor.foreground': '#79c0ff',
          'editor.selectionBackground': '#264f78',
          'editorLineNumber.foreground': '#30363d',
          'editorLineNumber.activeForeground': '#8b949e',
          'editorIndentGuide.background': '#21262d',
          'editorWhitespace.foreground': '#21262d',
          'scrollbarSlider.background': '#30363d88',
          'scrollbarSlider.hoverBackground': '#30363daa',
          'editorBracketMatch.background': '#3b434b',
          'editorBracketMatch.border': '#79c0ff',
        }
      });

      editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        theme: 'github-dark',
        fontSize: 14,
        fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
        fontLigatures: true,
        lineNumbers: 'on',
        wordWrap: 'on',
        minimap: { enabled: true, renderCharacters: false },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'expand',
        cursorSmoothCaretAnimation: 'on',
        formatOnPaste: true,
        tabSize: 2,
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        suggest: { preview: true },
        padding: { top: 12, bottom: 12 },
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        overviewRulerLanes: 0,
      });

      // Update status bar on cursor move
      editor.onDidChangeCursorPosition(e => {
        document.getElementById('sb-pos').textContent =
          'Ln ' + e.position.lineNumber + ', Col ' + e.position.column;
      });

      // Track modifications
      editor.onDidChangeModelContent(() => {
        if (!currentFile) return;
        const curr = editor.getValue();
        fileContents[currentFile + '_current'] = curr;
        const isModified = curr !== fileContents[currentFile];
        fileModified[currentFile] = isModified;
        updateTabState(currentFile);
        updateSidebarState(currentFile);
        updateSaveIndicator();
      });

      // Keyboard shortcuts
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveFile());
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => toggleSearch());
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => formatDoc());

      // Build UI
      buildTabs();
      buildSidebar();

      // Auto-open first file
      openFile(FILES[0]);

      // Resize observer
      const ro = new ResizeObserver(() => editor.layout());
      ro.observe(document.getElementById('monaco-editor'));
    });

    // ── FILE OPS ─────────────────────────────────────
    async function openFile(filename) {
      if (currentFile === filename) return;
      currentFile = filename;

      // Load from server if not cached
      if (!fileContents[filename]) {
        try {
          const r = await fetch('/api/read?file=' + encodeURIComponent(filename));
          const data = await r.json();
          if (data.error) { showToast('Error: ' + data.error, 'error'); return; }
          fileContents[filename] = data.content;
          fileContents[filename + '_current'] = data.content;
        } catch(e) {
          showToast('Failed to load file', 'error');
          return;
        }
      }

      const ext = filename.split('.').pop();
      const langMap = { html: 'html', js: 'javascript', css: 'css', md: 'markdown', json: 'json' };
      const lang = langMap[ext] || 'plaintext';
      const curr = fileContents[filename + '_current'] || fileContents[filename];

      const model = monaco.editor.createModel(curr, lang);
      editor.setModel(model);

      document.getElementById('sb-file').textContent = filename;
      document.getElementById('sb-lang').textContent = lang.toUpperCase();
      document.getElementById('sb-lines').textContent = model.getLineCount() + ' lines';

      updateAllTabs();
      updateAllSidebar();
      updateSaveIndicator();
    }

    async function saveFile() {
      if (!currentFile) return;
      const content = editor.getValue();
      const btn = document.getElementById('saveBtn');
      const ind = document.getElementById('saveIndicator');

      btn.textContent = '⏳ Saving...';
      ind.textContent = '⏳ Saving...';
      ind.className = 'save-indicator saving';

      try {
        const r = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: currentFile, content })
        });
        const data = await r.json();
        if (data.ok) {
          fileContents[currentFile] = content;
          fileModified[currentFile] = false;
          updateTabState(currentFile);
          updateSidebarState(currentFile);
          showToast('✅ ' + currentFile + ' saved!', 'success');
        } else {
          showToast('Save failed: ' + data.error, 'error');
        }
      } catch(e) {
        showToast('Save failed!', 'error');
      }

      btn.innerHTML = '💾 Save';
      updateSaveIndicator();
    }

    // ── TABS ─────────────────────────────────────────
    const fileIcons = { html: '🌐', js: '⚡', css: '🎨', md: '📝', json: '{}' };

    function buildTabs() {
      const bar = document.getElementById('tabsBar');
      bar.innerHTML = '';
      FILES.forEach(f => {
        const ext = f.split('.').pop();
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.id = 'tab-' + f.replace('.', '_');
        tab.innerHTML = \`<span class="file-icon">\${fileIcons[ext] || '📄'}</span>\${f}<span class="tab-dot"></span>\`;
        tab.onclick = () => openFile(f);
        bar.appendChild(tab);
      });
    }

    function updateTabState(file) {
      const tab = document.getElementById('tab-' + file.replace('.', '_'));
      if (!tab) return;
      tab.classList.toggle('modified', !!fileModified[file]);
      tab.classList.toggle('active', file === currentFile);
    }

    function updateAllTabs() {
      FILES.forEach(f => updateTabState(f));
    }

    // ── SIDEBAR ──────────────────────────────────────
    function buildSidebar() {
      const tree = document.getElementById('fileTree');
      tree.innerHTML = '';
      FILES.forEach(f => {
        const ext = f.split('.').pop();
        const item = document.createElement('div');
        item.className = 'file-item';
        item.id = 'sidebar-' + f.replace('.', '_');
        item.innerHTML = \`<span>\${fileIcons[ext] || '📄'}</span>\${f}\`;
        item.onclick = () => openFile(f);
        tree.appendChild(item);
      });
    }

    function updateSidebarState(file) {
      const item = document.getElementById('sidebar-' + file.replace('.', '_'));
      if (!item) return;
      item.classList.toggle('modified', !!fileModified[file]);
      item.classList.toggle('active', file === currentFile);
    }

    function updateAllSidebar() {
      FILES.forEach(f => updateSidebarState(f));
    }

    // ── SAVE INDICATOR ────────────────────────────────
    function updateSaveIndicator() {
      const ind = document.getElementById('saveIndicator');
      const anyModified = FILES.some(f => fileModified[f]);
      if (anyModified) {
        ind.textContent = '● Unsaved Changes';
        ind.className = 'save-indicator unsaved';
      } else {
        ind.textContent = '● All Saved';
        ind.className = 'save-indicator';
      }
    }

    // ── FORMAT ───────────────────────────────────────
    function formatDoc() {
      editor.getAction('editor.action.formatDocument').run();
      showToast('✨ Document formatted!', 'info');
    }

    function undoEdit() { editor.trigger('keyboard', 'undo', null); }
    function redoEdit() { editor.trigger('keyboard', 'redo', null); }

    // ── PREVIEW ──────────────────────────────────────
    function openPreview() {
      window.open('/preview?file=' + encodeURIComponent(currentFile || 'index.html'), '_blank');
    }

    // ── FIND ─────────────────────────────────────────
    function toggleSearch() {
      const bar = document.getElementById('searchBar');
      const input = document.getElementById('searchInput');
      bar.classList.toggle('open');
      if (bar.classList.contains('open')) {
        setTimeout(() => input.focus(), 50);
      }
    }

    document.getElementById('searchInput').addEventListener('input', e => {
      const val = e.target.value;
      if (!val || !editor) { document.getElementById('searchCount').textContent = ''; return; }
      const model = editor.getModel();
      const matches = model.findMatches(val, false, false, false, null, false);
      document.getElementById('searchCount').textContent = matches.length + ' results';
      if (matches.length > 0) {
        editor.revealLineInCenter(matches[0].range.startLineNumber);
        const newDecorations = matches.map(m => ({
          range: m.range,
          options: { inlineClassName: 'findMatch', isWholeLine: false }
        }));
      }
    });

    document.getElementById('searchInput').addEventListener('keydown', e => {
      if (e.key === 'Escape') toggleSearch();
    });

    // ── TOAST ────────────────────────────────────────
    let toastTimer;
    function showToast(msg, type = 'info') {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast ' + type + ' show';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
    }
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ── API: Read File ──
  if (pathname === '/api/read') {
    const file = parsed.query.file;
    if (!EDITABLE_FILES.includes(file)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not allowed' }));
      return;
    }
    const filePath = path.join(PROJECT_ROOT, file);
    fs.readFile(filePath, 'utf8', (err, data) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      if (err) res.end(JSON.stringify({ error: err.message }));
      else res.end(JSON.stringify({ content: data }));
    });
    return;
  }

  // ── API: Save File ──
  if (pathname === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { file, content } = JSON.parse(body);
        if (!EDITABLE_FILES.includes(file)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'File not allowed' }));
          return;
        }
        const filePath = path.join(PROJECT_ROOT, file);
        fs.writeFile(filePath, content, 'utf8', (err) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          if (err) res.end(JSON.stringify({ ok: false, error: err.message }));
          else {
            console.log('[Saved] ' + file);
            res.end(JSON.stringify({ ok: true }));
          }
        });
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // ── Preview ──
  if (pathname === '/preview') {
    const file = parsed.query.file || 'index.html';
    const safe = EDITABLE_FILES.includes(file) || file === 'index.html' ? file : 'index.html';
    const filePath = path.join(PROJECT_ROOT, safe);
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // ── Serve project static files (for preview) ──
  if (pathname !== '/' && !pathname.startsWith('/api')) {
    const filePath = path.join(PROJECT_ROOT, pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': getContentType(ext) });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // ── Serve Editor UI ──
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(editorHTML.replace('${JSON.stringify(EDITABLE_FILES)}', JSON.stringify(EDITABLE_FILES)));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ✏️  Portfolio Editor is running!');
  console.log('  ────────────────────────────────');
  console.log('  🌐 Editor:  http://127.0.0.1:' + PORT);
  console.log('  👁️  Preview: http://127.0.0.1:' + PORT + '/preview?file=index.html');
  console.log('  ────────────────────────────────');
  console.log('  Press Ctrl+C to stop');
  console.log('');
});
