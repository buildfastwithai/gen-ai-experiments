import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, LockKeyhole, Sparkles, X } from 'lucide-react';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', model: 'GPT-4o mini', mark: 'O', tone: 'from-emerald-400 to-cyan-400' },
  { id: 'anthropic', name: 'Anthropic', model: 'Claude Haiku', mark: 'A', tone: 'from-orange-300 to-rose-400' },
  { id: 'gemini', name: 'Gemini', model: 'Gemini Flash', mark: 'G', tone: 'from-blue-400 to-violet-400' },
];

export default function AIConfigModal({ open, config, onClose, onSave }) {
  const [provider, setProvider] = useState(config?.provider || 'openai');
  const [apiKey, setApiKey] = useState(config?.apiKey || '');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProvider(config?.provider || 'openai');
    setApiKey(config?.apiKey || '');
    setVisible(false);
  }, [open, config]);

  if (!open) return null;
  const active = PROVIDERS.find((item) => item.id === provider);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button aria-label="Close configuration" onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <section className="relative w-full max-w-[620px] overflow-hidden rounded-[22px] border border-white/[0.12] bg-[#121218] shadow-[0_28px_100px_rgba(0,0,0,.7)]">
        <div className="absolute -right-24 -top-20 h-56 w-56 rounded-full bg-violet-500/15 blur-[90px]" />
        <div className="relative flex items-start justify-between border-b border-white/[0.07] p-6">
          <div className="flex gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-400/20 bg-violet-400/[0.09] text-violet-200"><Sparkles size={19} /></div>
            <div>
              <h2 className="text-lg font-bold tracking-[-.03em] text-zinc-100">Configure AI Deep Review</h2>
              <p className="mt-1 text-xs text-zinc-500">Bring your own API key for contextual security analysis.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"><X size={18} /></button>
        </div>

        <div className="relative space-y-6 p-6">
          <div>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Choose provider</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PROVIDERS.map((item) => {
                const selected = item.id === provider;
                return (
                  <button key={item.id} onClick={() => setProvider(item.id)} className={`relative rounded-xl border p-3 text-left transition-all ${selected ? 'border-violet-400/45 bg-violet-400/[0.10] shadow-[inset_0_0_0_1px_rgba(167,139,250,.1)]' : 'border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16]'}`}>
                    <div className={`mb-3 grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br ${item.tone} text-xs font-black text-zinc-950`}>{item.mark}</div>
                    <div className="text-xs font-bold text-zinc-200">{item.name}</div>
                    <div className="mt-0.5 text-[10px] text-zinc-600">{item.model}</div>
                    {selected && <span className="absolute right-2.5 top-2.5 grid h-4 w-4 place-items-center rounded-full bg-violet-300 text-violet-950"><Check size={11} strokeWidth={3} /></span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">{active.name} API key</label>
            <div className="flex items-center rounded-xl border border-white/[0.10] bg-black/25 focus-within:border-violet-400/45 focus-within:ring-2 focus-within:ring-violet-400/10">
              <KeyRound size={16} className="ml-3.5 text-zinc-600" />
              <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type={visible ? 'text' : 'password'} placeholder={`Paste your ${active.name} key`} className="min-w-0 flex-1 bg-transparent px-3 py-3.5 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-700" autoComplete="off" spellCheck="false" />
              <button onClick={() => setVisible((value) => !value)} className="mr-2 rounded-lg p-2 text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-300">{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>

          <div className="flex gap-3 rounded-xl border border-amber-300/10 bg-amber-300/[0.045] p-3.5">
            <LockKeyhole size={16} className="mt-0.5 shrink-0 text-amber-200" />
            <p className="text-xs leading-5 text-zinc-500"><span className="font-semibold text-zinc-300">Session-only key.</span> Your key is never saved to disk. Starting an AI Deep Review sends the selected source files to {active.name}; Local Security Scan always stays on-device.</p>
          </div>
        </div>

        <div className="relative flex items-center justify-between border-t border-white/[0.07] bg-black/10 p-5">
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-200">Cancel</button>
          <button disabled={apiKey.trim().length < 12} onClick={() => { onSave({ provider, apiKey: apiKey.trim() }); onClose(); }} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-200 to-fuchsia-200 px-4 py-2.5 text-xs font-extrabold text-[#21122d] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"><Sparkles size={14} />Enable AI Deep Review</button>
        </div>
      </section>
    </div>
  );
}
