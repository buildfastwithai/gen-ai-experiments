#!/usr/bin/env python3

from __future__ import annotations

import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prepare_plan = load_module(
    "prepare_plan", ROOT / "startupblueprint" / "scripts" / "prepare_plan.py"
)
generate_report = load_module(
    "generate_startupblueprint_report",
    ROOT / "startupblueprint" / "scripts" / "generate_startupblueprint_report.py",
)


def tagged(value, status="assumption", basis="Visible test assumption"):
    return {
        "value": value,
        "status": status,
        "confidence": "low" if status == "assumption" else "medium",
        "basis": basis,
        "source_url": "",
    }


def base_analysis():
    source_url = "https://example.com"
    competitor_urls = [f"https://competitor{index}.example/pricing" for index in range(1, 4)]
    dimensions = [
        "problem_evidence",
        "icp_specificity",
        "reachable_market",
        "positioning",
        "business_model_pricing",
        "go_to_market",
        "unit_economics",
        "execution_readiness",
    ]
    return {
        "schema_version": 1,
        "generated_at": "2026-07-20",
        "mode": "standard",
        "product": {
            "name": "Example",
            "url": source_url,
            "summary": "A hosted workflow that helps solo founders plan a launch.",
            "stage": "pre-revenue beta",
            "geography": "English-speaking markets",
            "currency": "USD",
            "primary_user": "Solo SaaS founders",
            "economic_buyer": "The founder",
            "problem": "Founders make pricing and channel choices from disconnected advice.",
            "core_outcome": "A testable launch and monetization plan.",
            "delivery_type": "hosted SaaS",
            "value_frequency": "recurring",
            "current_business_model": "free beta",
            "current_pricing": "no paid plan",
        },
        "facts": [
            {"claim": "The product is available as a free beta.", "source_url": source_url, "checked_at": "2026-07-20"}
        ],
        "sources": [
            {"title": "Product page", "url": source_url, "kind": "product", "checked_at": "2026-07-20", "note": "Describes the workflow."},
            *[
                {"title": f"Competitor {index} pricing", "url": url, "kind": "market", "checked_at": "2026-07-20", "note": "Shows current public pricing."}
                for index, url in enumerate(competitor_urls, 1)
            ],
        ],
        "competitors": [
            {
                "name": f"Competitor {index}",
                "url": f"https://competitor{index}.example",
                "pricing_url": url,
                "checked_at": "2026-07-20",
                "target_segment": "Solo founders",
                "model": "monthly subscription",
                "value_metric": "workspace",
                "visible_pricing": f"${10 + index}/month",
                "notes": "A recurring planning tool.",
            }
            for index, url in enumerate(competitor_urls, 1)
        ],
        "strategy": {
            "problem_evidence": ["Comparable products charge for structured planning workflows."],
            "icp": {
                "primary_segment": "Solo founders launching a first paid SaaS",
                "user": "The founder",
                "buyer": "The founder",
                "company_profile": "Pre-revenue or early-revenue bootstrapped SaaS",
                "buying_trigger": "A launch or pricing decision is due within 30 days",
                "qualification_signals": ["Has a working product", "Needs a concrete launch decision"],
                "anti_icp": ["Enterprise procurement teams", "Ideas with no product or buyer hypothesis"],
                "where_to_find": ["Founder communities", "Product launch communities"],
            },
            "market": {
                "definition": "Solo founders preparing a paid SaaS launch",
                "eligible_accounts": tagged(10000),
                "serviceable_accounts": tagged(3000),
                "realistic_accounts_24m": tagged(150),
                "annual_revenue_per_account": tagged(240),
                "trends": ["More founders use AI-assisted product workflows."],
                "risks": ["The segment may prefer free templates."],
            },
            "positioning": {
                "category": "startup planning workspace",
                "alternatives": ["spreadsheets", "generic chat prompts", "consultants"],
                "differentiators": ["evidence ledger", "editable financial model"],
                "statement": "For solo founders who need a launch decision, Example turns product evidence into an executable plan.",
                "claim_to_test": "A complete plan reduces the time to a pricing decision.",
            },
            "go_to_market": {
                "primary_channel": "founder communities",
                "secondary_channel": "founder-led content",
                "motion": "self-serve with founder-led onboarding",
                "message": "Turn your startup URL into a business plan you can actually test.",
                "initial_offer": "Free plan review followed by a paid workspace trial.",
                "funnel_assumptions": ["Qualified founders will share a URL before a call."],
                "stop_conditions": ["Change the offer if qualified users will not test it after ten conversations."],
            },
            "milestones": [
                {"period": "Days 1-30", "outcome": "Validate the buyer and offer", "metric": "Qualified conversations", "decision_gate": "Continue only if the pain repeats."},
                {"period": "Days 31-60", "outcome": "Run paid pilots", "metric": "Paid pilot acceptance", "decision_gate": "Change pricing if qualified buyers reject the offer."},
                {"period": "Days 61-90", "outcome": "Repeat one channel", "metric": "Repeatable qualified pipeline", "decision_gate": "Focus, iterate, or stop the channel."},
            ],
            "readiness_scores": [
                {"dimension": dimension, "raw_score": 4, "evidence_strength": "partial", "rationale": "Useful public evidence exists, but transaction data is missing.", "evidence_urls": [source_url]}
                for dimension in dimensions
            ],
        },
        "business_model": {
            "recommended_model": "freemium plus monthly subscription",
            "why_now": "The product is ready to test monetization before adding more scope.",
            "distribution_wedge": "Founder communities with an immediate launch decision",
            "north_star_metric": "plans that lead to a completed buyer experiment",
            "customer_segments": ["Solo SaaS founders"],
            "value_propositions": ["One evidence-backed plan instead of disconnected advice"],
            "channels": ["Founder communities", "Founder-led content"],
            "customer_relationships": ["Self-serve", "Founder-led onboarding"],
            "revenue_streams": ["Monthly subscription", "Annual subscription"],
            "key_activities": ["Research", "Plan generation", "Experiment tracking"],
            "key_resources": ["Codex skill", "Public market evidence"],
            "key_partners": ["None required for the first test"],
            "cost_structure": ["Inference", "Hosting", "Support"],
            "advantages": ["Integrated plan, pricing, model, and roadmap"],
        },
        "monetization_candidates": [
            {"name": "Monthly subscription", "model_type": "subscription", "rationale": "Value and costs recur.", "strengths": ["Aligned"], "risks": ["Churn unknown"], "evidence_urls": competitor_urls, "verdict": "PRIMARY"},
            {"name": "Annual subscription", "model_type": "annual", "rationale": "Can improve cash flow after retention is proven.", "strengths": ["Cash"], "risks": ["Commitment"], "evidence_urls": competitor_urls, "verdict": "ALTERNATIVE"},
            {"name": "Lifetime", "model_type": "lifetime", "rationale": "Ongoing costs make uncapped lifetime unsafe.", "strengths": ["Cash upfront"], "risks": ["Perpetual cost"], "evidence_urls": [source_url], "verdict": "REJECT"},
            {"name": "One-time report", "model_type": "one-time", "rationale": "Useful as an acquisition test.", "strengths": ["Simple"], "risks": ["Weak retention"], "evidence_urls": [source_url], "verdict": "TEST"},
        ],
        "pricing": {
            "recommended_model": "monthly subscription with annual option",
            "alternative_model": "one-time paid plan review",
            "currency": "USD",
            "value_metric": "workspace",
            "free_plan_decision": "limited free plan",
            "free_plan_rationale": "Let founders inspect one partial plan without uncapped generation.",
            "trial": "14-day trial",
            "annual_discount_percent": 20,
            "lifetime_verdict": "NOT_RECOMMENDED",
            "lifetime_rationale": "Inference and support continue.",
            "lifetime_constraints": [],
            "pricing_confidence": "low",
            "pricing_evidence": ["Three comparables use recurring pricing."],
            "tiers": [
                {"name": "Free", "tier_type": "free", "target_segment": "Curious founders", "monthly_price": 0, "annual_monthly_equivalent": 0, "expected_paid_mix": 0, "included": ["Plan preview"], "limits": "One preview", "upgrade_trigger": "Full plan"},
                {"name": "Builder", "tier_type": "paid", "target_segment": "Solo founders", "monthly_price": 19, "annual_monthly_equivalent": 15.2, "expected_paid_mix": 0.8, "included": ["Full plan", "Roadmap"], "limits": "One startup", "upgrade_trigger": "More startups"},
                {"name": "Studio", "tier_type": "paid", "target_segment": "Studios", "monthly_price": 49, "annual_monthly_equivalent": 39.2, "expected_paid_mix": 0.2, "included": ["Five startups"], "limits": "Five startups", "upgrade_trigger": "Team workflow"},
            ],
        },
        "financial_inputs": {
            "opening_free_users": tagged(100),
            "opening_paid_customers": tagged(5),
            "monthly_new_free_users": tagged(50),
            "free_to_paid_conversion_rate": tagged(0.05),
            "monthly_new_paid_customers_direct": tagged(2),
            "monthly_paid_churn_rate": tagged(0.05),
            "monthly_arpu_override": tagged(0),
            "variable_cost_per_paid_customer": tagged(4),
            "variable_cost_per_free_user": tagged(0.2),
            "fixed_monthly_costs": tagged(500),
            "monthly_acquisition_spend": tagged(200),
            "one_time_revenue_per_new_paid": tagged(0),
            "starting_cash": tagged(5000),
        },
        "scenarios": [
            {"name": "conservative", "new_free_users_multiplier": 0.7, "conversion_multiplier": 0.7, "new_paid_multiplier": 0.7, "churn_multiplier": 1.3, "arpu_multiplier": 0.9, "variable_cost_multiplier": 1.2, "fixed_cost_multiplier": 1.1, "acquisition_spend_multiplier": 1.0},
            {"name": "base", "new_free_users_multiplier": 1.0, "conversion_multiplier": 1.0, "new_paid_multiplier": 1.0, "churn_multiplier": 1.0, "arpu_multiplier": 1.0, "variable_cost_multiplier": 1.0, "fixed_cost_multiplier": 1.0, "acquisition_spend_multiplier": 1.0},
            {"name": "optimistic", "new_free_users_multiplier": 1.3, "conversion_multiplier": 1.3, "new_paid_multiplier": 1.3, "churn_multiplier": 0.8, "arpu_multiplier": 1.1, "variable_cost_multiplier": 0.9, "fixed_cost_multiplier": 1.0, "acquisition_spend_multiplier": 1.2},
        ],
        "risks": [
            {"risk": "Demand is not proven", "likelihood": "high", "impact": "high", "mitigation": "Run paid pilots", "validation": "Track paid acceptance"}
        ],
        "roadmap": [
            {"start_day": start, "end_day": end, "phase": phase, "objective": f"Objective {index}", "hypothesis": f"Hypothesis {index}", "action": f"Action {index}", "deliverable": f"Deliverable {index}", "metric": f"Metric {index}", "decision_rule": f"Decision {index}", "owner": "Founder"}
            for index, (start, end, phase) in enumerate([
                (1, 7, "Validate"), (8, 14, "Validate"), (15, 30, "Validate"),
                (31, 40, "Sell"), (41, 50, "Sell"), (51, 60, "Sell"),
                (61, 70, "Repeat"), (71, 80, "Repeat"), (81, 90, "Repeat"),
            ], 1)
        ],
        "limitations": ["All operating numbers are assumptions until measured."],
    }


