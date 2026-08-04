import { AlertTriangle, Shield, Code2, Lightbulb } from 'lucide-react';
import { SEVERITY_COLORS, CATEGORY_LABELS } from '../scanners/index.js';
import { useState } from 'react';

export default function FindingsList({ findings }) {
  if (findings.length === 0) {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-12 text-center">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield size={28} className="text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold text-emerald-400 mb-2">All Clear</h3>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          No vulnerabilities found in the scanned code. Your code passes all security checks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
        <AlertTriangle size={14} />
        Findings ({findings.length})
      </h3>
      {findings.map((finding, idx) => (
        <FindingCard key={idx} finding={finding} idx={idx} />
      ))}
    </div>
  );
}

function FindingCard({ finding, idx }) {
  const [expanded, setExpanded] = useState(idx === 0);
  const colors = SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.medium;

  return (
    <div className={`finding-card ${colors.bg} ${colors.border} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start gap-4"
      >
        <div className={`flex-shrink-0 mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${colors.badge}`}>
          {finding.severity}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{finding.type}</span>
            {finding.file && (
              <>
                <span className="text-xs text-zinc-600">in</span>
                <span className="text-xs text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded font-mono max-w-[160px] truncate inline-block">{finding.file}</span>
              </>
            )}
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs text-zinc-500">{finding.pattern}</span>
            <span className="text-xs text-zinc-600">
              Line {finding.line}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{finding.message}</p>
          {finding.snippet && (
            <div className="mt-2 bg-black/30 rounded-lg p-2.5 overflow-x-auto">
              <code className="text-xs text-zinc-400 font-mono">{finding.snippet}</code>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-zinc-600">
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-zinc-800/50 space-y-3">
          <div className="pt-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              <Lightbulb size={12} />
              Recommended Fix
            </div>
            <div className="bg-black/40 rounded-lg p-3">
              <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">{finding.fix}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}