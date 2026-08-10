#!/usr/bin/env python3
"""Generate the StartupBlueprint HTML report and 90-day CSV roadmap."""

from __future__ import annotations

import argparse
import csv
import html
import json
from pathlib import Path
from typing import Any


def load_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.expanduser().read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("Prepared analysis must be a JSON object")
    return value


def text(value: Any, fallback: str = "Not supplied") -> str:
    if value in (None, ""):
        return fallback
    return " ".join(str(value).replace("\r", " ").replace("\n", " ").split())


def esc(value: Any, fallback: str = "Not supplied") -> str:
    return html.escape(text(value, fallback))


def money(value: Any, currency: str, fallback: str = "Unknown") -> str:
    if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
        return fallback
    symbols = {"USD": "$", "EUR": "€", "GBP": "£", "INR": "₹"}
    return f"{symbols.get(currency.upper(), currency + ' ')}{value:,.2f}".rstrip("0").rstrip(".")


def number(value: Any, fallback: str = "Unknown") -> str:
    if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
        return fallback
    return f"{value:,.1f}".rstrip("0").rstrip(".")


def percent(value: Any, fallback: str = "Unknown") -> str:
    if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
        return fallback
    return f"{value * 100:.1f}%"


def items(values: Any, empty: str = "No items supplied.") -> str:
    if not isinstance(values, list) or not values:
        return f"<li>{esc(empty)}</li>"
    return "".join(f"<li>{esc(value)}</li>" for value in values)


def card(label: str, value: Any, class_name: str = "") -> str:
    return f'<article class="card {class_name}"><span class="label">{esc(label)}</span><p>{esc(value)}</p></article>'


def table_rows(rows: list[list[Any]]) -> str:
    return "".join("<tr>" + "".join(f"<td>{esc(cell)}</td>" for cell in row) + "</tr>" for row in rows)


