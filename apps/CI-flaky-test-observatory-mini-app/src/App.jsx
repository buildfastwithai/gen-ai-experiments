import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './App.css';

const emptyReport = null;

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function duration(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function App() {
  const [repository, setRepository] = useState('');
  const [token, setToken] = useState('');
  const [days, setDays] = useState('30');
  const [report, setReport] = useState(emptyReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function analyze(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      setReport(await invoke('analyze_repository', {
        repository,
        token,
        days: Number(days),
      }));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function exportReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${report.repository.replace('/', '-')}-ci-report.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <div className="ambient">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="grid-floor" />
      </div>
      <div className="scanlines" />
      <div className="noise" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><span className="radar" /></div>
          <div>
            <strong>CI Flaky Observatory</strong>
            <span>Reliability intelligence for GitHub Actions</span>
          </div>
        </div>
        <div className="privacy-pill"><i />LOCAL SESSION</div>
      </header>

      <section className="hero">
        <div className="eyebrow">CONTINUOUS INTEGRATION / HEALTH</div>
        <h1>
          Find the tests your pipeline
          <br />
          <span className="glitch" data-text="keeps getting wrong.">keeps getting wrong.</span>
        </h1>
        <p>Connect a repository and turn months of GitHub Actions history into a clear reliability map.</p>
      </section>

      {!report && (
        <form className="connect-card" onSubmit={analyze}>
          <div className="card-heading">
            <div>
              <span className="section-kicker">01 / CONNECT A REPOSITORY</span>
              <h2>Bring your CI history</h2>
            </div>
            <span className="github-glyph" aria-hidden>◉</span>
          </div>
          <div className="form-grid">
            <label>
              <span>Repository URL</span>
              <input
                value={repository}
                onChange={(e) => setRepository(e.target.value)}
                placeholder="https://github.com/acme/checkout"
              />
            </label>
            <label>
              <span>
                GitHub token <span className="label-note">Actions · Read-only</span>
              </span>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type="password"
                placeholder="ghp_••••••••••••"
              />
            </label>
            <label>
              <span>Lookback window</span>
              <select value={days} onChange={(e) => setDays(e.target.value)}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="180">Last 6 months</option>
              </select>
            </label>
          </div>
          <div className="connect-footer">
            <span className="safe-note">Token is held in memory only · Never committed · Read-only API access</span>
            <button className="primary" disabled={loading || !repository || !token}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Analyzing history…
                </>
              ) : (
                'Observe pipeline →'
              )}
            </button>
          </div>
          {error && <div className="error-box">{error}</div>}
        </form>
      )}

      {report && (
        <section className="dashboard">
          <div className="dashboard-head">
            <div>
              <div className="eyebrow">02 / OBSERVATORY REPORT</div>
              <h2>{report.repository}</h2>
              <p>
                {report.runs_analyzed} workflow runs · {report.jobs_analyzed} jobs · generated{' '}
                {new Date(report.generated_at).toLocaleString()}
              </p>
            </div>
            <div className="head-actions">
              <button onClick={() => setReport(null)} className="secondary">
                New repository
              </button>
              <button onClick={exportReport} className="primary">
                Export report ↓
              </button>
            </div>
          </div>

          <div className="metric-grid">
            <Metric
              label="CI reliability"
              value={percent(report.success_rate)}
              detail="successful workflow runs"
              tone={report.success_rate > 0.9 ? 'good' : 'warn'}
            />
            <Metric
              label="Failed runs"
              value={report.failed_runs}
              detail={`of ${report.runs_analyzed} analyzed`}
              tone={report.failed_runs ? 'bad' : 'good'}
            />
            <Metric label="Avg. run time" value={duration(report.avg_run_seconds)} detail="end-to-end average" tone="neutral" />
            <Metric
              label="Flaky signals"
              value={report.flaky_jobs.length}
              detail="jobs need attention"
              tone={report.flaky_jobs.length ? 'warn' : 'good'}
            />
          </div>

          <div className="content-grid">
            <section className="panel">
              <PanelTitle eyebrow="RELIABILITY HOTSPOTS" title="Jobs needing attention" />
              <div className="job-list">
                {report.flaky_jobs.length ? (
                  report.flaky_jobs.map((job) => <JobRow key={job.name} job={job} />)
                ) : (
                  <Empty text="No flaky jobs detected in this window." />
                )}
              </div>
            </section>
            <section className="panel">
              <PanelTitle eyebrow="SLOWEST SURFACE" title="Where time goes" />
              <div className="job-list">
                {report.slowest_jobs.slice(0, 5).map((job) => (
                  <JobRow key={job.name} job={job} durationOnly />
                ))}
              </div>
            </section>
          </div>

          <section className="panel branch-panel">
            <PanelTitle eyebrow="BRANCH SIGNAL" title="Failure frequency by branch" />
            <div className="bars">
              {report.branch_failures.slice(0, 8).map((item) => (
                <div className="bar-row" key={item.label}>
                  <div className="bar-label">
                    <span>{item.label}</span>
                    <b>{percent(item.failure_rate)}</b>
                  </div>
                  <div className="bar-track">
                    <div style={{ width: `${Math.max(item.failure_rate * 100, item.failures ? 4 : 0)}%` }} />
                  </div>
                  <small>
                    {item.failures} failures · {item.runs} runs
                  </small>
                </div>
              ))}
            </div>
          </section>

          <div className="method-note">
            <span>WHAT THIS MEANS</span>
            This MVP analyzes workflow and job history from GitHub Actions. Test-level flakiness becomes available when your workflows publish JUnit or compatible test reports.
          </div>
        </section>
      )}

      <footer>
        <span>CI Flaky Observatory</span>
        <span>Built with Tauri · GitHub Actions data stays in your session</span>
      </footer>
    </main>
  );
}

function Metric({ label, value, detail, tone }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function PanelTitle({ eyebrow, title }) {
  return (
    <div className="panel-title">
      <div className="eyebrow">{eyebrow}</div>
      <h3>{title}</h3>
    </div>
  );
}

function JobRow({ job, durationOnly }) {
  return (
    <div className="job-row">
      <div className="job-main">
        <span className={`status-dot ${job.status}`} />
        <div>
          <strong>{job.name}</strong>
          <small>
            {job.branches.join(', ') || 'unknown branch'} · {job.runners.join(', ') || 'GitHub-hosted runner'}
          </small>
        </div>
      </div>
      <div className="job-stats">
        {!durationOnly && (
          <b className={job.failure_rate > 0.1 ? 'risk' : ''}>
            {percent(job.failure_rate)} <small>failure</small>
          </b>
        )}
        <b>
          {duration(job.avg_seconds)} <small>avg</small>
        </b>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

export default App;
