"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface MarketSection {
  assessment: string;
  rating: string;
}

interface AnalysisResult {
  fundabilityScore: number;
  verdictSummary: string;
  brutalFeedback: string;
  marketReality: MarketSection;
  monetization: MarketSection;
  moat: MarketSection;
  competition: MarketSection;
  biggestRedFlag: string;
  howToImprove: string[];
  vcVerdict: string;
}

const LOADING_MESSAGES = [
  "Checking TAM...",
  "Stress-testing your moat...",
  "Googling your competitors...",
  "Calculating burn rate anxiety...",
  "Consulting the term sheet oracle...",
  "Evaluating founder-market fit...",
  "Running DCF on vibes...",
  "Checking if this is just Uber for X...",
  "Asking GPT-4 what it thinks...",
  "Reviewing your deck's font choices...",
];

const VERDICT_COLORS: Record<string, string> = {
  "WRITE THE CHECK": "#22c55e",
  INTRIGUED: "#a78bfa",
  MAYBE: "#f59e0b",
  PASS: "#f97316",
  "HARD PASS": "#ef4444",
};

const RATING_EMOJIS: Record<string, string> = {
  Massive: "🚀", Solid: "💪", Niche: "🎯", Questionable: "🤔", Delusional: "💀",
  "Crystal Clear": "💎", Promising: "✨", Fuzzy: "🌫️", "Wishful Thinking": "🙏", "What Revenue?": "😬",
  Fortress: "🏰", "Solid Wall": "🧱", "Picket Fence": "🪵", "Wet Paper Bag": "💧", Nonexistent: "🕳️",
  "Blue Ocean": "🌊", Differentiated: "⚡", Crowded: "🏙️", Bloodbath: "🩸", "You Missed It": "⏰",
};

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: 20,
};

function ScoreMeter({ score, animate }: { score: number; animate: boolean }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f97316" : "#ef4444";
  const glow = score >= 70 ? "rgba(34,197,94,0.6)" : score >= 40 ? "rgba(249,115,22,0.6)" : "rgba(239,68,68,0.6)";
  const label = score >= 80 ? "🔥 Unicorn Material" : score >= 65 ? "⚡ Worth a Meeting" : score >= 45 ? "🤔 Needs Work" : score >= 25 ? "😬 Pivot Required" : "💀 Back to Day Job";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ position: "relative", width: 200, height: 200 }}>
        <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}>
          <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeDasharray={circumference} />
          <circle
            cx="100" cy="100" r={radius} fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animate ? offset : circumference}
            style={{
              filter: `drop-shadow(0 0 10px ${glow})`,
              transition: animate ? "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)" : "none",
            }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 52, fontWeight: 900, color, lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>{score}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>/ 100</span>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Fundability Score</p>
        <p style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "'Space Grotesk', sans-serif" }}>{label}</p>
      </div>
    </div>
  );
}

function Confetti() {
  const colors = ["#7c3aed", "#2563eb", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#a78bfa", "#60a5fa"];
  const pieces = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    color: colors[Math.floor(Math.random() * colors.length)],
    left: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 3,
    size: 6 + Math.random() * 8,
    shape: Math.random() > 0.5 ? "50%" : "2px",
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      {pieces.map((p) => (
        <div key={p.id} className="confetti-piece" style={{ left: `${p.left}%`, backgroundColor: p.color, width: p.size, height: p.size, borderRadius: p.shape, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...glass, padding: 24, ...style }}>{children}</div>;
}

function SectionCard({ icon, title, badge, badgeColor, children, delay = 0 }: {
  icon: string; title: string; badge?: string; badgeColor?: string; children: React.ReactNode; delay?: number;
}) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}>
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>{title}</h3>
          </div>
          {badge && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 100, background: `${badgeColor}20`, color: badgeColor, border: `1px solid ${badgeColor}35`, whiteSpace: "nowrap", flexShrink: 0 }}>
              {RATING_EMOJIS[badge] || ""} {badge}
            </span>
          )}
        </div>
        {children}
      </Card>
    </div>
  );
}

