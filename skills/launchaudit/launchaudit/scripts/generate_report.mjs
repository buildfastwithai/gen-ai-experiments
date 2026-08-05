#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PREMIUM_CSS = readFileSync(
  new URL("../templates/premium-report.css", import.meta.url),
  "utf8"
);

const PREMIUM_SCRIPT = `<script>
(() => {
  document.body.classList.add("loaded");
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        reveal.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll("section, .card, .dimension, .stage, .fix, .plan-card, .experiment").forEach((item) => {
    item.classList.add("reveal");
    reveal.observe(item);
  });
  const progress = document.createElement("div");
  progress.className = "premium-progress";
  document.body.appendChild(progress);
  addEventListener("scroll", () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (scrollY / Math.max(max, 1) * 100) + "%";
  }, { passive: true });
  document.querySelectorAll(".card, .stage, .fix, .plan-card").forEach((item) => {
    item.addEventListener("pointermove", (event) => {
      const box = item.getBoundingClientRect();
      item.style.setProperty("--mx", (event.clientX - box.left) + "px");
      item.style.setProperty("--my", (event.clientY - box.top) + "px");
    });
  });
  const themeButton = document.getElementById("themeToggle");
  if (themeButton) {
    const savedTheme = localStorage.getItem("launchaudit-theme");
    const initialTheme = savedTheme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const applyTheme = (theme) => {
      document.body.dataset.theme = theme;
      themeButton.setAttribute("aria-pressed", theme === "light");
      themeButton.querySelector("span:last-child").textContent = theme === "light" ? "☼" : "◐";
    };
    applyTheme(initialTheme);
    themeButton.addEventListener("click", () => {
      const next = document.body.dataset.theme === "light" ? "dark" : "light";
      localStorage.setItem("launchaudit-theme", next);
      applyTheme(next);
    });
  }
})();
</script>`;

export const DIMENSIONS = [
  ["positioning", "Positioning clarity", 15],
  ["audience", "Audience relevance", 10],
  ["conversion", "Conversion path", 15],
  ["proof", "Product proof", 15],
  ["trust", "Trust and risk", 10],
  ["experience", "Experience quality", 10],
  ["technical", "Technical surface", 15],
  ["operations", "Launch operations", 10]
];

const VERDICTS = new Set([
  "Ready to launch",
  "Launch after critical fixes",
  "Not ready yet"
]);

export function calculateReadiness(dimensions) {
  let knownWeight = 0;
  let weightedPoints = 0;

  for (const dimension of dimensions) {
    if (dimension.score === null) continue;
    knownWeight += dimension.weight;
    weightedPoints += (dimension.score / 5) * dimension.weight;
  }

  return {
    score: knownWeight ? Math.round((weightedPoints / knownWeight) * 100) : 0,
    coverage: Math.round(knownWeight)
  };
}

export function validateReport(data) {
  const errors = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["Root must be an object"];
  }

  for (const field of ["title", "tested_url", "mode", "language", "generated_at"]) {
    if (!data.meta?.[field]) errors.push(`meta.${field} is required`);
  }

  if (!data.startup?.name) errors.push("startup.name is required");
  if (!VERDICTS.has(data.verdict?.label)) {
    errors.push("verdict.label is invalid");
  }

  if (!Array.isArray(data.dimensions) || data.dimensions.length !== DIMENSIONS.length) {
    errors.push("dimensions must contain all eight framework dimensions");
  } else {
    DIMENSIONS.forEach(([key, name, weight], index) => {
      const dimension = data.dimensions[index];
      if (dimension?.key !== key) {
        errors.push(`dimensions[${index}].key must be ${key}`);
      }
      if (dimension?.name !== name) {
        errors.push(`dimensions[${index}].name must be ${name}`);
      }
      if (dimension?.weight !== weight) {
        errors.push(`dimensions[${index}].weight must be ${weight}`);
      }
      if (
        dimension?.score !== null &&
        (!Number.isInteger(dimension?.score) || dimension.score < 0 || dimension.score > 5)
      ) {
        errors.push(`dimensions[${index}].score must be an integer from 0 to 5 or null`);
      }
    });
  }

  if (!Array.isArray(data.journey) || data.journey.length !== 6) {
    errors.push("journey must contain six stages");
  } else {
    const allowedStates = new Set(["pass", "friction", "blocker", "unknown"]);
    data.journey.forEach((stage, index) => {
      if (!stage.stage) errors.push(`journey[${index}].stage is required`);
      if (!allowedStates.has(stage.state)) {
        errors.push(`journey[${index}].state is invalid`);
      }
    });
  }

  for (const field of ["blockers", "improvements", "rewrites", "plan", "sources"]) {
    if (!Array.isArray(data[field])) errors.push(`${field} must be an array`);
  }

  if (!data.validation || typeof data.validation !== "object") {
    errors.push("validation is required");
  }

  if (Array.isArray(data.dimensions) && data.dimensions.length === DIMENSIONS.length) {
    const calculated = calculateReadiness(data.dimensions);
    if (data.verdict?.score !== calculated.score) {
      errors.push(`verdict.score must equal calculated score ${calculated.score}`);
    }
    if (data.verdict?.coverage !== calculated.coverage) {
      errors.push(`verdict.coverage must equal calculated coverage ${calculated.coverage}`);
    }
  }

  return errors;
}

