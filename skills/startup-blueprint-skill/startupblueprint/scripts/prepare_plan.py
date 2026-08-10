#!/usr/bin/env python3
"""Validate and prepare StartupBlueprint analysis data."""

from __future__ import annotations

import argparse
import json
import math
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


MODES = {"quick", "standard", "deep", "pre-revenue", "audit"}
INPUT_STATUSES = {"user", "public", "assumption", "unknown"}
CONFIDENCE_LEVELS = {"low", "medium", "high"}
LEVELS = {"low", "medium", "high"}
SOURCE_KINDS = {"product", "market", "cost", "demand", "channel", "other"}
CANDIDATE_VERDICTS = {"PRIMARY", "ALTERNATIVE", "TEST", "REJECT"}
TIER_TYPES = {"free", "paid", "usage", "contact"}
LIFETIME_VERDICTS = {
    "VIABLE",
    "LIMITED_TEST",
    "NOT_RECOMMENDED",
    "INSUFFICIENT_EVIDENCE",
}
SCENARIO_NAMES = {"conservative", "base", "optimistic"}
FINANCIAL_INPUTS = (
    "opening_free_users",
    "opening_paid_customers",
    "monthly_new_free_users",
    "free_to_paid_conversion_rate",
    "monthly_new_paid_customers_direct",
    "monthly_paid_churn_rate",
    "monthly_arpu_override",
    "variable_cost_per_paid_customer",
    "variable_cost_per_free_user",
    "fixed_monthly_costs",
    "monthly_acquisition_spend",
    "one_time_revenue_per_new_paid",
    "starting_cash",
)
RATE_INPUTS = {"free_to_paid_conversion_rate", "monthly_paid_churn_rate"}
CRITICAL_INPUTS = {
    "monthly_paid_churn_rate",
    "variable_cost_per_paid_customer",
    "fixed_monthly_costs",
    "monthly_acquisition_spend",
}
SCENARIO_DRIVERS = (
    "new_free_users_multiplier",
    "conversion_multiplier",
    "new_paid_multiplier",
    "churn_multiplier",
    "arpu_multiplier",
    "variable_cost_multiplier",
    "fixed_cost_multiplier",
    "acquisition_spend_multiplier",
)
READINESS_WEIGHTS = {
    "problem_evidence": 15,
    "icp_specificity": 10,
    "reachable_market": 10,
    "positioning": 15,
    "business_model_pricing": 15,
    "go_to_market": 15,
    "unit_economics": 10,
    "execution_readiness": 10,
}
EVIDENCE_MULTIPLIERS = {
    "strong": 1.0,
    "partial": 0.75,
    "assumption-heavy": 0.5,
    "unsupported": 0.25,
}
MARKET_INPUTS = (
    "eligible_accounts",
    "serviceable_accounts",
    "realistic_accounts_24m",
    "annual_revenue_per_account",
)


class AnalysisError(ValueError):
    """Raised when input data does not match the expected schema."""


