import { Activity, FileCode2, ScanSearch, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';

export default function ScoreCard({ summary }) {
  const { score, critical, high, medium, totalFindings, linesScanned, scanTimeMs, categories, filesScanned = 1 } = summary;
  const state = score >= 80 ? 'secure' : score >= 50 ? 'review' : 'critical';
  const tone = {
    secure: { label: 'Clear baseline', text: 'text-emerald-300', ring: '#34d399', icon: ShieldCheck, copy: 'No high-risk patterns were detected in the selected workspace.' },
    review: { label: 'Needs review', text: 'text-amber-300', ring: '#fbbf24', icon: ShieldAlert, copy: 'Potentially unsafe patterns need an engineer to review them.' },
    critical: { label: 'Action required', text: 'text-rose-300', ring: '#fb7185', icon: ShieldX, copy: 'Critical patterns were detected. Start with the highest impact finding.' },
  }[state];
  const StateIcon = tone.icon;

  const severities = [
    { label: 'Critical', count: critical, dot: 'bg-rose-400', text: 'text-rose-300' },
    { label: 'High', count: high, dot: 'bg-orange-300', text: 'text-orange-200' },
    { label: 'Medium', count: medium, dot: 'bg-amber-300', text: 'text-amber-200' },
  ];

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-gradient-to-br from-[#1b1722] via-[#141419] to-[#101014] p-5 shadow-[0_24px_70px_rgba(0,0,0,.27)] md:p-6">
      <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-violet-500/10 blur-[100px]" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center">
        <div className="flex min-w-[255px] items-center gap-5">
          <div
            className="relative grid h-[100px] w-[100px] place-items-center rounded-full"
            style={{ background: `conic-gradient(${tone.ring} ${score}%, rgba(255,255,255,.08) ${score}%)` }}
          >
            <div className="grid h-[84px] w-[84px] place-items-center rounded-full border border-white/[0.06] bg-[#121217]">
              <span className={`text-3xl font-black tracking-[-.06em] ${tone.text}`}>{score}</span>
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500"><ScanSearch size={13} />Audit outcome</div>
            <h2 className={`text-xl font-bold tracking-[-.035em] ${tone.text}`}>{tone.label}</h2>
            <p className="mt-1 max-w-[260px] text-xs leading-5 text-zinc-500">{tone.copy}</p>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-3 gap-2 sm:gap-3">
          {severities.map((item) => (
            <div key={item.label} className="rounded-xl border border-white/[0.07] bg-black/20 p-3.5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500"><span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />{item.label}</div>
              <div className={`mt-2 text-2xl font-extrabold tracking-[-.05em] ${item.count ? item.text : 'text-zinc-600'}`}>{item.count}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-3 border-t border-white/[0.07] pt-4 text-xs xl:min-w-[250px] xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <div className="flex items-center gap-2 text-zinc-500"><FileCode2 size={13} className="text-zinc-600" /><span><b className="text-zinc-300">{filesScanned}</b> files</span></div>
          <div className="flex items-center gap-2 text-zinc-500"><Activity size={13} className="text-zinc-600" /><span><b className="text-zinc-300">{linesScanned}</b> lines</span></div>
          <div className="col-span-2 text-zinc-600">{totalFindings === 0 ? 'No findings across 5 local analyzers.' : `${totalFindings} findings across ${Object.values(categories).filter(Boolean).length} detection areas.`}</div>
        </div>
      </div>
    </section>
  );
}