export default function Home() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [scoreAnimated, setScoreAnimated] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cycleMessages = useCallback(() => {
    let idx = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[idx]);
    }, 1800);
  }, []);

  const stopMessages = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  useEffect(() => () => stopMessages(), [stopMessages]);

  const handleAnalyze = async () => {
    if (!idea.trim() || idea.trim().length < 10) { setError("Give me more to work with. At least a sentence or two."); return; }
    setError(""); setResult(null); setScoreAnimated(false); setShowConfetti(false); setLoading(true);
    cycleMessages();
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea }) });
      const data = await res.json();
      stopMessages(); setLoading(false); setResult(data);
      setTimeout(() => { setScoreAnimated(true); resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
      if (data.fundabilityScore > 80) { setTimeout(() => setShowConfetti(true), 800); setTimeout(() => setShowConfetti(false), 6000); }
    } catch {
      stopMessages(); setLoading(false);
      setError("Something went wrong. Even our servers are skeptical of this idea.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAnalyze(); };
  const verdictColor = result ? (VERDICT_COLORS[result.vcVerdict] || "#a78bfa") : "#a78bfa";

  const wrap: React.CSSProperties = { width: "100%", maxWidth: 768, margin: "0 auto", padding: "0 24px" };

  return (
    <main style={{ position: "relative", minHeight: "100vh", paddingBottom: 80, zIndex: 1 }}>
      {showConfetti && <Confetti />}

      {/* Header */}
      <div style={wrap}>
        <header style={{ paddingTop: 64, paddingBottom: 40, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, padding: "6px 16px", borderRadius: 100, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", color: "#a78bfa", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#a78bfa", display: "inline-block" }} />
            Silicon Valley Reality Check
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: "clamp(2.5rem, 8vw, 5rem)", lineHeight: 1, letterSpacing: "-0.02em", marginBottom: 16, margin: "0 0 16px" }}>
            <span style={{ background: "linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #c084fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>VibeCheck</span>
            {" "}
            <span style={{ color: "rgba(255,255,255,0.9)" }}>VC</span>
          </h1>
          <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.7, color: "rgba(255,255,255,0.45)", fontWeight: 400, maxWidth: 480, margin: "16px auto 0" }}>
            Paste your startup idea. Get a brutal, honest verdict from a virtual VC who&apos;s seen it all — and funded very little.
          </p>
        </header>
      </div>

      {/* Input */}
      <div style={wrap}>
        <section style={{ marginBottom: 32 }}>
          <div className="animate-border-glow" style={{ ...glass, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Your Startup Idea</label>
              <span style={{ fontSize: 11, fontWeight: 500, color: charCount > 1500 ? "#ef4444" : charCount > 1000 ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>{charCount} chars</span>
            </div>
            <textarea
              id="startup-idea"
              className="idea-textarea"
              rows={6}
              maxLength={2000}
              placeholder="e.g. An AI-powered platform that helps restaurants reduce food waste by predicting demand using ML and connecting surplus inventory with local food banks in real-time..."
              value={idea}
              onChange={(e) => { setIdea(e.target.value); setCharCount(e.target.value.length); if (error) setError(""); }}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            {error && <p className="animate-fade-in" style={{ marginTop: 8, fontSize: 13, color: "#ef4444" }}>⚠️ {error}</p>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, gap: 16 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>⌘ + Enter to submit</p>
              <button
                id="analyze-btn"
                className="btn-gradient"
                style={{ padding: "12px 32px", fontSize: 14, fontWeight: 600 }}
                onClick={handleAnalyze}
                disabled={loading || !idea.trim()}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                    </svg>
                    Analyzing...
                  </span>
                ) : "Get Roasted 🔥"}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Loading */}
      {loading && (
        <div style={wrap}>
          <section className="animate-fade-in" style={{ marginBottom: 32 }}>
            <Card style={{ textAlign: "center", padding: 48 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <div style={{ position: "relative", width: 64, height: 64 }}>
                  <div className="animate-spin" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#7c3aed", borderRightColor: "#2563eb" }} />
                  <div className="animate-spin" style={{ position: "absolute", inset: 8, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#a78bfa", animationDirection: "reverse", animationDuration: "0.8s" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🧠</div>
                </div>
              </div>
              <p className="animate-pulse-glow" style={{ fontSize: 18, fontWeight: 600, color: "#a78bfa", fontFamily: "'Space Grotesk', sans-serif" }}>{loadingMsg}</p>
              <p style={{ fontSize: 13, marginTop: 8, color: "rgba(255,255,255,0.3)" }}>Our virtual VC is reviewing your pitch deck...</p>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="shimmer" style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(124,58,237,0.4)", animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </Card>
          </section>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div style={wrap}>
          <section ref={resultsRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Score Hero */}
            <div className="animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
              <Card>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
                  <ScoreMeter score={result.fundabilityScore} animate={scoreAnimated} />
                  <div style={{ textAlign: "center", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 100, background: `${verdictColor}18`, color: verdictColor, border: `1px solid ${verdictColor}35` }}>VC Verdict</span>
                      <span style={{ fontWeight: 900, fontSize: 18, color: verdictColor, fontFamily: "'Space Grotesk', sans-serif" }}>{result.vcVerdict}</span>
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.6, color: "rgba(255,255,255,0.85)" }}>{result.verdictSummary}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Brutal Feedback */}
            <SectionCard icon="💬" title="Brutal Feedback" delay={100}>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.65)", margin: 0 }}>{result.brutalFeedback}</p>
            </SectionCard>

            {/* Market + Monetization */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              <SectionCard icon="📊" title="Market Reality" badge={result.marketReality.rating} badgeColor="#60a5fa" delay={200}>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.65)", margin: 0 }}>{result.marketReality.assessment}</p>
              </SectionCard>
              <SectionCard icon="💰" title="Monetization" badge={result.monetization.rating} badgeColor="#a78bfa" delay={250}>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.65)", margin: 0 }}>{result.monetization.assessment}</p>
              </SectionCard>
            </div>

            {/* Moat + Competition */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              <SectionCard icon="🏰" title="Moat & Defensibility" badge={result.moat.rating} badgeColor="#f59e0b" delay={300}>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.65)", margin: 0 }}>{result.moat.assessment}</p>
              </SectionCard>
              <SectionCard icon="⚔️" title="Competition" badge={result.competition.rating} badgeColor="#ec4899" delay={350}>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.65)", margin: 0 }}>{result.competition.assessment}</p>
              </SectionCard>
            </div>

            {/* Red Flag */}
            <div className="animate-fade-in-up" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
              <Card style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 18 }}>🚨</span>
                  <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ef4444", fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>Biggest Red Flag</h3>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, fontWeight: 500, color: "rgba(255,180,180,0.9)", margin: 0 }}>{result.biggestRedFlag}</p>
              </Card>
            </div>

            {/* How to Improve */}
            <div className="animate-fade-in-up" style={{ animationDelay: "500ms", animationFillMode: "forwards" }}>
              <Card style={{ borderColor: "rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 18 }}>🛠️</span>
                  <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#22c55e", fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>How to Improve</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {result.howToImprove.map((tip, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", marginTop: 2 }}>{i + 1}</div>
                      <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.65)", margin: 0 }}>{tip}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Try Again */}
            <div className="animate-fade-in-up" style={{ textAlign: "center", paddingTop: 16, paddingBottom: 8, animationDelay: "600ms", animationFillMode: "forwards" }}>
              <button
                className="btn-gradient"
                style={{ padding: "12px 32px", fontSize: 14, fontWeight: 600 }}
                onClick={() => { setResult(null); setIdea(""); setCharCount(0); setScoreAnimated(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              >
                Pitch Another Idea 🚀
              </button>
              <p style={{ fontSize: 12, marginTop: 12, color: "rgba(255,255,255,0.2)" }}>Remember: every unicorn was once a laughingstock.</p>
            </div>

          </section>
        </div>
      )}

      {/* Footer */}
      <div style={wrap}>
        <footer style={{ textAlign: "center", marginTop: 64, paddingBottom: 32, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
          <p>VibeCheck VC — Not actual investment advice. Our virtual VC has no fiduciary duty.</p>
          <p style={{ marginTop: 4 }}>Built for founders brave enough to hear the truth. 💜</p>
        </footer>
      </div>
    </main>
  );
}
