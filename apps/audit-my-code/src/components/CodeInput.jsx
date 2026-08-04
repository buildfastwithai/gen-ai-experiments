import { useEffect, useState } from 'react';
import {
  Braces, ChevronRight, FileCode2, FilePlus2, Files,
  FolderOpen, FolderTree, Github, Link2, Loader2, LockKeyhole, ScanSearch, ShieldAlert, Sparkles,
  Upload, X, Zap,
} from 'lucide-react';

const SCAN_EXTENSIONS = [
  'js', 'ts', 'jsx', 'tsx', 'cjs', 'mjs', 'py', 'go', 'java', 'rb', 'php',
  'env', 'yaml', 'yml', 'json', 'html', 'css', 'xml', 'sql', 'sh', 'bash',
  'config', 'rc', 'cfg', 'ini', 'toml', 'dockerfile', 'txt', 'md', 'vue', 'svelte',
];

const SKIP_DIRS = [
  'node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage',
  'vendor', '__pycache__', '.tox', '.venv', 'venv', 'target', '.idea', '.vscode',
];

function fileKind(name) {
  const extension = name.split('.').pop()?.toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'cjs', 'mjs'].includes(extension)) return 'JS';
  if (['yaml', 'yml', 'json', 'toml', 'env'].includes(extension)) return 'CFG';
  if (extension === 'py') return 'PY';
  return extension?.toUpperCase().slice(0, 3) || 'FILE';
}