def render_report(analysis: dict[str, Any]) -> str:
    product = analysis.get("product") if isinstance(analysis.get("product"), dict) else {}
    strategy = analysis.get("strategy") if isinstance(analysis.get("strategy"), dict) else {}
    model = analysis.get("business_model") if isinstance(analysis.get("business_model"), dict) else {}
    icp = strategy.get("icp") if isinstance(strategy.get("icp"), dict) else {}
    market = strategy.get("market") if isinstance(strategy.get("market"), dict) else {}
    positioning = strategy.get("positioning") if isinstance(strategy.get("positioning"), dict) else {}
    go_to_market = strategy.get("go_to_market") if isinstance(strategy.get("go_to_market"), dict) else {}
    pricing = analysis.get("pricing") if isinstance(analysis.get("pricing"), dict) else {}
    metrics = analysis.get("key_metrics") if isinstance(analysis.get("key_metrics"), dict) else {}
    market_sizing = analysis.get("market_sizing") if isinstance(analysis.get("market_sizing"), dict) else {}
    currency = text(product.get("currency"), text(pricing.get("currency"), "USD"))
    score = analysis.get("readiness_score")
    score_number = number(score, "0")
    score_percent = number(score, "0")
    status = text(analysis.get("analysis_status"))
    verdict = text(analysis.get("financial_verdict"))
    primary = next((item for item in analysis.get("monetization_candidates", []) if isinstance(item, dict) and item.get("verdict") == "PRIMARY"), {})
    base_tier = next((item for item in pricing.get("tiers", []) if isinstance(item, dict) and item.get("tier_type") == "paid"), {})
    title = f"{text(product.get('name'), 'Startup')} · StartupBlueprint"
    url = text(product.get("url"), "")
    source_rows = [
        [source.get("title"), source.get("kind"), source.get("checked_at"), source.get("note")]
        for source in analysis.get("sources", []) if isinstance(source, dict)
    ]
    competitor_rows = [
        [item.get("name"), item.get("target_segment"), item.get("model"), item.get("visible_pricing")]
        for item in analysis.get("competitors", []) if isinstance(item, dict)
    ]
    scenario_rows = [
        [str(item.get("name", "")).title(), money(item.get("full_year_revenue"), currency), money(item.get("full_year_operating_profit"), currency), number(item.get("ending_paid_customers"))]
        for item in analysis.get("scenario_summaries", []) if isinstance(item, dict)
    ]
    readiness_rows = [
        [str(item.get("dimension", "")).replace("_", " ").title(), f"{item.get('applied_raw_score', '—')}/5", item.get("evidence_strength"), item.get("cap_reason", "—")]
        for item in analysis.get("readiness_breakdown", []) if isinstance(item, dict)
    ]
    tier_cards = "".join(
        f'<article class="tier"><span class="label">{esc(tier.get("name"))}</span><strong>{esc(money(tier.get("monthly_price"), currency))}<small>/month</small></strong><p>{esc(tier.get("limits"))}</p><span class="tier-trigger">Upgrade: {esc(tier.get("upgrade_trigger"))}</span></article>'
        for tier in pricing.get("tiers", []) if isinstance(tier, dict)
    )
    roadmap = "".join(
        f'<article class="roadmap-step"><span class="step-number">{index:02d}</span><div><span class="label">Days {esc(item.get("start_day"))}–{esc(item.get("end_day"))} · {esc(item.get("phase"))}</span><h3>{esc(item.get("objective"))}</h3><p>{esc(item.get("action"))}</p><span class="step-meta">Metric: {esc(item.get("metric"))}</span></div></article>'
        for index, item in enumerate(analysis.get("roadmap", []), 1) if isinstance(item, dict)
    )
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#11152a"><title>{esc(title)}</title>
  <style>
    :root {{ --ink:#11152a; --muted:#66708a; --paper:#f3f6fb; --card:#fff; --line:#e2e7f0; --violet:#8874f4; --cyan:#22c9df; --orange:#ff684d; --green:#16a47b; --shadow:0 18px 50px rgba(17,21,42,.08); }}
    * {{ box-sizing:border-box; }} html {{ scroll-behavior:smooth; }} body {{ margin:0; color:var(--ink); background:radial-gradient(circle at 80% 0,#e8e5ff,transparent 32%),var(--paper); font:15px/1.55 Inter,ui-sans-serif,Segoe UI,sans-serif; }}
    @keyframes enter {{ from {{ opacity:0; transform:translateY(18px); }} to {{ opacity:1; transform:none; }} }} @keyframes pulse {{ 50% {{ box-shadow:0 0 0 10px rgba(34,201,223,0); }} }}
    .shell {{ display:grid; grid-template-columns:250px minmax(0,1fr); min-height:100vh; }} aside {{ position:sticky; top:0; height:100vh; padding:28px 22px; color:#fff; background:linear-gradient(180deg,#11152a,#1a2040); }}
    .logo {{ display:grid; place-items:center; width:50px; height:50px; border-radius:16px; color:#11152a; font-weight:950; background:linear-gradient(135deg,#b49cff,#22c9df); animation:pulse 3.5s ease-in-out infinite; }} .brand {{ margin-top:18px; font-size:20px; font-weight:900; letter-spacing:-.04em; }} .subbrand {{ margin-top:7px; color:#aeb7d0; font-size:11px; letter-spacing:.14em; text-transform:uppercase; font-weight:800; }}
    nav {{ display:grid; gap:5px; margin-top:42px; }} nav a {{ padding:9px 10px; color:#b7bfd5; text-decoration:none; border-radius:10px; font-size:13px; }} nav a:hover {{ color:#fff; background:rgba(255,255,255,.1); }} .aside-foot {{ position:absolute; bottom:24px; color:#8f9ab7; font-size:11px; }}
    main {{ min-width:0; }} .hero {{ position:relative; overflow:hidden; min-height:70vh; padding:clamp(48px,8vw,110px); display:flex; align-items:end; border-bottom:1px solid var(--line); animation:enter .7s ease both; }} .hero:after {{ content:""; position:absolute; width:460px; height:460px; right:-120px; top:-170px; border-radius:50%; background:linear-gradient(135deg,rgba(136,116,244,.38),rgba(34,201,223,.08)); filter:blur(8px); }}
    .hero-content {{ position:relative; z-index:1; max-width:930px; }} .kicker,.label {{ display:block; color:var(--muted); font-size:10px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }} .kicker {{ color:var(--orange); }} h1 {{ max-width:1000px; margin:18px 0; font-size:clamp(50px,8vw,112px); line-height:.9; letter-spacing:-.075em; }} .hero-summary {{ max-width:730px; color:var(--muted); font-size:clamp(18px,2vw,25px); }} .meta-row {{ display:flex; flex-wrap:wrap; gap:10px; margin-top:38px; }} .meta-pill {{ padding:12px 15px; border:1px solid var(--line); border-radius:14px; background:rgba(255,255,255,.7); box-shadow:0 8px 20px rgba(28,39,70,.04); }} .meta-pill strong {{ display:block; margin-top:3px; font-size:13px; overflow-wrap:anywhere; }}
    section {{ padding:clamp(54px,7vw,96px); border-bottom:1px solid var(--line); animation:enter .7s ease both; }} section:nth-of-type(even) {{ background:rgba(255,255,255,.42); }} .section-head {{ display:grid; grid-template-columns:80px minmax(0,1fr); gap:20px; margin-bottom:38px; }} .section-number {{ color:var(--orange); font-weight:900; letter-spacing:.1em; padding-top:9px; }} h2 {{ max-width:850px; margin:0; font-size:clamp(38px,5vw,68px); line-height:.96; letter-spacing:-.06em; }} h3 {{ margin:0 0 8px; font-size:21px; line-height:1.1; letter-spacing:-.03em; }} p {{ margin:0; }}
    .grid {{ display:grid; grid-template-columns:repeat(12,1fr); gap:14px; }} .span-4 {{ grid-column:span 4; }} .span-6 {{ grid-column:span 6; }} .span-8 {{ grid-column:span 8; }} .span-12 {{ grid-column:span 12; }} .card,.tier,.roadmap-step {{ min-width:0; padding:24px; border:1px solid var(--line); border-radius:20px; background:rgba(255,255,255,.86); box-shadow:0 12px 30px rgba(28,39,70,.05); transition:transform .25s ease,box-shadow .25s ease; }} .card:hover,.tier:hover,.roadmap-step:hover {{ transform:translateY(-4px); box-shadow:var(--shadow); }} .card p {{ margin-top:9px; font-size:16px; line-height:1.6; }}
    .decision {{ display:grid; grid-template-columns:minmax(0,1fr) 230px; gap:28px; padding:clamp(28px,5vw,54px); color:#fff; border-radius:28px; background:linear-gradient(135deg,#171b38,#51419c); box-shadow:0 25px 60px rgba(40,32,102,.2); }} .decision h2 {{ color:#fff; }} .decision-copy {{ color:#d9dcf0; font-size:17px; }} .score {{ display:grid; place-items:center; width:190px; height:190px; margin:auto; border-radius:50%; background:conic-gradient(var(--cyan) calc(var(--score)*1%),rgba(255,255,255,.14) 0); }} .score-inner {{ display:grid; place-items:center; width:156px; height:156px; border-radius:50%; background:#272358; color:#fff; font-size:52px; font-weight:900; }} .score-inner small {{ display:block; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:#aeb7d0; }}
    .metric-grid {{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:24px; }} .metric {{ padding:18px; border-radius:16px; background:rgba(255,255,255,.09); }} .metric strong {{ display:block; margin-top:6px; font-size:22px; }} .tier-grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }} .tier {{ border-top:3px solid var(--violet); }} .tier strong {{ display:block; margin:14px 0 8px; font-size:34px; letter-spacing:-.06em; }} .tier small {{ font-size:12px; color:var(--muted); letter-spacing:0; }} .tier-trigger,.step-meta {{ display:block; margin-top:16px; color:var(--muted); font-size:12px; }}
    .table-wrap {{ overflow:auto; border:1px solid var(--line); border-radius:18px; background:#fff; }} table {{ width:100%; border-collapse:collapse; min-width:620px; }} th,td {{ padding:14px 16px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }} th {{ color:var(--muted); background:#f7f8fc; font-size:10px; letter-spacing:.12em; text-transform:uppercase; }} tr:last-child td {{ border-bottom:0; }}
    .roadmap {{ display:grid; gap:12px; }} .roadmap-step {{ display:grid; grid-template-columns:52px 1fr; gap:18px; align-items:start; }} .step-number {{ display:grid; place-items:center; width:44px; height:44px; border-radius:14px; color:#fff; background:linear-gradient(135deg,var(--violet),var(--cyan)); font-weight:900; }} .risk {{ border-left:4px solid var(--orange); }} .sources {{ display:grid; gap:9px; }} .source {{ padding:15px 17px; border-radius:14px; background:#fff; border:1px solid var(--line); }} a {{ color:#5546b9; }} footer {{ padding:36px clamp(30px,7vw,96px); color:var(--muted); font-size:12px; }}
     @media(max-width:980px) {{ .shell {{ display:block; }} aside {{ position:relative; height:auto; min-height:190px; }} nav {{ display:none; }} .aside-foot {{ position:static; margin-top:28px; }} .hero {{ min-height:62vh; padding:48px 28px; }} section {{ padding:56px 28px; }} .decision {{ grid-template-columns:1fr; }} .score {{ margin:10px auto 0; }} .metric-grid {{ grid-template-columns:repeat(2,1fr); }} .span-4,.span-6,.span-8 {{ grid-column:span 12; }} .section-head {{ grid-template-columns:1fr; gap:8px; }} }}
    @media(prefers-reduced-motion:reduce) {{ *,*::before,*::after {{ animation-duration:.01ms!important; animation-iteration-count:1!important; transition-duration:.01ms!important; scroll-behavior:auto!important; }} }} @media print {{ aside {{ display:none; }} .shell {{ display:block; }} .hero {{ min-height:0; }} section,.card,.tier,.roadmap-step {{ break-inside:avoid; }} }}
  </style>
</head>
<body>
  <div class="shell"><aside><div class="logo">SB</div><div class="brand">StartupBlueprint</div><div class="subbrand">Business design system</div><nav><a href="#decision">Decision</a><a href="#market">Market</a><a href="#model">Business model</a><a href="#pricing">Pricing</a><a href="#economics">Economics</a><a href="#roadmap">90-day roadmap</a><a href="#evidence">Evidence</a></nav><div class="aside-foot">{esc(analysis.get("generated_at"))} · {esc(analysis.get("mode"))} mode</div></aside>
  <main><header class="hero"><div class="hero-content"><span class="kicker">Startup blueprint · decision report</span><h1>{esc(product.get("name"), "Your startup")}</h1><p class="hero-summary">{esc(product.get("summary"))}</p><div class="meta-row"><div class="meta-pill"><span class="label">Stage</span><strong>{esc(product.get("stage"))}</strong></div><div class="meta-pill"><span class="label">Primary buyer</span><strong>{esc(product.get("economic_buyer"))}</strong></div><div class="meta-pill"><span class="label">Source</span><strong>{esc(url, "Concept input")}</strong></div></div></div></header>
  <section id="decision"><div class="decision"><div><span class="kicker">Executive decision</span><h2>{esc(analysis.get("readiness_label"), "Plan readiness")}</h2><p class="decision-copy">Use <strong>{esc(pricing.get("recommended_model"))}</strong> as the primary model, led by <strong>{esc(base_tier.get("name"), "the first paid tier")}</strong> at <strong>{esc(money(base_tier.get("monthly_price"), currency))}/month</strong> as a testable price hypothesis. The current model is <strong>{esc(status)}</strong> and the base financial verdict is <strong>{esc(verdict)}</strong>.</p><div class="metric-grid"><div class="metric"><span class="label">First channel</span><strong>{esc(go_to_market.get("primary_channel"))}</strong></div><div class="metric"><span class="label">Break-even</span><strong>{esc(number(metrics.get("break_even_paid_customers")))}</strong></div><div class="metric"><span class="label">Base revenue</span><strong>{esc(money(metrics.get("full_year_revenue"), currency))}</strong></div><div class="metric"><span class="label">Primary model</span><strong>{esc(primary.get("name"), "Not selected")}</strong></div></div></div><div class="score" style="--score:{esc(score_percent, '0')}"><div class="score-inner">{esc(score_number, '0')}<small>readiness / 100</small></div></div></div></section>
  <section id="market"><div class="section-head"><span class="section-number">01</span><h2>Who this is for, and why now</h2></div><div class="grid">{card("Core problem", product.get("problem"), "span-6")}{card("Promised outcome", product.get("core_outcome"), "span-6")}{card("Ideal customer", icp.get("primary_segment"), "span-4")}{card("Buying trigger", icp.get("buying_trigger"), "span-4")}{card("Positioning", positioning.get("statement"), "span-4")}</div><div class="grid" style="margin-top:14px"><article class="card span-6"><span class="label">Qualification signals</span><ul>{items(icp.get("qualification_signals"))}</ul></article><article class="card span-6"><span class="label">Where to find them</span><ul>{items(icp.get("where_to_find"))}</ul></article></div></section>
  <section id="model"><div class="section-head"><span class="section-number">02</span><h2>Build the business around one sharp wedge</h2></div><div class="grid">{card("Recommended model", model.get("recommended_model"), "span-4")}{card("Distribution wedge", model.get("distribution_wedge"), "span-4")}{card("North-star metric", model.get("north_star_metric"), "span-4")}</div><div class="card" style="margin-top:14px"><span class="label">Go-to-market message</span><h3>{esc(go_to_market.get("message"))}</h3><p>{esc(go_to_market.get("initial_offer"))}</p></div></section>
  <section id="pricing"><div class="section-head"><span class="section-number">03</span><h2>Pricing that can survive contact with reality</h2></div><div class="tier-grid">{tier_cards}</div><div class="table-wrap" style="margin-top:18px"><table><thead><tr><th>Candidate</th><th>Type</th><th>Decision</th><th>Rationale</th></tr></thead><tbody>{table_rows([[item.get("name"),item.get("model_type"),item.get("verdict"),item.get("rationale")] for item in analysis.get("monetization_candidates", []) if isinstance(item,dict)])}</tbody></table></div></section>
  <section id="economics"><div class="section-head"><span class="section-number">04</span><h2>Numbers to watch before scaling</h2></div><div class="grid">{card("Effective ARPU", money(metrics.get("arpu"), currency), "span-4")}{card("Contribution / paid customer", money(metrics.get("monthly_contribution_per_paid_customer"), currency), "span-4")}{card("CAC payback", f'{number(metrics.get("cac_payback_months"))} months', "span-4")}{card("Simplified LTV", money(metrics.get("simplified_ltv"), currency), "span-4")}{card("Gross margin", percent(metrics.get("gross_margin")), "span-4")}{card("12-month operating profit", money(metrics.get("full_year_operating_profit"), currency), "span-4")}</div><div class="table-wrap" style="margin-top:18px"><table><thead><tr><th>Scenario</th><th>Revenue</th><th>Operating profit</th><th>Ending paid</th></tr></thead><tbody>{table_rows(scenario_rows)}</tbody></table></div></section>
  <section id="roadmap"><div class="section-head"><span class="section-number">05</span><h2>A 90-day path from hypothesis to evidence</h2></div><div class="roadmap">{roadmap}</div></section>
  <section id="evidence"><div class="section-head"><span class="section-number">06</span><h2>Evidence, gaps, and decision gates</h2></div><div class="table-wrap"><table><thead><tr><th>Dimension</th><th>Applied score</th><th>Evidence</th><th>Gap or cap</th></tr></thead><tbody>{table_rows(readiness_rows)}</tbody></table></div><div class="grid" style="margin-top:14px"><article class="card span-6 risk"><span class="label">Risks to validate</span><ul>{''.join(f'<li><strong>{esc(item.get("risk"))}</strong> — {esc(item.get("mitigation"))}</li>' for item in analysis.get("risks", []) if isinstance(item,dict))}</ul></article><article class="card span-6"><span class="label">Market sizing snapshot</span><p>TAM {esc(money(market_sizing.get("tam"), currency))} · SAM {esc(money(market_sizing.get("sam"), currency))} · 24-month SOM {esc(money(market_sizing.get("som_24m"), currency))}</p><p style="margin-top:12px">{esc(market.get("definition"))}</p></article></div><div class="sources" style="margin-top:18px">{''.join(f'<div class="source"><strong>{esc(source.get("title"))}</strong> · {esc(source.get("kind"))}<br><span>{esc(source.get("note"))}</span></div>' for source in analysis.get("sources", []) if isinstance(source,dict))}</div></section>
  <footer>Generated by StartupBlueprint. This is a decision aid built from public evidence, user inputs, and labeled assumptions; it is not a guarantee of demand, profit, funding, or growth.</footer></main></div>
</body></html>'''


def write_roadmap(path: Path, analysis: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["start_day", "end_day", "phase", "objective", "hypothesis", "action", "deliverable", "metric", "decision_rule", "owner"])
        for task in analysis.get("roadmap", []):
            if isinstance(task, dict):
                writer.writerow([task.get(key, "") for key in ["start_day", "end_day", "phase", "objective", "hypothesis", "action", "deliverable", "metric", "decision_rule", "owner"]])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--csv", type=Path, required=True)
    args = parser.parse_args()
    analysis = load_object(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_report(analysis), encoding="utf-8")
    write_roadmap(args.csv, analysis)
    print(f"Generated HTML report: {args.output}")
    print(f"Generated roadmap: {args.csv}")


if __name__ == "__main__":
    main()
