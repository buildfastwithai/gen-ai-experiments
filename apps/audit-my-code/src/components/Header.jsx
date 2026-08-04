import { Activity, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function Header({ onConfigureAI, aiConfigured }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0d]/90 backdrop-blur-xl">
      <div className="max-w-[1440px] mx-auto px-5 sm:px-8 h-[76px] flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="relative w-10 h-10 rounded-xl border border-rose-400/25 bg-gradient-to-br from-rose-500/20 to-fuchsia-500/5 flex items-center justify-center shadow-[0_0_32px_rgba(244,63,94,.12)]">
            <ShieldCheck size={21} className="text-rose-300" strokeWidth={1.8} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,1)]" />
          </div>
          <div>
            <h1 className="text-[19px] font-extrabold text-zinc-100 tracking-[-0.04em]">AuditMyCode</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-[0.18em] mt-0.5">Local security workspace</p>
          </div>
        </div>

          <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.07] bg-white/[0.025]">
            <LockKeyhole size={13} className="text-emerald-400" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.12em]">Private by design</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06]">
            <Activity size={13} className="text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-[0.12em]">Local engine online</span>
          </div>
          <button onClick={onConfigureAI} className="hidden md:inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400 transition-colors hover:border-violet-400/30 hover:text-violet-200">
            <KeyRound size={13} className={aiConfigured ? 'text-violet-300' : 'text-zinc-500'} />
            {aiConfigured ? 'AI configured' : 'Configure AI'}
          </button>
        </div>
      </div>
    </header>
  );
}