def require_object(value: Any, location: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise AnalysisError(f"{location} must be an object")
    return value


def require_list(value: Any, location: str, *, allow_empty: bool = True) -> list[Any]:
    if not isinstance(value, list):
        raise AnalysisError(f"{location} must be a list")
    if not allow_empty and not value:
        raise AnalysisError(f"{location} must not be empty")
    return value


def require_text(value: Any, location: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise AnalysisError(f"{location} must be text")
    text = value.strip()
    if not text and not allow_empty:
        raise AnalysisError(f"{location} must be non-empty text")
    return text


def require_number(
    value: Any,
    location: str,
    *,
    allow_null: bool = False,
    minimum: float = 0,
    maximum: float | None = None,
) -> float | int | None:
    if value is None and allow_null:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        suffix = " or null" if allow_null else ""
        raise AnalysisError(f"{location} must be a finite number{suffix}")
    if value < minimum:
        raise AnalysisError(f"{location} must be at least {minimum}")
    if maximum is not None and value > maximum:
        raise AnalysisError(f"{location} must not exceed {maximum}")
    return value


def require_date(value: Any, location: str) -> str:
    text = require_text(value, location)
    try:
        datetime.strptime(text, "%Y-%m-%d")
    except ValueError as error:
        raise AnalysisError(f"{location} must use YYYY-MM-DD") from error
    return text


def require_url(value: Any, location: str, *, allow_empty: bool = False) -> str:
    text = require_text(value, location, allow_empty=allow_empty)
    if not text and allow_empty:
        return ""
    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise AnalysisError(f"{location} must be an absolute http(s) URL")
    return text


def validate_text_list(value: Any, location: str, *, allow_empty: bool = False) -> list[str]:
    items = require_list(value, location, allow_empty=allow_empty)
    return [require_text(item, f"{location}[{index}]") for index, item in enumerate(items)]


def validate_product(raw: Any) -> dict[str, Any]:
    product = require_object(raw, "product")
    required = (
        "name",
        "summary",
        "stage",
        "geography",
        "currency",
        "primary_user",
        "economic_buyer",
        "problem",
        "core_outcome",
        "delivery_type",
        "value_frequency",
        "current_business_model",
        "current_pricing",
    )
    for field in required:
        require_text(product.get(field), f"product.{field}")
    require_url(product.get("url", ""), "product.url", allow_empty=True)
    return product


def validate_sources(raw: Any) -> list[dict[str, Any]]:
    sources = require_list(raw, "sources", allow_empty=False)
    seen: set[str] = set()
    for index, source_raw in enumerate(sources):
        location = f"sources[{index}]"
        source = require_object(source_raw, location)
        require_text(source.get("title"), f"{location}.title")
        url = require_url(source.get("url"), f"{location}.url")
        if url in seen:
            raise AnalysisError(f"Duplicate source URL: {url}")
        seen.add(url)
        kind = require_text(source.get("kind"), f"{location}.kind")
        if kind not in SOURCE_KINDS:
            raise AnalysisError(f"{location}.kind must be one of: {', '.join(sorted(SOURCE_KINDS))}")
        require_date(source.get("checked_at"), f"{location}.checked_at")
        require_text(source.get("note"), f"{location}.note")
    return raw


def validate_facts(raw: Any, source_urls: set[str]) -> list[dict[str, Any]]:
    facts = require_list(raw, "facts", allow_empty=False)
    for index, fact_raw in enumerate(facts):
        location = f"facts[{index}]"
        fact = require_object(fact_raw, location)
        require_text(fact.get("claim"), f"{location}.claim")
        url = require_url(fact.get("source_url"), f"{location}.source_url")
        if url not in source_urls:
            raise AnalysisError(f"{location}.source_url must also appear in sources")
        require_date(fact.get("checked_at"), f"{location}.checked_at")
    return raw


def validate_competitors(raw: Any, mode: str) -> list[dict[str, Any]]:
    competitors = require_list(raw, "competitors", allow_empty=mode == "quick")
    if mode in {"standard", "deep", "audit"} and len(competitors) < 3:
        raise AnalysisError("standard, deep, and audit modes require at least three competitors")
    seen_names: set[str] = set()
    for index, competitor_raw in enumerate(competitors):
        location = f"competitors[{index}]"
        competitor = require_object(competitor_raw, location)
        name = require_text(competitor.get("name"), f"{location}.name")
        if name.casefold() in seen_names:
            raise AnalysisError(f"Duplicate competitor name: {name}")
        seen_names.add(name.casefold())
        require_url(competitor.get("url"), f"{location}.url")
        require_url(competitor.get("pricing_url"), f"{location}.pricing_url")
        require_date(competitor.get("checked_at"), f"{location}.checked_at")
        for field in ("target_segment", "model", "value_metric", "visible_pricing", "notes"):
            require_text(competitor.get(field), f"{location}.{field}")
    return competitors


def validate_tagged_number(raw: Any, location: str) -> dict[str, Any]:
    entry = require_object(raw, location)
    status = require_text(entry.get("status"), f"{location}.status")
    if status not in INPUT_STATUSES:
        raise AnalysisError(f"{location}.status must be one of: {', '.join(sorted(INPUT_STATUSES))}")
    confidence = require_text(entry.get("confidence"), f"{location}.confidence")
    if confidence not in CONFIDENCE_LEVELS:
        raise AnalysisError(
            f"{location}.confidence must be one of: {', '.join(sorted(CONFIDENCE_LEVELS))}"
        )
    value = require_number(entry.get("value"), f"{location}.value", allow_null=True)
    if status == "unknown" and value is not None:
        raise AnalysisError(f"{location}.value must be null when status is unknown")
    if status != "unknown" and value is None:
        raise AnalysisError(f"{location}.value must be numeric unless status is unknown")
    require_text(entry.get("basis"), f"{location}.basis")
    source_url = require_url(entry.get("source_url", ""), f"{location}.source_url", allow_empty=True)
    if status == "public" and not source_url:
        raise AnalysisError(f"{location}.source_url is required when status is public")
    return entry


def validate_strategy(raw: Any) -> dict[str, Any]:
    strategy = require_object(raw, "strategy")
    validate_text_list(strategy.get("problem_evidence"), "strategy.problem_evidence")

    icp = require_object(strategy.get("icp"), "strategy.icp")
    for field in ("primary_segment", "user", "buyer", "company_profile", "buying_trigger"):
        require_text(icp.get(field), f"strategy.icp.{field}")
    for field in ("qualification_signals", "anti_icp", "where_to_find"):
        validate_text_list(icp.get(field), f"strategy.icp.{field}")

    market = require_object(strategy.get("market"), "strategy.market")
    require_text(market.get("definition"), "strategy.market.definition")
    validate_text_list(market.get("trends"), "strategy.market.trends")
    validate_text_list(market.get("risks"), "strategy.market.risks")
    for field in MARKET_INPUTS:
        validate_tagged_number(market.get(field), f"strategy.market.{field}")

    positioning = require_object(strategy.get("positioning"), "strategy.positioning")
    for field in ("category", "statement", "claim_to_test"):
        require_text(positioning.get(field), f"strategy.positioning.{field}")
    for field in ("alternatives", "differentiators"):
        validate_text_list(positioning.get(field), f"strategy.positioning.{field}")

    go_to_market = require_object(strategy.get("go_to_market"), "strategy.go_to_market")
    for field in ("primary_channel", "secondary_channel", "motion", "message", "initial_offer"):
        require_text(go_to_market.get(field), f"strategy.go_to_market.{field}")
    for field in ("funnel_assumptions", "stop_conditions"):
        validate_text_list(go_to_market.get(field), f"strategy.go_to_market.{field}")

    milestones = require_list(strategy.get("milestones"), "strategy.milestones", allow_empty=False)
    for index, milestone_raw in enumerate(milestones):
        milestone = require_object(milestone_raw, f"strategy.milestones[{index}]")
        for field in ("period", "outcome", "metric", "decision_gate"):
            require_text(milestone.get(field), f"strategy.milestones[{index}].{field}")

    scores = require_list(strategy.get("readiness_scores"), "strategy.readiness_scores", allow_empty=False)
    dimensions: set[str] = set()
    for index, score_raw in enumerate(scores):
        location = f"strategy.readiness_scores[{index}]"
        score = require_object(score_raw, location)
        dimension = require_text(score.get("dimension"), f"{location}.dimension")
        if dimension not in READINESS_WEIGHTS:
            raise AnalysisError(f"Unknown readiness dimension: {dimension}")
        if dimension in dimensions:
            raise AnalysisError(f"Duplicate readiness dimension: {dimension}")
        dimensions.add(dimension)
        raw_score = require_number(score.get("raw_score"), f"{location}.raw_score", maximum=5)
        if int(raw_score) != raw_score:
            raise AnalysisError(f"{location}.raw_score must be an integer")
        strength = require_text(score.get("evidence_strength"), f"{location}.evidence_strength")
        if strength not in EVIDENCE_MULTIPLIERS:
            raise AnalysisError(
                f"{location}.evidence_strength must be one of: "
                f"{', '.join(sorted(EVIDENCE_MULTIPLIERS))}"
            )
        require_text(score.get("rationale"), f"{location}.rationale")
        evidence_urls = require_list(score.get("evidence_urls"), f"{location}.evidence_urls")
        for url_index, url in enumerate(evidence_urls):
            require_url(url, f"{location}.evidence_urls[{url_index}]")
    if dimensions != set(READINESS_WEIGHTS):
        missing = sorted(set(READINESS_WEIGHTS) - dimensions)
        raise AnalysisError(f"Missing readiness dimensions: {', '.join(missing)}")
    return strategy


def validate_business_model(raw: Any) -> dict[str, Any]:
    model = require_object(raw, "business_model")
    for field in (
        "recommended_model",
        "why_now",
        "distribution_wedge",
        "north_star_metric",
    ):
        require_text(model.get(field), f"business_model.{field}")
    for field in (
        "customer_segments",
        "value_propositions",
        "channels",
        "customer_relationships",
        "revenue_streams",
        "key_activities",
        "key_resources",
        "key_partners",
        "cost_structure",
        "advantages",
    ):
        validate_text_list(model.get(field), f"business_model.{field}")
    return model


def validate_candidates(raw: Any) -> list[dict[str, Any]]:
    candidates = require_list(raw, "monetization_candidates", allow_empty=False)
    if len(candidates) < 4:
        raise AnalysisError("monetization_candidates must include at least four candidates")
    primary_count = 0
    for index, candidate_raw in enumerate(candidates):
        location = f"monetization_candidates[{index}]"
        candidate = require_object(candidate_raw, location)
        for field in ("name", "model_type", "rationale"):
            require_text(candidate.get(field), f"{location}.{field}")
        validate_text_list(candidate.get("strengths"), f"{location}.strengths", allow_empty=True)
        validate_text_list(candidate.get("risks"), f"{location}.risks", allow_empty=True)
        urls = require_list(candidate.get("evidence_urls"), f"{location}.evidence_urls", allow_empty=False)
        for url_index, url in enumerate(urls):
            require_url(url, f"{location}.evidence_urls[{url_index}]")
        verdict = require_text(candidate.get("verdict"), f"{location}.verdict")
        if verdict not in CANDIDATE_VERDICTS:
            raise AnalysisError(f"{location}.verdict must be one of: {', '.join(sorted(CANDIDATE_VERDICTS))}")
        primary_count += verdict == "PRIMARY"
    if primary_count != 1:
        raise AnalysisError("Exactly one monetization candidate must have verdict PRIMARY")
    return candidates


def validate_pricing(raw: Any) -> dict[str, Any]:
    pricing = require_object(raw, "pricing")
    for field in (
        "recommended_model",
        "alternative_model",
        "currency",
        "value_metric",
        "free_plan_decision",
        "free_plan_rationale",
        "trial",
        "lifetime_rationale",
        "pricing_confidence",
    ):
        require_text(pricing.get(field), f"pricing.{field}")
    require_number(
        pricing.get("annual_discount_percent"),
        "pricing.annual_discount_percent",
        minimum=0,
        maximum=50,
    )
    lifetime = require_text(pricing.get("lifetime_verdict"), "pricing.lifetime_verdict")
    if lifetime not in LIFETIME_VERDICTS:
        raise AnalysisError(
            f"pricing.lifetime_verdict must be one of: {', '.join(sorted(LIFETIME_VERDICTS))}"
        )
    validate_text_list(pricing.get("lifetime_constraints"), "pricing.lifetime_constraints", allow_empty=True)
    validate_text_list(pricing.get("pricing_evidence"), "pricing.pricing_evidence")
    tiers = require_list(pricing.get("tiers"), "pricing.tiers", allow_empty=False)
    seen_names: set[str] = set()
    paid_mix = 0.0
    paid_count = 0
    for index, tier_raw in enumerate(tiers):
        location = f"pricing.tiers[{index}]"
        tier = require_object(tier_raw, location)
        name = require_text(tier.get("name"), f"{location}.name")
        if name.casefold() in seen_names:
            raise AnalysisError(f"Duplicate tier name: {name}")
        seen_names.add(name.casefold())
        tier_type = require_text(tier.get("tier_type"), f"{location}.tier_type")
        if tier_type not in TIER_TYPES:
            raise AnalysisError(f"{location}.tier_type must be one of: {', '.join(sorted(TIER_TYPES))}")
        for field in ("target_segment", "limits", "upgrade_trigger"):
            require_text(tier.get(field), f"{location}.{field}")
        validate_text_list(tier.get("included"), f"{location}.included")
        price = require_number(tier.get("monthly_price"), f"{location}.monthly_price")
        require_number(
            tier.get("annual_monthly_equivalent"),
            f"{location}.annual_monthly_equivalent",
        )
        mix = require_number(
            tier.get("expected_paid_mix"),
            f"{location}.expected_paid_mix",
            maximum=1,
        )
        if tier_type == "free" and (price != 0 or mix != 0):
            raise AnalysisError(f"{location} free tier must have zero price and paid mix")
        if tier_type == "paid":
            if price <= 0:
                raise AnalysisError(f"{location} paid tier must have a positive monthly price")
            paid_count += 1
            paid_mix += float(mix)
    if paid_count == 0:
        raise AnalysisError("pricing.tiers must include at least one paid tier")
    if not math.isclose(paid_mix, 1.0, abs_tol=0.01):
        raise AnalysisError(f"Paid tier expected_paid_mix must total 1.0, got {paid_mix:.4f}")
    return pricing


def validate_financial_inputs(raw: Any) -> dict[str, dict[str, Any]]:
    inputs = require_object(raw, "financial_inputs")
    missing = [key for key in FINANCIAL_INPUTS if key not in inputs]
    if missing:
        raise AnalysisError(f"financial_inputs is missing: {', '.join(missing)}")
    for key in FINANCIAL_INPUTS:
        location = f"financial_inputs.{key}"
        entry = require_object(inputs.get(key), location)
        status = require_text(entry.get("status"), f"{location}.status")
        if status not in INPUT_STATUSES:
            raise AnalysisError(f"{location}.status must be one of: {', '.join(sorted(INPUT_STATUSES))}")
        confidence = require_text(entry.get("confidence"), f"{location}.confidence")
        if confidence not in CONFIDENCE_LEVELS:
            raise AnalysisError(
                f"{location}.confidence must be one of: {', '.join(sorted(CONFIDENCE_LEVELS))}"
            )
        value = require_number(
            entry.get("value"),
            f"{location}.value",
            allow_null=True,
            maximum=1 if key in RATE_INPUTS else None,
        )
        if status == "unknown" and value is not None:
            raise AnalysisError(f"{location}.value must be null when status is unknown")
        if status != "unknown" and value is None:
            raise AnalysisError(f"{location}.value must be numeric unless status is unknown")
        require_text(entry.get("basis"), f"{location}.basis")
        source_url = require_url(
            entry.get("source_url", ""),
            f"{location}.source_url",
            allow_empty=True,
        )
        if status == "public" and not source_url:
            raise AnalysisError(f"{location}.source_url is required when status is public")
    return inputs


def validate_scenarios(raw: Any) -> list[dict[str, Any]]:
    scenarios = require_list(raw, "scenarios", allow_empty=False)
    names: set[str] = set()
    for index, scenario_raw in enumerate(scenarios):
        location = f"scenarios[{index}]"
        scenario = require_object(scenario_raw, location)
        name = require_text(scenario.get("name"), f"{location}.name").lower()
        if name not in SCENARIO_NAMES:
            raise AnalysisError(f"{location}.name must be conservative, base, or optimistic")
        if name in names:
            raise AnalysisError(f"Duplicate scenario: {name}")
        names.add(name)
        for driver in SCENARIO_DRIVERS:
            value = require_number(scenario.get(driver), f"{location}.{driver}", maximum=10)
            if name == "base" and not math.isclose(float(value), 1.0, abs_tol=1e-9):
                raise AnalysisError(f"Base scenario driver {driver} must equal 1.0")
    if names != SCENARIO_NAMES:
        raise AnalysisError("scenarios must include conservative, base, and optimistic")
    return scenarios


def validate_risks(raw: Any) -> list[dict[str, Any]]:
    risks = require_list(raw, "risks", allow_empty=False)
    for index, risk_raw in enumerate(risks):
        location = f"risks[{index}]"
        risk = require_object(risk_raw, location)
        for field in ("risk", "mitigation", "validation"):
            require_text(risk.get(field), f"{location}.{field}")
        for field in ("likelihood", "impact"):
            value = require_text(risk.get(field), f"{location}.{field}")
            if value not in LEVELS:
                raise AnalysisError(f"{location}.{field} must be low, medium, or high")
    return risks


def validate_roadmap(raw: Any) -> list[dict[str, Any]]:
    roadmap = require_list(raw, "roadmap", allow_empty=False)
    if len(roadmap) < 9:
        raise AnalysisError("roadmap must include at least nine tasks")
    coverage = {"1-30": False, "31-60": False, "61-90": False}
    for index, task_raw in enumerate(roadmap):
        location = f"roadmap[{index}]"
        task = require_object(task_raw, location)
        start = require_number(task.get("start_day"), f"{location}.start_day", minimum=1, maximum=90)
        end = require_number(task.get("end_day"), f"{location}.end_day", minimum=1, maximum=90)
        if int(start) != start or int(end) != end:
            raise AnalysisError(f"{location} day values must be integers")
        if start > end:
            raise AnalysisError(f"{location}.start_day must not exceed end_day")
        for field in (
            "phase",
            "objective",
            "hypothesis",
            "action",
            "deliverable",
            "metric",
            "decision_rule",
            "owner",
        ):
            require_text(task.get(field), f"{location}.{field}")
        coverage["1-30"] |= start <= 30 and end >= 1
        coverage["31-60"] |= start <= 60 and end >= 31
        coverage["61-90"] |= start <= 90 and end >= 61
    missing = [phase for phase, covered in coverage.items() if not covered]
    if missing:
        raise AnalysisError(f"roadmap does not cover phase(s): {', '.join(missing)}")
    return roadmap


def input_value(inputs: dict[str, dict[str, Any]], key: str) -> float | None:
    value = inputs[key].get("value")
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def weighted_arpu(pricing: dict[str, Any]) -> float:
    return sum(
        float(tier["monthly_price"]) * float(tier["expected_paid_mix"])
        for tier in pricing["tiers"]
        if tier["tier_type"] == "paid"
    )


def calculate_scenario(
    inputs: dict[str, dict[str, Any]],
    pricing: dict[str, Any],
    scenario: dict[str, Any],
) -> dict[str, Any]:
    def value(key: str) -> float:
        return input_value(inputs, key) or 0.0

    tier_arpu = weighted_arpu(pricing)
    override = value("monthly_arpu_override")
    arpu = (override if override > 0 else tier_arpu) * float(scenario["arpu_multiplier"])
    variable_paid = value("variable_cost_per_paid_customer") * float(
        scenario["variable_cost_multiplier"]
    )
    variable_free = value("variable_cost_per_free_user") * float(
        scenario["variable_cost_multiplier"]
    )
    fixed = value("fixed_monthly_costs") * float(scenario["fixed_cost_multiplier"])
    acquisition = value("monthly_acquisition_spend") * float(
        scenario["acquisition_spend_multiplier"]
    )
    conversion_rate = min(
        1.0,
        value("free_to_paid_conversion_rate") * float(scenario["conversion_multiplier"]),
    )
    churn_rate = min(
        1.0,
        value("monthly_paid_churn_rate") * float(scenario["churn_multiplier"]),
    )
    new_free = value("monthly_new_free_users") * float(
        scenario["new_free_users_multiplier"]
    )
    direct_paid = value("monthly_new_paid_customers_direct") * float(
        scenario["new_paid_multiplier"]
    )
    setup_revenue = value("one_time_revenue_per_new_paid")

    opening_free = value("opening_free_users")
    opening_paid = value("opening_paid_customers")
    cash = value("starting_cash")
    months: list[dict[str, float | int]] = []

    for month in range(1, 13):
        converted = opening_free * conversion_rate
        ending_free = max(0.0, opening_free + new_free - converted)
        churned = opening_paid * churn_rate
        new_paid = converted + direct_paid
        ending_paid = max(0.0, opening_paid + new_paid - churned)
        average_free = (opening_free + ending_free) / 2
        average_paid = (opening_paid + ending_paid) / 2
        subscription_revenue = average_paid * arpu
        one_time = new_paid * setup_revenue
        revenue = subscription_revenue + one_time
        variable_cost = average_paid * variable_paid + average_free * variable_free
        cost = variable_cost + fixed + acquisition
        profit = revenue - cost
        cash += profit
        months.append(
            {
                "month": month,
                "opening_free": round(opening_free, 4),
                "new_free": round(new_free, 4),
                "converted": round(converted, 4),
                "ending_free": round(ending_free, 4),
                "opening_paid": round(opening_paid, 4),
                "new_paid": round(new_paid, 4),
                "churned": round(churned, 4),
                "ending_paid": round(ending_paid, 4),
                "revenue": round(revenue, 2),
                "total_cost": round(cost, 2),
                "operating_profit": round(profit, 2),
                "ending_cash": round(cash, 2),
            }
        )
        opening_free = ending_free
        opening_paid = ending_paid

    first_new_paid = float(months[0]["new_paid"])
    contribution = arpu - variable_paid
    gross_margin = contribution / arpu if arpu > 0 else None
    cac = acquisition / first_new_paid if first_new_paid > 0 else None
    payback = cac / contribution if cac is not None and contribution > 0 else None
    ltv = contribution / churn_rate if churn_rate > 0 and contribution > 0 else None
    break_even = fixed / contribution if contribution > 0 else None

    return {
        "name": scenario["name"],
        "arpu": round(arpu, 2),
        "monthly_contribution_per_paid_customer": round(contribution, 2),
        "gross_margin": round(gross_margin, 6) if gross_margin is not None else None,
        "blended_cac": round(cac, 2) if cac is not None else None,
        "cac_payback_months": round(payback, 2) if payback is not None else None,
        "simplified_ltv": round(ltv, 2) if ltv is not None else None,
        "break_even_paid_customers": round(break_even, 2) if break_even is not None else None,
        "full_year_revenue": round(sum(float(month["revenue"]) for month in months), 2),
        "full_year_operating_profit": round(
            sum(float(month["operating_profit"]) for month in months), 2
        ),
        "month_12_operating_profit": months[-1]["operating_profit"],
        "ending_paid_customers": months[-1]["ending_paid"],
        "ending_cash": months[-1]["ending_cash"],
        "months": months,
    }


def determine_status(inputs: dict[str, dict[str, Any]]) -> tuple[str, list[str]]:
    missing = [
        key
        for key in CRITICAL_INPUTS
        if inputs[key]["status"] == "unknown" or inputs[key]["value"] is None
    ]
    free_activity = (input_value(inputs, "opening_free_users") or 0) > 0 or (
        input_value(inputs, "monthly_new_free_users") or 0
    ) > 0
    if free_activity and (
        inputs["variable_cost_per_free_user"]["status"] == "unknown"
        or inputs["variable_cost_per_free_user"]["value"] is None
    ):
        missing.append("variable_cost_per_free_user")

    direct = input_value(inputs, "monthly_new_paid_customers_direct")
    new_free = input_value(inputs, "monthly_new_free_users")
    conversion = input_value(inputs, "free_to_paid_conversion_rate")
    if direct is None and (new_free is None or conversion is None):
        missing.append("new-paid-customer acquisition path")

    if missing:
        return "INSUFFICIENT_DATA", sorted(set(missing))

    assumed = [key for key in FINANCIAL_INPUTS if inputs[key]["status"] == "assumption"]
    return ("PROVISIONAL", assumed) if assumed else ("EVIDENCE_BACKED", [])


def determine_verdict(status: str, base: dict[str, Any]) -> tuple[str, list[str]]:
    if status == "INSUFFICIENT_DATA":
        return "INSUFFICIENT_DATA", ["Critical operating inputs are missing."]

    contribution = float(base["monthly_contribution_per_paid_customer"])
    gross_margin = base["gross_margin"]
    payback = base["cac_payback_months"]
    reasons: list[str] = []
    if contribution <= 0:
        return "UNSUSTAINABLE", ["ARPU does not cover variable cost per paid customer."]
    if gross_margin is not None and gross_margin < 0.5:
        reasons.append("Base gross/contribution margin is below 50%.")
    if payback is not None and payback > 12:
        reasons.append("Base CAC payback exceeds 12 months.")
    if float(base["full_year_operating_profit"]) <= 0:
        reasons.append("Base full-year operating profit is not positive.")
    if float(base["month_12_operating_profit"]) <= 0:
        reasons.append("Base month 12 operating profit is not positive.")
    if reasons:
        return "FRAGILE", reasons
    return "HEALTHY", ["Base contribution, full-year profit, and month 12 profit are positive."]


def market_value(strategy: dict[str, Any], key: str) -> float | None:
    entry = strategy["market"][key]
    value = entry.get("value")
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def calculate_market_sizing(strategy: dict[str, Any]) -> dict[str, float | None]:
    revenue = market_value(strategy, "annual_revenue_per_account")
    eligible = market_value(strategy, "eligible_accounts")
    serviceable = market_value(strategy, "serviceable_accounts")
    realistic = market_value(strategy, "realistic_accounts_24m")

    def size(accounts: float | None) -> float | None:
        return round(accounts * revenue, 2) if accounts is not None and revenue is not None else None

    return {
        "tam": size(eligible),
        "sam": size(serviceable),
        "som_24m": size(realistic),
    }


def calculate_readiness(
    strategy: dict[str, Any],
    sources: list[dict[str, Any]],
    inputs: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], float, str]:
    source_kinds = {source["kind"] for source in sources}
    caps: dict[str, tuple[int, str]] = {}
    if "demand" not in source_kinds:
        caps["problem_evidence"] = (3, "No direct demand or transaction evidence was supplied.")
        caps["business_model_pricing"] = (
            3,
            "No direct willingness-to-pay or transaction evidence was supplied.",
        )
    if "market" not in source_kinds:
        caps["positioning"] = (2, "No direct competitor or market source was supplied.")
    if "channel" not in source_kinds:
        caps["go_to_market"] = (2, "No public evidence that the target buyer is reachable in the proposed channel.")
    if any(
        inputs[key]["status"] == "unknown" or inputs[key]["value"] is None
        for key in ("monthly_paid_churn_rate", "monthly_acquisition_spend")
    ):
        caps["unit_economics"] = (2, "CAC or churn inputs are unknown.")

    breakdown: list[dict[str, Any]] = []
    total = 0.0
    scores = {item["dimension"]: item for item in strategy["readiness_scores"]}
    for dimension, weight in READINESS_WEIGHTS.items():
        item = scores[dimension]
        submitted = int(item["raw_score"])
        applied = submitted
        cap_reason = ""
        if dimension in caps and applied > caps[dimension][0]:
            applied = caps[dimension][0]
            cap_reason = caps[dimension][1]
        multiplier = EVIDENCE_MULTIPLIERS[item["evidence_strength"]]
        weighted = weight * (applied / 5) * multiplier
        total += weighted
        breakdown.append(
            {
                **item,
                "weight": weight,
                "submitted_raw_score": submitted,
                "applied_raw_score": applied,
                "evidence_multiplier": multiplier,
                "weighted_score": round(weighted, 2),
                "cap_reason": cap_reason,
            }
        )

    score = round(total, 1)
    if score >= 75:
        label = "READY_TO_EXECUTE"
    elif score >= 55:
        label = "PROMISING_VALIDATE_GAPS"
    elif score >= 35:
        label = "WEAK_EVIDENCE_VALIDATE_FIRST"
    else:
        label = "REFRAME_THE_IDEA"
    return breakdown, score, label


def prepare_analysis(raw: dict[str, Any]) -> dict[str, Any]:
    analysis = deepcopy(require_object(raw, "analysis"))
    if analysis.get("schema_version") != 1:
        raise AnalysisError("schema_version must equal 1")
    require_date(analysis.get("generated_at"), "generated_at")
    mode = require_text(analysis.get("mode"), "mode")
    if mode not in MODES:
        raise AnalysisError(f"mode must be one of: {', '.join(sorted(MODES))}")

    validate_product(analysis.get("product"))
    sources = validate_sources(analysis.get("sources"))
    source_urls = {source["url"] for source in sources}
    validate_facts(analysis.get("facts"), source_urls)
    validate_competitors(analysis.get("competitors"), mode)
    strategy = validate_strategy(analysis.get("strategy"))
    validate_business_model(analysis.get("business_model"))
    validate_candidates(analysis.get("monetization_candidates"))
    pricing = validate_pricing(analysis.get("pricing"))
    inputs = validate_financial_inputs(analysis.get("financial_inputs"))
    scenarios = validate_scenarios(analysis.get("scenarios"))
    validate_risks(analysis.get("risks"))
    validate_roadmap(analysis.get("roadmap"))
    validate_text_list(analysis.get("limitations"), "limitations")

    variable_paid = input_value(inputs, "variable_cost_per_paid_customer")
    if (
        pricing["lifetime_verdict"] == "VIABLE"
        and variable_paid is not None
        and variable_paid > 0
        and not pricing["lifetime_constraints"]
    ):
        raise AnalysisError(
            "A VIABLE lifetime verdict with recurring variable cost requires explicit lifetime_constraints"
        )

    status, status_details = determine_status(inputs)
    summaries = [calculate_scenario(inputs, pricing, scenario) for scenario in scenarios]
    base = next(item for item in summaries if item["name"] == "base")
    verdict, verdict_reasons = determine_verdict(status, base)
    readiness_breakdown, readiness_score, readiness_label = calculate_readiness(
        strategy, sources, inputs
    )

    warnings: list[str] = []
    if status == "INSUFFICIENT_DATA":
        warnings.append("Do not use forecast outputs for decisions until critical inputs are populated.")
    elif status == "PROVISIONAL":
        warnings.append("The forecast uses visible assumptions that must be replaced with measured data.")
    if pricing["pricing_confidence"].lower() == "low":
        warnings.append("Pricing confidence is low; validate the offer with real buyer behavior.")
    if not any(source["kind"] == "demand" for source in sources):
        warnings.append("No direct demand or transaction evidence is included.")
    if not any(source["kind"] == "channel" for source in sources):
        warnings.append("The first go-to-market channel lacks direct reachability evidence.")
    if base["blended_cac"] is None:
        warnings.append("CAC is unavailable because the model has no first-month new paid customers.")
    if base["simplified_ltv"] is None:
        warnings.append("Simplified LTV is unavailable because churn or contribution is zero.")

    analysis["analysis_status"] = status
    analysis["status_details"] = status_details
    analysis["financial_verdict"] = verdict
    analysis["verdict_reasons"] = verdict_reasons
    analysis["weighted_tier_arpu"] = round(weighted_arpu(pricing), 2)
    analysis["market_sizing"] = calculate_market_sizing(strategy)
    analysis["readiness_breakdown"] = readiness_breakdown
    analysis["readiness_score"] = readiness_score
    analysis["readiness_label"] = readiness_label
    analysis["scenario_summaries"] = summaries
    analysis["key_metrics"] = {key: value for key, value in base.items() if key != "months"}
    analysis["quality_warnings"] = warnings
    analysis["prepared_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    return analysis


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.expanduser().read_text(encoding="utf-8"))
    return require_object(value, "analysis")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    prepared = prepare_analysis(load_json(args.input))
    args.output.expanduser().parent.mkdir(parents=True, exist_ok=True)
    args.output.expanduser().write_text(
        json.dumps(prepared, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(
        f"Prepared plan: {prepared['analysis_status']} / {prepared['financial_verdict']} -> {args.output}"
    )


if __name__ == "__main__":
    main()
