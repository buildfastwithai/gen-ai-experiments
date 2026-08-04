import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-[#09090c] p-6 text-zinc-100">
        <section className="w-full max-w-md rounded-2xl border border-rose-400/20 bg-[#161217] p-6 shadow-2xl">
          <AlertTriangle size={26} className="text-rose-300" />
          <h1 className="mt-4 text-lg font-bold">Audit workspace encountered an error</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">The app stopped rendering safely instead of showing a blank screen. Reload to return to the workspace.</p>
          <pre className="mt-4 max-h-24 overflow-auto rounded-lg bg-black/25 p-3 text-xs text-rose-200">{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3.5 py-2.5 text-xs font-bold text-zinc-900"><RefreshCw size={14} />Reload app</button>
        </section>
      </main>
    );
  }
}