export function renderReport(data) {
  return renderPremiumReport(data);

  /* Legacy renderer retained below for reference during the template migration. */
  /*
  const { meta, startup, verdict, dimensions, journey, blockers, improvements, rewrites, plan, validation, sources } = data;
  const verdictTone = toneForVerdict(verdict.label);
  const scoreTone = verdict.score >= 80 ? "good" : verdict.score >= 55 ? "warn" : "bad";

  const report = `<!doctype html>
<html lang="${esc(meta.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='4' y='4' width='56' height='56' rx='16' fill='%2317163a'/%3E%3Cpath d='M18 16v31h21' fill='none' stroke='%23a78bfa' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M31 47l11-31 12 31M35 36h14' fill='none' stroke='%2322d3ee' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
  <title>${esc(meta.title)}</title>
  <style>
    :root {
       --ink: #11152a;
       --paper: #f5f7fb;
       --panel: rgba(255,255,255,.88);
       --muted: #687087;
       --line: #e2e7f0;
       --orange: #ff6547;
      --green: #167b57;
      --amber: #a65b00;
      --red: #b72d2d;
      --blue: #3157d5;
       --radius: 20px;
    }
     * { box-sizing: border-box; }
     html { scroll-behavior: smooth; }
     @keyframes rise-in {
       from { opacity: 0; transform: translateY(18px); }
       to { opacity: 1; transform: translateY(0); }
     }
     @keyframes soft-pulse {
       0%, 100% { box-shadow: 0 0 0 0 rgba(34,211,238,.18); }
       50% { box-shadow: 0 0 0 9px rgba(34,211,238,0); }
     }
      @keyframes fill-in { from { width: 0; } }
      @keyframes orbit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes orbit-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
      @keyframes beam-scan { from { transform: translateX(-120%); } to { transform: translateX(240%); } }
     @keyframes rise-in {
       from { opacity: 0; transform: translateY(18px); }
       to { opacity: 1; transform: translateY(0); }
     }
     @keyframes ambient-drift {
       0%, 100% { transform: translate3d(0,0,0) scale(1); }
       50% { transform: translate3d(-22px,18px,0) scale(1.08); }
     }
     @keyframes logo-float {
       0%, 100% { transform: translateY(0); }
       50% { transform: translateY(-4px); }
     }
     @media (prefers-reduced-motion: no-preference) {
       header::after { animation: ambient-drift 12s ease-in-out infinite; }
       .mark { animation: logo-float 5s ease-in-out infinite; }
       .card, .dimension, .stage, .fix, .verdict, .experiment {
         animation: rise-in .65s cubic-bezier(.2,.75,.25,1) both;
       }
       .diagnostics > :nth-child(2) { animation-delay: 60ms; }
       .diagnostics > :nth-child(3) { animation-delay: 120ms; }
       .diagnostics > :nth-child(4) { animation-delay: 180ms; }
       .diagnostics > :nth-child(5) { animation-delay: 240ms; }
       .diagnostics > :nth-child(6) { animation-delay: 300ms; }
       .diagnostics > :nth-child(7) { animation-delay: 360ms; }
       .diagnostics > :nth-child(8) { animation-delay: 420ms; }
       .diagnostics > :nth-child(9) { animation-delay: 480ms; }
     }
     @media (prefers-reduced-motion: reduce) {
       html { scroll-behavior: auto; }
       *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
     }
    body {
      margin: 0;
      color: var(--ink);
       background: radial-gradient(circle at 90% 0%, #e9e7ff 0, transparent 30%), var(--paper);
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
       line-height: 1.48;
     }
      body::before { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: -1; opacity: .22; background-image: linear-gradient(rgba(49,87,213,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(49,87,213,.08) 1px, transparent 1px); background-size: 48px 48px; mask-image: linear-gradient(to bottom, black, transparent 75%); }
    a { color: inherit; }
     .layout { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100vh; }
    aside {
      position: sticky; top: 0; height: 100vh; padding: 26px 22px;
       background: linear-gradient(180deg, #11152a 0%, #171b35 100%); color: white; display: flex; flex-direction: column; gap: 24px;
       border-right: 1px solid rgba(255,255,255,.08);
    }
     .mark {
      width: 48px; height: 48px; display: grid; place-items: center;
       border-radius: 16px; background: linear-gradient(135deg, #a78bfa, #22d3ee); color: #17163a;
       font-weight: 950; font-size: 15px; letter-spacing: -.04em;
       animation: soft-pulse 3.6s ease-in-out infinite;
    }
    .side-name { font-size: 18px; line-height: 1.12; font-weight: 800; }
    .eyebrow {
      color: var(--muted); font-size: 11px; font-weight: 850;
      letter-spacing: .13em; text-transform: uppercase;
    }
    aside .eyebrow { color: rgba(255,255,255,.5); }
    nav { display: grid; gap: 5px; }
    nav a {
      padding: 8px 10px; border-radius: 9px; color: rgba(255,255,255,.66);
      text-decoration: none; font-size: 13px;
    }
     nav a:hover { color: white; background: rgba(255,255,255,.08); }
     nav a { transition: color .2s ease, background .2s ease, transform .2s ease; }
     nav a:hover { transform: translateX(4px); }
    .side-foot { margin-top: auto; color: rgba(255,255,255,.52); font-size: 12px; }
     main { min-width: 0; }
      section { position: relative; overflow: hidden; }
      #diagnosis { color: #fff; background: linear-gradient(135deg,#11152a,#25205d 70%,#0f4650); }
      #diagnosis .eyebrow { color: rgba(255,255,255,.6); } #diagnosis .verdict { background: transparent; box-shadow: none; }
      #diagnosis .verdict::before { border-color: rgba(255,255,255,.2); } #diagnosis .card { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.14); }
      #scorecard { background: #10152b; color: #fff; } #scorecard .eyebrow { color: #9ea8c4; } #scorecard .dimension { background: rgba(255,255,255,.055); border-color: rgba(255,255,255,.12); }
      #scorecard .dim-note { color: #aab3c9; } #scorecard .track { background: rgba(255,255,255,.12); }
      #journey { background: linear-gradient(135deg,#eef3ff,#f8fbff); } #journey .stage { box-shadow: 0 14px 35px rgba(49,87,213,.09); }
      #blockers { background: #fff4f1; } #blockers .section-head .eyebrow { color: #c83a32; }
      #fixes { background: linear-gradient(135deg,#f7f5ff,#eefbff); } #fixes .fix { border-color: rgba(124,108,255,.2); }
      #plan { background: #11152a; color: #fff; } #plan .eyebrow { color: #aeb7d0; } #plan .plan-card { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.12); } #plan .plan-card .done { color: #aeb7d0; }
      #retest { background: #f6fafb; }
     header {
      min-height: 76vh; padding: clamp(44px,7vw,100px);
      display: grid; align-content: space-between; gap: 56px;
       border-bottom: 1px solid var(--line); overflow: hidden; position: relative;
       animation: rise-in .7s ease both;
    }
      header::after {
       content: ""; position: absolute; width: 420px; height: 420px; right: -120px; top: -170px;
       border-radius: 50%; background: linear-gradient(135deg, rgba(167,139,250,.4), rgba(34,211,238,.08));
       filter: blur(8px); z-index: 0; opacity: .85;
     }
      header::before { content: ""; position: absolute; left: 0; bottom: 0; width: 42%; height: 2px; background: linear-gradient(90deg, transparent, #22d3ee, transparent); animation: beam-scan 4s linear infinite; z-index: 2; }
      .hero-orbit { position: absolute; right: 10%; top: 18%; width: 330px; height: 330px; border: 1px solid rgba(49,87,213,.2); border-radius: 50%; z-index: 0; animation: orbit-spin 26s linear infinite; }
      .hero-orbit::before, .hero-orbit::after { content: ""; position: absolute; inset: 38px; border: 1px dashed rgba(34,211,238,.34); border-radius: 50%; }
      .hero-orbit::after { inset: 84px; border-style: solid; border-color: rgba(167,139,250,.32); animation: orbit-reverse 15s linear infinite; }
      .hero-orbit-core { position: absolute; inset: 0; display: grid; place-items: center; margin: auto; width: 104px; height: 104px; border-radius: 28px; color: #17163a; background: linear-gradient(135deg,#a78bfa,#22d3ee); font-size: 28px; font-weight: 950; box-shadow: 0 0 65px rgba(34,211,238,.34); animation: soft-pulse 4s ease-in-out infinite; }
      .hero-orbit-node { position: absolute; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 15px; color: var(--ink); background: rgba(255,255,255,.75); border: 1px solid rgba(49,87,213,.2); box-shadow: 0 8px 22px rgba(28,39,70,.12); font-size: 10px; font-weight: 900; letter-spacing: .08em; }
      .hero-orbit-node:nth-child(2) { top: 4px; left: 62px; } .hero-orbit-node:nth-child(3) { top: 96px; right: -22px; } .hero-orbit-node:nth-child(4) { bottom: 4px; right: 62px; } .hero-orbit-node:nth-child(5) { bottom: 96px; left: -22px; }
    h1 {
       margin: 18px 0 20px; max-width: 970px; font-size: clamp(48px,7vw,88px);
       line-height: .94; letter-spacing: -.06em; position: relative; z-index: 1;
    }
     .lede { max-width: 720px; font-size: clamp(18px,2vw,25px); color: var(--muted); position: relative; z-index: 1; }
     .hero-meta { display: flex; gap: 28px; flex-wrap: wrap; }
     .hero-meta > div { min-width: 150px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,.62); box-shadow: 0 8px 20px rgba(28,39,70,.04); transition: transform .25s ease, box-shadow .25s ease; }
     .hero-meta > div:hover { transform: translateY(-3px); box-shadow: 0 14px 28px rgba(28,39,70,.1); }
     .hero-meta > div { transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
     .hero-meta > div:hover { transform: translateY(-3px); border-color: #b8b4ff; box-shadow: 0 14px 26px rgba(68,58,150,.12); }
     .hero-meta strong { display: block; margin-top: 5px; font-size: 14px; overflow-wrap: anywhere; }
     section { padding: clamp(52px,6vw,88px); border-bottom: 1px solid var(--line); animation: rise-in .7s ease both; }
     .section-head {
       display: grid; grid-template-columns: 130px minmax(0,1fr); gap: 24px;
       align-items: start; margin-bottom: 40px;
     }
     .section-head .eyebrow { padding-top: 10px; color: var(--orange); }
     section:nth-of-type(even) { background: rgba(255,255,255,.42); }
     section:nth-of-type(odd) { background: rgba(245,247,251,.42); }
     h2 { margin: 0; font-size: clamp(38px,4.5vw,64px); line-height: .98; letter-spacing: -.055em; }
    h3 { margin: 0 0 10px; font-size: 23px; line-height: 1.08; letter-spacing: -.025em; }
    p { margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(12,1fr); gap: 14px; }
    .span-3 { grid-column: span 3; } .span-4 { grid-column: span 4; }
    .span-5 { grid-column: span 5; } .span-6 { grid-column: span 6; }
    .span-7 { grid-column: span 7; } .span-8 { grid-column: span 8; }
    .span-12 { grid-column: span 12; }
     .card {
       background: var(--panel); border: 1px solid rgba(226,231,240,.95);
       border-radius: var(--radius); padding: 24px; box-shadow: 0 12px 30px rgba(28,39,70,.05);
       transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
     }
     .card:hover { transform: translateY(-4px); border-color: #c9d2e4; box-shadow: 0 18px 38px rgba(28,39,70,.1); }
     .card > .eyebrow { margin-bottom: 10px; color: #66708a; }
     .card > p { font-size: 16px; line-height: 1.58; }
     #startup .card { position: relative; overflow: hidden; }
     #startup .card::after { content: ""; position: absolute; width: 90px; height: 90px; right: -32px; bottom: -42px; border-radius: 50%; background: rgba(167,139,250,.12); }
     #startup .card:nth-child(1) { border-top: 3px solid #a78bfa; }
     #startup .card:nth-child(2) { border-top: 3px solid #22d3ee; }
     #startup .card:nth-child(3) { border-top: 3px solid #ffb33f; }
     #startup .card:nth-child(4) { border-top: 3px solid #36c58a; }
     #startup .card:nth-child(5) { border-top: 3px solid #ff6b5f; }
     .card { transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
     .card:hover { transform: translateY(-3px); border-color: #ccd2e2; box-shadow: 0 18px 38px rgba(28,39,70,.09); }
    .verdict {
      display: grid; grid-template-columns: minmax(0,1fr) 260px; gap: 32px;
       color: white; background: linear-gradient(135deg, ${verdictTone.background}, #171b35); border-radius: 28px; padding: clamp(28px,5vw,56px);
       box-shadow: 0 24px 60px rgba(17,21,42,.18);
    }
    .verdict h2 { max-width: 840px; }
    .verdict p { max-width: 700px; color: rgba(255,255,255,.76); font-size: 17px; }
    .score-ring {
      --score: ${verdict.score};
      width: 210px; aspect-ratio: 1; margin-inline: auto;
      border-radius: 50%; display: grid; place-items: center;
      background: conic-gradient(${toneColor(scoreTone)} calc(var(--score)*1%), rgba(255,255,255,.14) 0);
      position: relative;
    }
    .score-ring::before {
      content: ""; position: absolute; inset: 15px; border-radius: 50%;
      background: ${verdictTone.background};
    }
    .score-value { position: relative; text-align: center; font-size: 64px; font-weight: 900; letter-spacing: -.07em; line-height: .85; }
    .score-value small { display: block; margin-top: 12px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.58); }
    .coverage { margin-top: 18px; text-align: center; color: rgba(255,255,255,.65); font-size: 13px; }
    .metric { font-size: clamp(28px,4vw,46px); line-height: 1; letter-spacing: -.04em; font-weight: 820; }
    .evidence-list, .plain-list { margin: 0; padding-left: 18px; }
    .evidence-list li + li, .plain-list li + li { margin-top: 8px; }
    .diagnostics { display: grid; gap: 12px; }
     .dimension {
      display: grid; grid-template-columns: 190px 1fr 64px; gap: 18px;
      align-items: center; background: var(--panel); border: 1px solid var(--line);
       border-radius: 18px; padding: 18px 20px;
       box-shadow: 0 8px 22px rgba(28,39,70,.04);
     }
     .dimension:nth-child(4n + 1) { border-left: 4px solid #a78bfa; }
     .dimension:nth-child(4n + 2) { border-left: 4px solid #22d3ee; }
     .dimension:nth-child(4n + 3) { border-left: 4px solid #ffb33f; }
     .dimension:nth-child(4n) { border-left: 4px solid #36c58a; }
    .dimension-name { font-weight: 780; }
    .track { height: 8px; border-radius: 99px; background: #e4ded4; overflow: hidden; margin: 8px 0 7px; }
     .fill { height: 100%; border-radius: 99px; animation: fill-in .9s cubic-bezier(.2,.8,.2,1) both; }
    .dim-note { color: var(--muted); font-size: 12px; }
    .dim-score { text-align: right; font-size: 30px; font-weight: 850; letter-spacing: -.05em; }
     .journey { display: grid; grid-template-columns: repeat(6,minmax(155px,1fr)); gap: 12px; overflow-x: auto; padding: 4px 2px 12px; }
     .stage { min-height: 250px; min-width: 0; border-radius: 20px; padding: 19px; border: 1px solid var(--line); background: var(--panel); overflow-wrap: normal; word-break: normal; transition: transform .25s ease, box-shadow .25s ease; }
     .stage:hover { transform: translateY(-5px); box-shadow: 0 16px 32px rgba(28,39,70,.1); }
    .state {
      display: inline-flex; align-items: center; gap: 7px; padding: 5px 9px;
      border-radius: 99px; font-size: 11px; font-weight: 850; text-transform: uppercase;
      letter-spacing: .08em; margin-bottom: 34px;
    }
    .state::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .state-pass { color: var(--green); background: #e1f1e9; }
    .state-friction { color: var(--amber); background: #fff0cf; }
    .state-blocker { color: var(--red); background: #f9dddd; }
    .state-unknown { color: #68645e; background: #e8e4dc; }
     .stage p { color: var(--muted); font-size: 13px; }
     .stage h3 { font-size: clamp(17px,1.35vw,20px); letter-spacing: -.04em; overflow-wrap: normal; word-break: normal; }
     .stage:has(.state-pass) { border-top: 3px solid #36c58a; }
     .stage:has(.state-friction) { border-top: 3px solid #ffb33f; }
     .stage:has(.state-blocker) { border-top: 3px solid #ff6b5f; }
    .blocker {
      color: white; background: var(--red); border-radius: 26px; padding: 28px;
      display: grid; grid-template-columns: 1fr 1fr; gap: 28px;
    }
    .blocker .eyebrow { color: rgba(255,255,255,.58); }
    .blocker p { color: rgba(255,255,255,.78); }
    .improvements { display: grid; gap: 12px; counter-reset: fixes; }
     .fix {
       counter-increment: fixes; display: grid; grid-template-columns: 64px minmax(0,1fr) 210px;
       gap: 22px; border-radius: 22px; padding: 24px; background: var(--panel); border: 1px solid var(--line);
       box-shadow: 0 12px 30px rgba(28,39,70,.05);
       align-items: start;
       transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
     }
     .fix:hover { transform: translateX(5px); border-color: #c9d2e4; box-shadow: 0 18px 38px rgba(28,39,70,.1); }
     .fix > div { min-width: 0; }
     .fix::before {
       content: counter(fixes, decimal-leading-zero); width: 46px; height: 46px; display: grid; place-items: center;
       border-radius: 14px; background: #fff0ed; color: var(--orange); font-size: 18px; font-weight: 900;
       letter-spacing: -.04em;
     }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
    .chip { padding: 5px 8px; border: 1px solid var(--line); border-radius: 99px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; }
     .fix-side { color: var(--muted); font-size: 12px; overflow-wrap: anywhere; border-left: 1px solid var(--line); padding-left: 18px; }
     .fix-side strong { color: var(--ink); }
     .rewrite { background: rgba(255,255,255,.42); padding: 8px; border-radius: 24px; }
    .rewrite { display: grid; grid-template-columns: 130px 1fr 1fr; gap: 12px; align-items: stretch; }
    .before, .after { border-radius: 18px; padding: 20px; border: 1px solid var(--line); }
    .before { background: #eee9e0; color: #67625c; }
    .after { background: #e1f1e9; color: #125c43; }
    .plan { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 12px; }
    .plan-card { min-height: 230px; display: flex; flex-direction: column; }
    .plan-card .done { margin-top: auto; padding-top: 20px; color: var(--muted); font-size: 12px; }
     .experiment { color: white; background: linear-gradient(135deg, #171b35, #43358b); border-radius: 28px; padding: clamp(26px,4vw,46px); box-shadow: 0 24px 50px rgba(37,30,89,.2); }
     .experiment h3 { font-size: clamp(30px,4vw,52px); max-width: 820px; letter-spacing: -.04em; }
    .source-list { display: grid; gap: 9px; }
     .source-list a { overflow-wrap: anywhere; }
     footer { padding: 36px clamp(30px,7vw,92px); color: var(--muted); font-size: 12px; }
     .diagnostics > *, .journey > *, .improvements > *, .plan > * { animation: rise-in .6s ease both; }
     .diagnostics > *:nth-child(2), .journey > *:nth-child(2), .improvements > *:nth-child(2), .plan > *:nth-child(2) { animation-delay: .06s; }
     .diagnostics > *:nth-child(3), .journey > *:nth-child(3), .improvements > *:nth-child(3), .plan > *:nth-child(3) { animation-delay: .12s; }
     .diagnostics > *:nth-child(4), .journey > *:nth-child(4), .improvements > *:nth-child(4), .plan > *:nth-child(4) { animation-delay: .18s; }
     @media (prefers-reduced-motion: reduce) {
       *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
     }
    @media (max-width: 980px) {
       .layout { display: block; } aside { position: relative; height: auto; } nav { display: none; } .hero-orbit { right: -110px; opacity: .45; }
      header::after { opacity: .22; font-size: 320px; }
      .section-head { grid-template-columns: 1fr; gap: 8px; }
      .span-3,.span-4,.span-5,.span-6,.span-7,.span-8 { grid-column: span 12; }
      .verdict,.blocker { grid-template-columns: 1fr; }
      .dimension { grid-template-columns: 1fr 52px; }
      .dimension > div:nth-child(2) { grid-column: 1 / -1; grid-row: 2; }
      .fix { grid-template-columns: 42px 1fr; } .fix-side { grid-column: 2; }
      .rewrite { grid-template-columns: 1fr; }
    }
    @media print {
      aside { display: none; } .layout { display: block; }
      header { min-height: 0; } header::after { opacity: .12; }
      section,.card,.blocker,.fix,.stage,.plan-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside>
       <div class="mark">LA</div>
      <div>
        <div class="side-name">LaunchAudit</div>
        <div class="eyebrow" style="margin-top:10px">${esc(startup.name)}</div>
      </div>
      <nav>
        <a href="#diagnosis">Diagnosis</a>
        <a href="#startup">Reconstructed startup</a>
        <a href="#scorecard">Scorecard</a>
        <a href="#journey">Journey</a>
        <a href="#blockers">Blockers</a>
        <a href="#fixes">Improvements</a>
        <a href="#plan">Seven-day plan</a>
        <a href="#retest">Retest</a>
      </nav>
      <div class="side-foot">${esc(meta.generated_at)} · ${esc(meta.mode)} audit</div>
    </aside>
    <main>
      <header>
        <div class="hero-orbit" aria-hidden="true"><div class="hero-orbit-core">LA</div><div class="hero-orbit-node">CTA</div><div class="hero-orbit-node">TRUST</div><div class="hero-orbit-node">UX</div><div class="hero-orbit-node">GROW</div></div>
        <div>
          <div class="eyebrow">Launch-readiness diagnostic</div>
          <h1>${esc(startup.name)}</h1>
          <p class="lede">${esc(startup.appears_to_be)}</p>
        </div>
        <div class="hero-meta">
          <div><span class="eyebrow">Tested</span><strong>${link(meta.tested_url)}</strong></div>
          <div><span class="eyebrow">Mode</span><strong>${esc(meta.mode)}</strong></div>
          <div><span class="eyebrow">Generated</span><strong>${esc(meta.generated_at)}</strong></div>
        </div>
      </header>

      <section id="diagnosis">
        <div class="verdict">
          <div>
            <div class="eyebrow" style="color:rgba(255,255,255,.56)">Diagnosis</div>
            <h2>${esc(verdict.label)}</h2>
            <p style="margin-top:22px">${esc(verdict.summary)}</p>
            <div class="grid" style="margin-top:34px">
              ${darkMetric("Strongest asset", verdict.strongest_asset)}
              ${darkMetric("Biggest risk", verdict.biggest_risk)}
              ${darkMetric("Ready when", verdict.retest_condition, "span-12")}
            </div>
          </div>
          <div>
            <div class="score-ring">
              <div class="score-value">${verdict.score}<small>Readiness</small></div>
            </div>
            <div class="coverage">${verdict.coverage}% evidence coverage</div>
          </div>
        </div>
      </section>

      <section id="startup">
        ${sectionHead("01", "What this startup appears to be")}
        <div class="grid">
          ${card("Audience", startup.audience, "span-6")}
          ${card("Problem", startup.problem, "span-6")}
          ${card("Promise", startup.promise, "span-4")}
          ${card("Mechanism", startup.mechanism, "span-4")}
          ${card("Primary action", startup.primary_action, "span-4")}
          ${card("Current alternative", startup.alternative, "span-6")}
          ${listCard("Evidence notes", startup.evidence_notes, "span-6", "evidence-list")}
        </div>
      </section>

      <section id="scorecard">
        ${sectionHead("02", "Diagnostic scorecard")}
        <div class="diagnostics">
          ${dimensions.map(dimensionRow).join("")}
        </div>
      </section>

      <section id="journey">
        ${sectionHead("03", "Primary journey")}
        <div class="journey">
          ${journey.map(journeyStage).join("")}
        </div>
      </section>

      <section id="blockers">
        ${sectionHead("04", blockers.length ? "Critical launch blockers" : "No critical blockers observed")}
        ${blockers.length
          ? blockers.map(blockerCard).join('<div style="height:12px"></div>')
          : `<div class="card"><p>No observed issue currently meets the critical-blocker definition. High-priority improvements may still be required before launch.</p></div>`}
      </section>

      <section id="fixes">
        ${sectionHead("05", "What to improve, in order")}
        <div class="improvements">
          ${improvements.map(improvementCard).join("")}
        </div>
        ${rewrites.length ? `<div style="height:52px"></div><div class="eyebrow" style="margin-bottom:16px">Exact rewrites</div><div class="diagnostics">${rewrites.map(rewriteCard).join("")}</div>` : ""}
      </section>

      <section id="plan">
        ${sectionHead("06", "Seven-day repair plan")}
        <div class="plan">
          ${plan.map(planCard).join("")}
        </div>
      </section>

      <section id="retest">
        ${sectionHead("07", "Retest and launch")}
        <div class="grid">
          ${listCard("Strengths to preserve", validation.strengths, "span-6")}
          ${listCard("Still unknown", validation.unknowns, "span-6")}
          ${listCard("Retest checklist", validation.retest, "span-6")}
          ${listCard("Limits", validation.limitations, "span-6")}
        </div>
        ${validation.experiment ? experimentCard(validation.experiment) : ""}
        ${validation.legal_note ? `<div class="card" style="margin-top:14px"><div class="eyebrow">Preliminary note</div><p>${esc(validation.legal_note)}</p></div>` : ""}
        ${sources.length ? `<div style="margin-top:44px"><div class="eyebrow" style="margin-bottom:14px">Sources inspected</div><div class="source-list">${sources.map(sourceCard).join("")}</div></div>` : ""}
      </section>

      <footer>Generated with LaunchAudit. This is a structured launch-readiness audit, not proof of product-market fit, legal compliance, security, or future conversion.</footer>
    </main>
  </div>
</body>
</html>`;
  return report.replace("</head>", `<style>${PREMIUM_CSS}</style></head>`).replace("</body>", `${PREMIUM_SCRIPT}</body>`);
}
  */
}