class BusinessPlannerTests(unittest.TestCase):
    def test_plan_scores_market_and_applies_evidence_caps(self):
        result = prepare_plan.prepare_analysis(base_analysis())
        self.assertEqual(result["market_sizing"]["tam"], 2_400_000)
        self.assertEqual(result["analysis_status"], "PROVISIONAL")
        self.assertGreater(result["readiness_score"], 0)
        problem = next(item for item in result["readiness_breakdown"] if item["dimension"] == "problem_evidence")
        channel = next(item for item in result["readiness_breakdown"] if item["dimension"] == "go_to_market")
        self.assertEqual(problem["applied_raw_score"], 3)
        self.assertEqual(channel["applied_raw_score"], 2)

    def test_unknown_market_input_does_not_become_a_number(self):
        analysis = base_analysis()
        analysis["strategy"]["market"]["eligible_accounts"] = tagged(None, "unknown", "No reliable count found")
        result = prepare_plan.prepare_analysis(analysis)
        self.assertIsNone(result["market_sizing"]["tam"])

    def test_viable_lifetime_with_recurring_cost_requires_constraints(self):
        analysis = base_analysis()
        analysis["pricing"]["lifetime_verdict"] = "VIABLE"
        with self.assertRaises(prepare_plan.AnalysisError):
            prepare_plan.prepare_analysis(analysis)

    def test_html_report_and_csv_are_generated(self):
        result = prepare_plan.prepare_analysis(base_analysis())
        report = generate_report.render_report(result)
        self.assertIn("StartupBlueprint", report)
        self.assertIn("Who this is for, and why now", report)
        self.assertIn("prefers-reduced-motion", report)
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "roadmap.csv"
            report_target = Path(tmp) / "report.html"
            report_target.write_text(report, encoding="utf-8")
            generate_report.write_roadmap(target, result)
            with target.open(newline="", encoding="utf-8") as handle:
                rows = list(csv.reader(handle))
            self.assertEqual(len(rows), 10)
            self.assertGreater(report_target.stat().st_size, 10000)

    def test_paid_mix_must_total_one(self):
        analysis = base_analysis()
        analysis["pricing"]["tiers"][1]["expected_paid_mix"] = 0.5
        with self.assertRaises(prepare_plan.AnalysisError):
            prepare_plan.prepare_analysis(analysis)


if __name__ == "__main__":
    unittest.main()
