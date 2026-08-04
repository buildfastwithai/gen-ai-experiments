import { useState, useMemo } from 'react';
import { AlertCircle, BrainCircuit, File, RefreshCw, ChevronDown, FolderOpen, ShieldAlert, Sparkles } from 'lucide-react';
import { runFullAudit, SEVERITY_COLORS, CATEGORY_LABELS } from './scanners/index.js';
import Header from './components/Header.jsx';
import CodeInput from './components/CodeInput.jsx';
import ScoreCard from './components/ScoreCard.jsx';
import FindingsList from './components/FindingsList.jsx';
import CategoryChart from './components/CategoryChart.jsx';
import AIConfigModal from './components/AIConfigModal.jsx';

const SAMPLE_FILES = {
  'server.js': `const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = express();

const API_KEY = "sk-live-8a7b2c3d4e5f6g7h8i9j0k1l2m3n4o5p";
const JWT_SECRET = "my-super-secret-key-12345";
const DB_URL = "postgres://admin:p@ssw0rd123@localhost:5432/mydb";

app.use(require('cors')());

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
  const user = await db.query(query);
  
  const hash = crypto.createHash('md5').update(password).digest('hex');
  const token = jwt.sign({ id: user.id }, JWT_SECRET);
  
  res.cookie('token', token);
  document.getElementById('output').innerHTML = '<p>Welcome ' + username + '</p>';
  res.json({ token });
});

app.get('/admin', (req, res) => {
  const token = req.cookies.token;
  const decoded = jwt.verify(token, JWT_SECRET);
  res.json({ secret: 'admin data' });
});

app.get('/export', (req, res) => {
  const file = req.query.file;
  const data = fs.readFileSync('/var/data/' + file);
  res.send(data);
});`,
  'crypto-utils.js': `const crypto = require('crypto');

const encryptionKey = "abcdef1234567890";
const cipher = crypto.createCipheriv('aes-256-ecb', encryptionKey, '');

function hashPassword(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

function generateToken() {
  const token = Math.random().toString(36).substring(7);
  return token;
}

process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";`,
  'config.yml': `database:
  url: postgres://admin:password123@localhost:5432/app
  password: mysecretpassword

api:
  key: "sk-live-abc123def456ghi789"
  secret: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx1234"

jwt:
  secret: "super-secret-jwt-key-do-not-share"
  expiresIn: 7d`,
};

function normaliseAiReview(raw, files, elapsedMs) {
  const sourceFiles = Object.keys(files);
  const findings = Array.isArray(raw?.findings) ? raw.findings : [];
  const safeFindings = findings.map((finding, index) => {
    const severity = ['critical', 'high', 'medium'].includes(String(finding?.severity).toLowerCase())
      ? String(finding.severity).toLowerCase()
      : 'medium';
    const requestedFile = String(finding?.file || '');
    const file = sourceFiles.find((name) => name === requestedFile)
      || sourceFiles.find((name) => name.endsWith(requestedFile))
      || sourceFiles[0]
      || 'workspace';
    return {
      type: String(finding?.type || 'Contextual security finding'),
      category: 'ai-review',
      categoryKey: 'ai-review',
      pattern: String(finding?.category || 'AI Deep Review'),
      severity,
      file,
      line: Number.isFinite(Number(finding?.line)) ? Math.max(1, Number(finding.line)) : 1,
      column: 1,
      snippet: String(finding?.evidence || ''),
      match: 'AI Deep Review',
      message: String(finding?.message || 'The AI reviewer identified a contextual security concern.'),
      fix: String(finding?.fix || 'Review the affected control and apply the provider recommendation.'),
      id: `ai-${index}`,
    };
  });

  const critical = safeFindings.filter((item) => item.severity === 'critical').length;
  const high = safeFindings.filter((item) => item.severity === 'high').length;
  const medium = safeFindings.filter((item) => item.severity === 'medium').length;
  const proposedScore = Number(raw?.summary?.securityScore);
  const score = Number.isFinite(proposedScore)
    ? Math.max(0, Math.min(100, Math.round(proposedScore)))
    : Math.max(0, 100 - critical * 25 - high * 10 - medium * 3);
  const fileResults = Object.fromEntries(sourceFiles.map((name) => [name, { findings: { 'ai-review': safeFindings.filter((finding) => finding.file === name) } }]));

  return {
    summary: {
      critical,
      high,
      medium,
      totalFindings: safeFindings.length,
      linesScanned: Object.values(files).reduce((total, content) => total + content.split('\n').length, 0),
      filesScanned: sourceFiles.length,
      scanTimeMs: elapsedMs,
      score,
      categories: { 'ai-review': safeFindings.length },
      overview: String(raw?.summary?.overview || 'AI review completed.'),
      riskLevel: String(raw?.summary?.riskLevel || 'medium'),
    },
    findings: { 'ai-review': safeFindings },
    fileResults,
  };
}

