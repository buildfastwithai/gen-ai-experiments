import { BarChart3 } from 'lucide-react';
import { CATEGORY_LABELS } from '../scanners/index.js';

export default function CategoryChart({ summary, findings }) {
  const maxCount = Math.max(1, ...Object.values(summary.categories));

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 space-y-4 sticky top-24">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
        <BarChart3 size={14} />
        By Category
      </h3>

      <div className="space-y-3">
        {Object.entries(summary.categories).map(([key, count]) => {
          const pct = Math.round((count / maxCount) * 100);
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">{CATEGORY_LABELS[key] || key}</span>
                <span className={`text-xs font-bold ${count > 0 ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {count}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all duration-700"
                  style={{ width: `${count > 0 ? Math.max(pct, 8) : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {findings && (
        <div className="pt-3 border-t border-zinc-800/50">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Most Common Vulnerabilities</div>
          <div className="space-y-1">
            {topPatterns(findings).map(([name, count], i) => (
              <div key={name} className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 truncate mr-2">{name}</span>
                <span className="text-zinc-600 font-mono">{count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function topPatterns(findings) {
  const counts = {};
  for (const [, list] of Object.entries(findings)) {
    for (const f of list) {
      const key = f.pattern || f.type;
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
}