function renderPremiumReport(data) {
  const { meta, startup, verdict, dimensions, journey, blockers, improvements, rewrites, plan, validation, sources } = data;
  const titleWords = String(startup.name || "LaunchAudit").split(/\s+/).filter(Boolean);
  const firstWord = esc(titleWords[0] || "Launch");
  const restWords = esc(titleWords.slice(1).join(" ") || "Audit");
  const readinessPercent = Math.max(0, Math.min(100, Number(verdict.score) || 0));
  const circumference = 257.6;
  const dashOffset = (circumference * (100 - readinessPercent)) / 100;
  const severityClass = (severity) => String(severity || "").toLowerCase().startsWith("crit") ? "c-crit" : String(severity || "").toLowerCase().startsWith("high") ? "c-high" : "c-med";
  const dimensionMarkup = dimensions.map((dimension, index) => {
    const score = dimension.score === null ? 0 : dimension.score * 20;
    const tone = dimension.score === null ? "var(--faint)" : dimension.score >= 4 ? "var(--green)" : dimension.score >= 3 ? "var(--amber)" : "var(--red)";
    return `<article class="dimension reveal" style="--d:${index * 0.05}s"><div class="dim-top"><div class="dimension-name">${esc(dimension.name)}</div><div class="dim-meta">${dimension.weight}% weight · ${esc(dimension.status || "Scored")}</div></div><div class="dim-mid"><div class="track"><div class="fill" style="--w:${score}%;--c:${tone}"></div></div><div class="dim-note"><strong>${esc(dimension.finding || "No finding recorded.")}</strong> ${esc(dimension.evidence || "")}</div>${dimension.recommendation ? `<div class="dim-note next"><strong>Next</strong> ${esc(dimension.recommendation)}</div>` : ""}</div><div class="dim-score">${dimension.score === null ? "—" : dimension.score}<small>/5</small></div></article>`;
  }).join("");
  const journeyMarkup = journey.map((stage, index) => `<article class="stage st-${esc(stage.state)} reveal" style="--d:${index * 0.05}s"><div class="stage-top"><span class="stage-num">${String(index + 1).padStart(2, "0")}</span><span class="state state-${esc(stage.state)}">${esc(stage.state)}</span></div><h3>${esc(stage.stage)}</h3><p>${esc(stage.observation)}</p>${stage.consequence ? `<p><strong>Impact:</strong> ${esc(stage.consequence)}</p>` : ""}${stage.fix ? `<p><strong>Next:</strong> ${esc(stage.fix)}</p>` : ""}</article>`).join("");
  const blockerMarkup = blockers.map((blocker) => `<article class="blocker reveal"><span class="b-tag">CRITICAL</span><div><div class="eyebrow">Observed blocker</div><h3>${esc(blocker.title)}</h3><p>${esc(blocker.evidence)}</p></div><div><div class="eyebrow">Required correction</div><p><strong>Consequence:</strong> ${esc(blocker.consequence)}</p><p><strong>Fix:</strong> ${esc(blocker.fix)}</p><p><strong>Retest:</strong> ${esc(blocker.retest)}</p></div></article>`).join('<div style="height:14px"></div>');
  const fixesMarkup = improvements.map((fix, index) => `<article class="fix reveal" style="--d:${index * 0.05}s"><div class="fix-num">${String(index + 1).padStart(2, "0")}</div><div class="fix-body"><div class="chips"><span class="chip ${severityClass(fix.severity)}">${esc(fix.severity)}</span><span class="chip">${esc(fix.effort)} effort</span><span class="chip">${esc(fix.confidence)} confidence</span></div><h3>${esc(fix.title)}</h3><p>${esc(fix.change)}</p></div><div class="fix-side"><p><strong>Evidence</strong>${esc(fix.evidence)}</p><p><strong>Why it matters</strong>${esc(fix.consequence)}</p><p><strong>Validate</strong>${esc(fix.validation)}</p></div></article>`).join("");
  const planMarkup = plan.map((item, index) => `<article class="plan-card reveal" style="--d:${index * 0.06}s"><div class="plan-day">${esc(item.when)}</div><h3>${esc(item.focus)}</h3><ul class="plain-list">${array(item.actions).map((action) => `<li>${esc(action)}</li>`).join("")}</ul><p class="done"><strong>Done when</strong>${esc(item.done_when)}</p></article>`).join("");
  const sourceMarkup = sources.map((source) => `<div class="card reveal"><strong>${esc(source.label)}</strong><span class="desc">${esc(source.note)}</span>${link(source.url)}</div>`).join("");
  const experimentMarkup = validation.experiment ? `<div class="frame experiment reveal"><div class="eyebrow">Smallest measurable launch experiment</div><h3>${esc(validation.experiment.hypothesis)}</h3><div class="grid"><div class="span-4 cell"><strong>Change</strong><p>${esc(validation.experiment.change)}</p></div><div class="span-4 cell"><strong>Measure</strong><p>${esc(validation.experiment.measure)}</p></div><div class="span-4 cell"><strong>Success signal</strong><p>${esc(validation.experiment.success_signal)}</p></div></div></div>` : "";
  const section = (index, label, heading, body, id) => `<section id="${id}"><div class="watermark">${esc(index)}</div><div class="section-head"><div class="idx">${esc(index)} / ${esc(label)}</div><h2>${esc(heading)}</h2></div>${body}</section>`;
  const report = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='4' y='4' width='56' height='56' rx='14' fill='%2306060a'/%3E%3Cpath d='M20 16v30h20' fill='none' stroke='%23d7ff3f' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M33 46l9-28 11 28M37 36h10' fill='none' stroke='%234de3ff' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"><title>${esc(meta.title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet"></head><body>
<div class="grain" aria-hidden="true"></div><div class="progress" id="progress" aria-hidden="true"></div><div class="cursor-dot" id="cDot" aria-hidden="true"></div><div class="cursor-ring" id="cRing" aria-hidden="true"></div>
<div class="layout"><aside><div class="brand"><div class="mark">LA</div><div><div class="side-name">LaunchAudit</div><div class="side-sub">${esc(startup.name)}</div></div></div><nav id="nav"><a href="#diagnosis"><span>◆</span>Diagnosis</a><a href="#startup"><span>01</span>Reconstructed startup</a><a href="#scorecard"><span>02</span>Scorecard</a><a href="#journey"><span>03</span>Journey</a><a href="#blockers"><span>04</span>Blockers</a><a href="#fixes"><span>05</span>Improvements</a><a href="#plan"><span>06</span>Seven-day plan</a><a href="#retest"><span>07</span>Retest</a></nav><button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle color theme"><span>THEME</span><span>◐</span></button><div class="side-foot"><b>${esc(meta.generated_at)}</b><br>${esc(meta.mode)} audit</div></aside><main>
<header><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><canvas id="fx" aria-hidden="true"></canvas><div class="hero-inner"><div class="hero-eyebrow h-fade" style="--d:.15s">Launch-readiness diagnostic</div><h1 aria-label="${esc(startup.name)}"><span class="line"><span class="line-inner" style="--d:.25s">${firstWord}</span></span><span class="line"><span class="line-inner outline" style="--d:.37s">${restWords}</span></span></h1><p class="lede h-fade" style="--d:.62s">${esc(startup.appears_to_be)}</p><div class="hero-meta h-fade" style="--d:.74s"><div><span class="eyebrow">Tested</span><strong>${link(meta.tested_url)}</strong></div><div><span class="eyebrow">Mode</span><strong>${esc(meta.mode)}</strong></div><div><span class="eyebrow">Generated</span><strong>${esc(meta.generated_at)}</strong></div></div></div><div class="scroll-hint h-fade" style="--d:1s">Scroll</div><div class="ticker"><div class="ticker-track"><span>Launch-readiness diagnostic<b>✦</b></span><span>Readiness score ${readinessPercent}/100<b>✦</b></span><span>${blockers.length} critical blockers<b>✦</b></span><span>${improvements.length} prioritized fixes<b>✦</b></span><span>7-day repair plan<b>✦</b></span><span>${verdict.coverage}% evidence coverage<b>✦</b></span><span>Launch-readiness diagnostic<b>✦</b></span><span>Readiness score ${readinessPercent}/100<b>✦</b></span><span>${blockers.length} critical blockers<b>✦</b></span><span>${improvements.length} prioritized fixes<b>✦</b></span><span>7-day repair plan<b>✦</b></span><span>${verdict.coverage}% evidence coverage<b>✦</b></span></div></div></header>
<section id="diagnosis"><div class="watermark">00</div><div class="section-head"><div class="idx">00 / DIAGNOSIS</div><h2>Launch after critical fixes</h2></div><div class="frame verdict reveal"><div><div class="eyebrow">The call</div><h2><em>Fix the promise</em> before you amplify it.</h2><p class="lede2">${esc(verdict.summary)}</p><div class="grid mini"><div class="cell"><div class="eyebrow">Strongest asset</div><p>${esc(verdict.strongest_asset)}</p></div><div class="cell"><div class="eyebrow">Biggest risk</div><p>${esc(verdict.biggest_risk)}</p></div><div class="cell span-12"><div class="eyebrow">Ready when</div><p>${esc(verdict.retest_condition)}</p></div></div></div><div class="score-col"><div class="score-wrap"><svg class="ring" viewBox="0 0 100 100"><defs><linearGradient id="rg"><stop stop-color="#d7ff3f"/><stop offset="1" stop-color="#4de3ff"/></linearGradient></defs><circle class="ring-bg" cx="50" cy="50" r="41"/><circle class="ring-fg" cx="50" cy="50" r="41" stroke-dasharray="257.6" stroke-dashoffset="${(257.6 * (100 - readinessPercent)) / 100}"/></svg><div class="score-value">${readinessPercent}<small>Readiness</small></div></div><div class="coverage"><b>${verdict.coverage}%</b> evidence coverage</div></div></div></section>
${section("01", "RECONSTRUCT", "What this startup appears to be", `<div class="grid">${card("Audience", startup.audience, "span-6 reveal spot")}${card("Problem", startup.problem, "span-6 reveal spot")}${card("Promise", startup.promise, "span-4 reveal spot")}${card("Mechanism", startup.mechanism, "span-4 reveal spot")}${card("Primary action", startup.primary_action, "span-4 reveal spot")}${card("Current alternative", startup.alternative, "span-6 reveal spot")}${listCard("Evidence notes", startup.evidence_notes, "span-6 reveal", "plain-list")}</div>`, "startup")}
${section("02", "SCORECARD", "Where the launch signal is strong — and where it breaks", `<div class="diagnostics">${dimensionMarkup}</div>`, "scorecard")}
${section("03", "JOURNEY", "The primary visitor journey", `<div class="journey">${journeyMarkup}</div>`, "journey")}
${section("04", "BLOCKERS", blockers.length ? "Two things stop a confident enrollment" : "No critical blockers observed", blockers.length ? blockerMarkup : `<div class="card"><p>No observed issue currently meets the critical-blocker definition.</p></div>`, "blockers")}
${section("05", "FIXES", "What to improve, in order", `<div class="improvements">${fixesMarkup}</div>`, "fixes")}
${section("06", "REPAIR PLAN", "Seven days to a safer launch", `<div class="plan">${planMarkup}</div>`, "plan")}
${section("07", "RETEST", "Retest, then make the smallest measurable move", `${listCard("Strengths to preserve", validation.strengths, "card span-6 reveal", "plain-list")}${listCard("Still unknown", validation.unknowns, "card span-6 reveal", "plain-list")}${listCard("Limits", validation.limitations, "card span-6 reveal", "plain-list")}${experimentMarkup}${sources.length ? `<div class="sub-label">Sources inspected</div><div class="source-list">${sourceMarkup}</div>` : ""}`, "retest")}
<footer><span>Generated with <b>LaunchAudit</b>.</span><span>Public evidence review · not proof of product-market fit, legal compliance, or future conversion.</span></footer></main></div></body></html>`;
  return report.replace("</head>", `<style>${PREMIUM_CSS}</style></head>`).replace("</body>", `${PREMIUM_SCRIPT}</body>`);
}

function sectionHead(index, title) {
  return `<div class="section-head"><div class="eyebrow">${esc(index)}</div><h2>${esc(title)}</h2></div>`;
}

function card(label, value, span = "span-4") {
  return `<div class="card ${span}"><div class="eyebrow">${esc(label)}</div><p>${esc(value || "Unknown")}</p></div>`;
}

function listCard(label, values, span = "span-6", className = "plain-list") {
  const items = array(values);
  return `<div class="card ${span}"><div class="eyebrow">${esc(label)}</div>${items.length
    ? `<ul class="${className}">${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
    : "<p>None recorded.</p>"}</div>`;
}

function darkMetric(label, value, span = "span-6") {
  return `<div class="${span}"><div class="eyebrow" style="color:rgba(255,255,255,.48)">${esc(label)}</div><p>${esc(value || "—")}</p></div>`;
}

function dimensionRow(dimension) {
  const percent = dimension.score === null ? 0 : dimension.score * 20;
  const tone = dimension.score === null ? "unknown" : dimension.score >= 4 ? "good" : dimension.score >= 3 ? "warn" : "bad";
  return `<article class="dimension">
    <div>
      <div class="dimension-name">${esc(dimension.name)}</div>
      <div class="dim-note">${dimension.weight}% weight · ${esc(dimension.status || (dimension.score === null ? "Unknown" : "Scored"))}</div>
    </div>
    <div>
      <div class="track"><div class="fill" style="width:${percent}%;background:${toneColor(tone)}"></div></div>
      <div class="dim-note"><strong>${esc(dimension.finding || "")}</strong> ${esc(dimension.evidence || "")}</div>
      ${dimension.recommendation ? `<div class="dim-note" style="margin-top:5px">Next: ${esc(dimension.recommendation)}</div>` : ""}
    </div>
    <div class="dim-score">${dimension.score === null ? "—" : `${dimension.score}/5`}</div>
  </article>`;
}

function journeyStage(stage) {
  return `<article class="stage">
    <div class="state state-${esc(stage.state)}">${esc(stage.state)}</div>
    <h3>${esc(stage.stage)}</h3>
    <p>${esc(stage.observation)}</p>
    ${stage.consequence ? `<p style="margin-top:12px"><strong>Impact:</strong> ${esc(stage.consequence)}</p>` : ""}
    ${stage.fix ? `<p style="margin-top:12px"><strong>Next:</strong> ${esc(stage.fix)}</p>` : ""}
  </article>`;
}

function blockerCard(blocker) {
  return `<article class="blocker">
    <div>
      <div class="eyebrow">Observed blocker</div>
      <h3>${esc(blocker.title)}</h3>
      <p>${esc(blocker.evidence)}</p>
    </div>
    <div>
      <div class="eyebrow">Required correction</div>
      <p><strong>Consequence:</strong> ${esc(blocker.consequence)}</p>
      <p style="margin-top:12px"><strong>Fix:</strong> ${esc(blocker.fix)}</p>
      <p style="margin-top:12px"><strong>Retest:</strong> ${esc(blocker.retest)}</p>
    </div>
  </article>`;
}

function improvementCard(fix) {
  return `<article class="fix">
     <div>
      <div class="chips">
        <span class="chip">${esc(fix.severity)}</span>
        <span class="chip">${esc(fix.effort)} effort</span>
        <span class="chip">${esc(fix.confidence)} confidence</span>
      </div>
      <h3>${esc(fix.title)}</h3>
      <p>${esc(fix.change)}</p>
    </div>
    <div class="fix-side">
      <p><strong>Evidence</strong><br>${esc(fix.evidence)}</p>
      <p style="margin-top:12px"><strong>Why it matters</strong><br>${esc(fix.consequence)}</p>
      <p style="margin-top:12px"><strong>Validate</strong><br>${esc(fix.validation)}</p>
    </div>
  </article>`;
}

function rewriteCard(rewrite) {
  return `<article class="rewrite">
    <div class="card"><div class="eyebrow">${esc(rewrite.location)}</div><p>${esc(rewrite.reason)}</p></div>
    <div class="before"><div class="eyebrow">Before</div><p>${esc(rewrite.before)}</p></div>
    <div class="after"><div class="eyebrow">After</div><p>${esc(rewrite.after)}</p></div>
  </article>`;
}

function planCard(item) {
  return `<article class="card plan-card">
    <div class="eyebrow">${esc(item.when)}</div>
    <h3>${esc(item.focus)}</h3>
    <ul class="plain-list">${array(item.actions).map((action) => `<li>${esc(action)}</li>`).join("")}</ul>
    <p class="done"><strong>Done when:</strong> ${esc(item.done_when)}</p>
  </article>`;
}

function experimentCard(experiment) {
  return `<article class="experiment" style="margin-top:14px">
    <div class="eyebrow" style="color:rgba(255,255,255,.62)">Smallest measurable launch experiment</div>
    <h3>${esc(experiment.hypothesis)}</h3>
    <div class="grid" style="margin-top:24px">
      <div class="span-4"><strong>Change</strong><p>${esc(experiment.change)}</p></div>
      <div class="span-4"><strong>Measure</strong><p>${esc(experiment.measure)}</p></div>
      <div class="span-4"><strong>Success signal</strong><p>${esc(experiment.success_signal)}</p></div>
    </div>
  </article>`;
}

function sourceCard(source) {
  return `<div class="card"><strong>${esc(source.label)}</strong> — ${esc(source.note)}<br>${link(source.url)}</div>`;
}

function toneForVerdict(label) {
  if (label === "Ready to launch") return { background: "#125c43" };
  if (label === "Launch after critical fixes") return { background: "#6e3e00" };
  return { background: "#781f26" };
}

function toneColor(tone) {
  return tone === "good" ? "#36c58a" : tone === "warn" ? "#ffb33f" : tone === "bad" ? "#ff6b5f" : "#8f8a82";
}

function link(url) {
  if (!url) return "—";
  const safe = esc(url);
  return /^https?:\/\//i.test(url)
    ? `<a href="${safe}" rel="noreferrer">${safe}</a>`
    : safe;
}

function array(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function main() {
  const [, , inputPath, outputPath] = process.argv;

  if (!inputPath || !outputPath) {
    console.error("Usage: node scripts/generate_report.mjs <input.json> <output.html>");
    process.exit(1);
  }

  const data = JSON.parse(await readFile(inputPath, "utf8"));
  const errors = validateReport(data);

  if (errors.length) {
    console.error(`Invalid launch report:\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }

  const output = path.resolve(outputPath);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderReport(data), "utf8");
  console.log(`LaunchAudit report created: ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