export default function App() {
  const [files, setFiles] = useState(SAMPLE_FILES);
  const [auditResult, setAuditResult] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedFile, setSelectedFile] = useState('__all__');
  const [reviewMode, setReviewMode] = useState('local');
  const [aiConfig, setAiConfig] = useState(null);
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [aiError, setAiError] = useState('');
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState('');
  const [repository, setRepository] = useState(null);
  const [localError, setLocalError] = useState('');

  const fileNames = Object.keys(files);
  const totalLines = Object.values(files).reduce((acc, c) => acc + c.split('\n').length, 0);

  const handleScan = async (sourceFiles) => {
    // React passes a MouseEvent to an onClick handler. Ignore it and use the
    // current workspace unless a real imported file map was supplied.
    const workspaceFiles = sourceFiles && typeof sourceFiles === 'object' && !('nativeEvent' in sourceFiles)
      ? sourceFiles
      : files;
    const fileEntries = Object.entries(workspaceFiles);
    if (fileEntries.length === 0) return;
    setScanning(true);
    setLocalError('');
    await new Promise((resolve) => setTimeout(resolve, 80));
    try {
      const allFileResults = {};
      let totalCounts = { critical: 0, high: 0, medium: 0, totalFindings: 0, linesScanned: 0 };
      const allFindingsByCategory = { secrets: [], xss: [], injection: [], crypto: [], auth: [] };

      for (const [filename, content] of fileEntries) {
        const result = runFullAudit(content);
        allFileResults[filename] = result;
        totalCounts.critical += result.summary.critical;
        totalCounts.high += result.summary.high;
        totalCounts.medium += result.summary.medium;
        totalCounts.totalFindings += result.summary.totalFindings;
        totalCounts.linesScanned += result.summary.linesScanned;
        for (const [cat, findings] of Object.entries(result.findings)) {
          allFindingsByCategory[cat].push(
            ...findings.map(f => ({ ...f, file: filename }))
          );
        }
      }

      const score = totalCounts.totalFindings === 0 ? 100 :
        Math.max(0, Math.min(100, Math.round(
          100 - (totalCounts.critical * 25) - (totalCounts.high * 10) - (totalCounts.medium * 3)
        )));

      setAuditResult({
        fileResults: allFileResults,
        summary: {
          ...totalCounts,
          score,
          filesScanned: fileEntries.length,
          scanTimeMs: 0,
          categories: {
            secrets: allFindingsByCategory.secrets.length,
            xss: allFindingsByCategory.xss.length,
            injection: allFindingsByCategory.injection.length,
            crypto: allFindingsByCategory.crypto.length,
            auth: allFindingsByCategory.auth.length,
          },
        },
        findings: allFindingsByCategory,
      });
      setReviewMode('local');
    } catch (error) {
      setLocalError(error?.message || 'Local Security Scan could not complete.');
    } finally {
      setScanning(false);
    }
  };

  const handleImportGithub = async (url) => {
    if (!window.electronAPI?.importGitHubRepository) {
      setGithubError('GitHub import is available in the AuditMyCode desktop app only.');
      return;
    }
    setGithubLoading(true);
    setGithubError('');
    try {
      const imported = await window.electronAPI.importGitHubRepository(url);
      setFiles(imported.files);
      setRepository(imported.repository);
      setAuditResult(null);
      setAiResult(null);
      setReviewMode('local');
      setSelectedFile('__all__');
      await handleScan(imported.files);
    } catch (error) {
      setGithubError(error?.message || 'GitHub repository could not be imported.');
    } finally {
      setGithubLoading(false);
    }
  };

  const handleDeepReview = async () => {
    if (!aiConfig?.apiKey) {
      setShowAiConfig(true);
      return;
    }
    if (!window.electronAPI?.requestAiReview) {
      setAiError('AI Deep Review is available in the AuditMyCode desktop app only.');
      return;
    }
    if (fileNames.length === 0) return;

    setAiScanning(true);
    setAiError('');
    const startedAt = performance.now();
    try {
      const response = await window.electronAPI.requestAiReview({
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey,
        files: Object.entries(files).map(([name, content]) => ({ name, content })),
      });
      setAiResult(normaliseAiReview(response, files, Math.round(performance.now() - startedAt)));
      setReviewMode('ai');
      setActiveFilter('all');
      setSelectedFile('__all__');
    } catch (error) {
      setAiError(error?.message || 'AI Deep Review could not be completed.');
    } finally {
      setAiScanning(false);
    }
  };

  const handleReset = () => {
    setAuditResult(null);
    setAiResult(null);
    setActiveFilter('all');
    setSelectedFile('__all__');
    setReviewMode('local');
    setAiError('');
    setLocalError('');
  };

  const displayedResult = reviewMode === 'ai' ? aiResult : auditResult;

  const allFindings = useMemo(() => {
    if (!displayedResult) return [];
    return Object.entries(displayedResult.findings)
      .flatMap(([category, findings]) =>
        findings.map(f => ({ ...f, categoryKey: category }))
      )
      .sort((a, b) => {
        const sev = { critical: 0, high: 1, medium: 2 };
        return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3);
      });
  }, [displayedResult]);

  const filteredFindings = useMemo(() => {
    let list = allFindings;
    if (selectedFile !== '__all__') {
      list = list.filter(f => f.file === selectedFile);
    }
    if (activeFilter !== 'all') {
      list = list.filter(f => f.severity === activeFilter);
    }
    return list;
  }, [allFindings, selectedFile, activeFilter]);

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header onConfigureAI={() => setShowAiConfig(true)} aiConfigured={Boolean(aiConfig?.apiKey)} />
      <AIConfigModal open={showAiConfig} config={aiConfig} onClose={() => setShowAiConfig(false)} onSave={setAiConfig} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {aiError && !displayedResult && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <div><span className="font-semibold">AI Deep Review failed.</span> {aiError}</div>
          </div>
        )}
        {localError && !displayedResult && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <div><span className="font-semibold">Local Security Scan failed.</span> {localError}</div>
          </div>
        )}
        {!displayedResult ? (
          <CodeInput
            files={files}
            setFiles={setFiles}
            onScan={handleScan}
            scanning={scanning}
            onDeepReview={handleDeepReview}
            aiConfigured={Boolean(aiConfig?.apiKey)}
            onConfigureAI={() => setShowAiConfig(true)}
            aiScanning={aiScanning}
            onImportGithub={handleImportGithub}
            githubLoading={githubLoading}
            githubError={githubError}
            repository={repository}
          />
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            {aiError && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <div><span className="font-semibold">AI Deep Review failed.</span> {aiError}</div>
              </div>
            )}
            {localError && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <div><span className="font-semibold">Local Security Scan failed.</span> {localError}</div>
              </div>
            )}
            {/* Results Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleScan()}
                  disabled={scanning}
                  className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl border border-zinc-700 transition-all font-medium text-sm disabled:opacity-50"
                >
                  <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
                  Re-run local scan
                </button>
                <button
                  onClick={handleDeepReview}
                  disabled={aiScanning || scanning}
                  className="flex items-center gap-2 px-4 py-2.5 bg-violet-400/[0.08] hover:bg-violet-400/[0.15] text-violet-200 rounded-xl border border-violet-400/25 transition-all font-medium text-sm disabled:opacity-50"
                >
                  <Sparkles size={16} className={aiScanning ? 'animate-pulse' : ''} />
                  {aiConfig?.apiKey ? 'AI Deep Review' : 'Configure AI'}
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl border border-zinc-800 transition-all font-medium text-sm"
                >
                  <FolderOpen size={16} />
                  New Scan
                </button>
                {repository && <span className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 text-xs text-emerald-300"><FolderOpen size={13} />{repository.fullName} · {repository.branch}</span>}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {['all', 'critical', 'high', 'medium'].map(sev => (
                  <button
                    key={sev}
                    onClick={() => setActiveFilter(sev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
                      activeFilter === sev
                        ? sev === 'all' ? 'bg-zinc-700 text-white' : `${SEVERITY_COLORS[sev]?.badge || ''} ring-1 ${SEVERITY_COLORS[sev]?.ring || ''}`
                        : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {sev === 'all' ? `All (${allFindings.length})` : `${sev} (${allFindings.filter(f => f.severity === sev).length})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5 w-fit">
              <button onClick={() => { if (auditResult) setReviewMode('local'); }} disabled={!auditResult} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${reviewMode === 'local' ? 'bg-white/[0.09] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}><ShieldAlert size={14} />Local Security Scan</button>
              <button onClick={() => { if (aiResult) setReviewMode('ai'); else handleDeepReview(); }} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${reviewMode === 'ai' ? 'bg-violet-400/[0.14] text-violet-200' : 'text-zinc-500 hover:text-zinc-300'}`}><BrainCircuit size={14} />AI Deep Review</button>
            </div>

            {reviewMode === 'ai' && displayedResult.summary.overview && (
              <div className="flex items-start gap-3 rounded-xl border border-violet-400/15 bg-violet-400/[0.05] p-4">
                <Sparkles size={17} className="mt-0.5 text-violet-300" />
                <div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">{aiConfig?.provider || 'AI'} Deep Review</div><p className="mt-1 text-sm leading-6 text-zinc-400">{displayedResult.summary.overview}</p></div>
              </div>
            )}

            {/* Score Card */}
            <ScoreCard summary={displayedResult.summary} />

            {/* File Selector */}
            {fileNames.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedFile('__all__')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    selectedFile === '__all__'
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800'
                  }`}
                >
                  <FolderOpen size={12} />
                  All files ({allFindings.length})
                </button>
                {Object.entries(displayedResult.fileResults).map(([name, result]) => {
                  const count = Object.values(result.findings).reduce((a, b) => a + b.length, 0);
                  return (
                    <button
                      key={name}
                      onClick={() => setSelectedFile(name)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                        selectedFile === name
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800'
                      }`}
                    >
                      <File size={12} />
                      <span className="max-w-[120px] truncate">{name}</span>
                      <span className={`text-[10px] ${count > 0 ? 'text-rose-400' : 'text-zinc-600'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Charts + Findings Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <FindingsList findings={filteredFindings} />
              </div>
              <div>
                <CategoryChart summary={displayedResult.summary} findings={displayedResult.findings} />
              </div>
            </div>

            {/* Code Preview (collapsed) */}
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-zinc-500 hover:text-zinc-300 transition-colors">
                <ChevronDown size={16} className="group-open:rotate-180 transition-transform" />
                <span className="text-sm font-medium">View scanned code</span>
                <span className="text-xs text-zinc-600">({fileNames.length} files, {totalLines.toLocaleString()} lines)</span>
              </summary>
              <div className="mt-3 space-y-3">
                {Object.entries(files).map(([name, content]) => (
                  <div key={name} className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                      <File size={12} className="text-zinc-500" />
                      <span className="text-xs font-medium text-zinc-400">{name}</span>
                      <span className="text-[10px] text-zinc-600">{content.split('\n').length} lines</span>
                    </div>
                    <pre className="p-4 overflow-x-auto">
                      <code className="text-xs text-zinc-400 font-mono">{content}</code>
                    </pre>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-900 py-6 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-zinc-600">
          AuditMyCode analyzes your workspace locally. Source code never leaves this device.
        </div>
      </footer>
    </div>
  );
}