export default function CodeInput({ files, setFiles, onScan, scanning, onDeepReview, aiConfigured, onConfigureAI, aiScanning, onImportGithub, githubLoading, githubError, repository }) {
  const [activeFile, setActiveFile] = useState(Object.keys(files)[0] || null);
  const [dragActive, setDragActive] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const fileNames = Object.keys(files);
  const totalLines = Object.values(files).reduce((total, content) => total + content.split('\n').length, 0);
  const isEmpty = fileNames.length === 0;
  const activeContent = activeFile && files[activeFile] !== undefined ? files[activeFile] : '';

  useEffect(() => {
    if (activeFile && files[activeFile] !== undefined) return;
    setActiveFile(fileNames[0] || null);
  }, [activeFile, files, fileNames]);

  const addFile = (file, displayPath = file.name) => {
    if (file.size > 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setFiles((previous) => ({ ...previous, [displayPath]: event.target.result }));
      setActiveFile(displayPath);
    };
    reader.readAsText(file);
  };

  const addSingleFile = (event) => {
    for (const file of event.target.files || []) addFile(file);
    event.target.value = '';
  };

  const addFolder = (event) => {
    for (const file of event.target.files || []) {
      const parts = (file.webkitRelativePath || file.name).split('/');
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      if (parts.some((part) => SKIP_DIRS.includes(part))) continue;
      if (!SCAN_EXTENSIONS.includes(extension) && file.name !== 'Dockerfile') continue;
      addFile(file, parts.length > 1 ? parts.slice(-3).join('/') : file.name);
    }
    event.target.value = '';
  };

  const readEntry = (entry, parentPath = '') => {
    if (entry.isFile) {
      entry.file((file) => {
        const fullPath = parentPath + file.name;
        const parts = fullPath.split('/');
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        if (parts.some((part) => SKIP_DIRS.includes(part))) return;
        if (!SCAN_EXTENSIONS.includes(extension) && file.name !== 'Dockerfile') return;
        addFile(file, parts.length > 1 ? parts.slice(-3).join('/') : file.name);
      });
      return;
    }

    if (entry.isDirectory) {
      const reader = entry.createReader();
      const readBatch = () => {
        reader.readEntries((entries) => {
          if (!entries.length) return;
          entries.forEach((child) => readEntry(child, `${parentPath}${entry.name}/`));
          readBatch();
        });
      };
      readBatch();
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    for (const item of event.dataTransfer?.items || []) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) readEntry(entry);
    }
  };

  const removeFile = (name) => {
    setFiles((previous) => {
      const next = { ...previous };
      delete next[name];
      return next;
    });
  };

  const updateActiveFile = (content) => {
    if (!activeFile) return;
    setFiles((previous) => ({ ...previous, [activeFile]: content }));
  };

  const createSnippet = () => {
    const name = `snippet-${fileNames.length + 1}.js`;
    setFiles((previous) => ({ ...previous, [name]: '' }));
    setActiveFile(name);
  };

  const importGithub = () => {
    if (!githubUrl.trim() || githubLoading) return;
    onImportGithub(githubUrl.trim());
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section className="workspace-frame overflow-hidden">
        <div className="workspace-topbar">
          <div className="flex items-center gap-3 min-w-0">
            <div className="workspace-mark"><ScanSearch size={17} /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold tracking-[-0.02em] text-zinc-100">Audit workspace</h2>
                <span className="hidden sm:inline-flex rounded-md border border-violet-400/15 bg-violet-400/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-violet-300">Local</span>
                {repository && <span className="hidden xl:inline-flex items-center gap-1.5 rounded-md border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-1 text-[10px] font-medium text-emerald-300"><Github size={11} />{repository.fullName}</span>}
              </div>
              <p className="text-xs text-zinc-500 truncate">Import a repository, review the surface area, then run the audit.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <label className="secondary-action">
              <Upload size={14} />
              <span>Files</span>
              <input type="file" multiple onChange={addSingleFile} className="hidden" accept=".js,.ts,.jsx,.tsx,.cjs,.mjs,.py,.go,.java,.rb,.php,.env,.yaml,.yml,.json,.html,.css,.xml,.sql,.sh,.config,.toml,.vue,.svelte" />
            </label>
            <label className="secondary-action secondary-action--accent">
              <FolderOpen size={14} />
              <span>Import folder</span>
              <input type="file" webkitdirectory="" directory="" onChange={addFolder} className="hidden" />
            </label>
            <button onClick={() => setShowGitHub((value) => !value)} className={`secondary-action ${showGitHub ? 'secondary-action--accent' : ''}`}>
              <Github size={14} />
              <span>GitHub URL</span>
            </button>
          </div>
        </div>

        {showGitHub && (
          <div className="mx-5 mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center rounded-lg border border-white/[0.09] bg-[#0b0b0e] px-3 focus-within:border-violet-400/45">
                <Link2 size={15} className="mr-2 shrink-0 text-zinc-600" />
                <input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') importGithub(); }} placeholder="https://github.com/owner/repository" className="w-full bg-transparent py-2.5 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-700" />
              </div>
              <button onClick={importGithub} disabled={!githubUrl.trim() || githubLoading} className="secondary-action secondary-action--accent justify-center disabled:cursor-not-allowed disabled:opacity-40">
                {githubLoading ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />}
                {githubLoading ? 'Importing…' : 'Import public repo'}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-zinc-600">Downloads one GitHub source archive and scans every eligible source/config file locally. Large archives over 75MB are blocked instead of partially scanned.</p>
            {githubError && <p className="mt-2 text-xs text-rose-300">{githubError}</p>}
          </div>
        )}

        {isEmpty ? (
          <div
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            className={`m-5 rounded-2xl border border-dashed p-12 text-center transition-all ${dragActive ? 'border-rose-400/60 bg-rose-400/[0.06]' : 'border-white/[0.10] bg-black/20 hover:border-violet-400/35 hover:bg-violet-400/[0.035]'}`}
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.09] bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-2xl">
              <FolderTree size={25} className="text-violet-300" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Drop a project folder to begin</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">AuditMyCode reads supported source and configuration files locally. Dependencies, build output, and Git metadata are automatically ignored.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button onClick={createSnippet} className="secondary-action"><FilePlus2 size={14} />Paste a snippet instead</button>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-zinc-500"><LockKeyhole size={13} className="text-emerald-400" />Never uploaded</span>
            </div>
          </div>
        ) : (
          <div className="m-5 grid min-h-[430px] grid-cols-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0b0e] lg:grid-cols-[230px_minmax(0,1fr)]">
            <aside className="border-b border-white/[0.07] bg-[#101014] lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500"><FolderTree size={13} />Workspace</span>
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">{fileNames.length}</span>
              </div>
              <div className="max-h-[190px] overflow-y-auto p-2 lg:max-h-[380px]">
                {fileNames.map((name) => {
                  const isActive = activeFile === name;
                  const lineCount = files[name].split('\n').length;
                  return (
                    <button
                      key={name}
                      onClick={() => setActiveFile(name)}
                      className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all ${isActive ? 'bg-violet-400/[0.11] text-zinc-100 shadow-[inset_2px_0_0_#a78bfa]' : 'text-zinc-500 hover:bg-white/[0.045] hover:text-zinc-300'}`}
                    >
                      <FileCode2 size={14} className={isActive ? 'text-violet-300' : 'text-zinc-600'} />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{name}</span>
                      <span className="text-[9px] font-mono text-zinc-600">{lineCount}</span>
                      <span onClick={(event) => { event.stopPropagation(); removeFile(name); }} className="hidden cursor-pointer rounded p-0.5 text-zinc-600 hover:bg-rose-400/10 hover:text-rose-300 group-hover:inline-flex"><X size={12} /></span>
                    </button>
                  );
                })}
              </div>
              <button onClick={createSnippet} className="m-2 flex w-[calc(100%-16px)] items-center gap-2 rounded-lg border border-dashed border-white/[0.10] px-3 py-2 text-xs text-zinc-500 transition-colors hover:border-violet-400/30 hover:text-violet-200"><FilePlus2 size={13} />Add a snippet</button>
            </aside>

            <div className="min-w-0 flex flex-col">
              <div className="flex h-12 items-center justify-between border-b border-white/[0.07] bg-[#0d0d10] px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Braces size={14} className="text-violet-300" />
                  <span className="truncate text-xs font-semibold text-zinc-300">{activeFile}</span>
                  <span className="rounded-md border border-white/[0.07] bg-white/[0.035] px-1.5 py-0.5 text-[9px] font-bold text-zinc-500">{fileKind(activeFile || '')}</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-600">{activeContent.split('\n').length} lines</span>
              </div>
              <div className="editor-shell flex-1">
                <div className="editor-gutter" aria-hidden="true">
                  {activeContent.split('\n').slice(0, 38).map((_, index) => <span key={index}>{index + 1}</span>)}
                </div>
                <textarea
                  value={activeContent}
                  onChange={(event) => updateActiveFile(event.target.value)}
                  spellCheck={false}
                  className="premium-editor"
                  placeholder="Paste source code here, or import a project folder."
                />
              </div>
            </div>
          </div>
        )}

        <div className="scan-footer">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5"><Files size={13} className="text-zinc-600" />{fileNames.length} file{fileNames.length === 1 ? '' : 's'}</span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span>{totalLines.toLocaleString()} lines in scope</span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span className="flex items-center gap-1.5"><LockKeyhole size={12} className="text-emerald-400" />On-device analysis</span>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button onClick={() => onScan()} disabled={isEmpty || scanning || aiScanning} className="scan-action">
              {scanning ? <><Zap size={17} className="animate-pulse" />Scanning locally…</> : <><ShieldAlert size={17} />Local Security Scan</>}
            </button>
            <button onClick={aiConfigured ? onDeepReview : onConfigureAI} disabled={isEmpty || scanning || aiScanning} className="ai-review-action">
              {aiScanning ? <><Zap size={16} className="animate-pulse" />Reviewing with AI…</> : <><Sparkles size={16} />{aiConfigured ? 'AI Deep Review' : 'Configure AI'}</>}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { title: 'Secrets', copy: 'Tokens, keys, credentials', accent: 'bg-rose-400', icon: '01' },
          { title: 'Injection', copy: 'SQL, command, path traversal', accent: 'bg-orange-400', icon: '02' },
          { title: 'Script safety', copy: 'XSS sinks and unsafe DOM APIs', accent: 'bg-amber-300', icon: '03' },
          { title: 'Cryptography', copy: 'Weak hashes, keys, encryption', accent: 'bg-cyan-300', icon: '04' },
          { title: 'Authentication', copy: 'JWT, CORS, session hygiene', accent: 'bg-violet-300', icon: '05' },
        ].map((item) => (
          <div key={item.title} className="coverage-card">
            <div className="flex items-start justify-between">
              <span className={`h-1.5 w-1.5 rounded-full ${item.accent} shadow-[0_0_10px_currentColor]`} />
              <span className="font-mono text-[10px] text-zinc-700">{item.icon}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
