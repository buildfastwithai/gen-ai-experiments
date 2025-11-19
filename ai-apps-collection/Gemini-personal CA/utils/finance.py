from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

MONTHS_IN_YEAR = 12


def inflation_adjust(value: float, inflation_rate: float, years: float) -> float:
    rate = (inflation_rate or 0) / 100
    return value * ((1 + rate) ** years)


def sip_future_value(monthly_investment: float, annual_return: float, years: float) -> float:
    monthly_rate = (annual_return or 0) / 100 / MONTHS_IN_YEAR
    periods = int(years * MONTHS_IN_YEAR)
    if monthly_rate == 0:
        return monthly_investment * periods
    return monthly_investment * (((1 + monthly_rate) ** periods - 1) / monthly_rate) * (1 + monthly_rate)


def required_corpus(monthly_retirement_expense: float, post_ret_return: float, retirement_years: int) -> float:
    rate = (post_ret_return or 0) / 100
    annual_expense = monthly_retirement_expense * MONTHS_IN_YEAR
    if rate == 0:
        return annual_expense * retirement_years
    return annual_expense * (1 - (1 + rate) ** (-retirement_years)) / rate


def available_monthly_savings(annual_income: float, monthly_expenses: float) -> float:
    discretionary = max(annual_income / MONTHS_IN_YEAR - monthly_expenses, 0)
    return discretionary * 0.5


def calculate_retirement_plan(
    age: int,
    retirement_age: int,
    monthly_expenses: float,
    inflation_rate: float,
    expected_return: float,
    current_corpus: float = 0,
    post_retirement_return: float = 5,
    retirement_years: int = 30,
) -> Dict[str, float]:
    years_to_retirement = max(retirement_age - age, 0)
    inflated_expense = inflation_adjust(monthly_expenses, inflation_rate, years_to_retirement)
    target_corpus = required_corpus(inflated_expense, post_retirement_return, retirement_years)
    required_monthly_investment = reverse_sip_payment(
        goal_amount=target_corpus,
        annual_return=expected_return,
        years=years_to_retirement,
        current_value=current_corpus,
    )
    projected_corpus = sip_future_value(required_monthly_investment, expected_return, years_to_retirement)
    return {
        "years_to_retirement": years_to_retirement,
        "inflated_monthly_expense": inflated_expense,
        "target_corpus": target_corpus,
        "suggested_monthly_investment": required_monthly_investment,
        "projected_corpus": projected_corpus,
    }


def reverse_sip_payment(goal_amount: float, annual_return: float, years: float, current_value: float = 0) -> float:
    months = int(years * MONTHS_IN_YEAR) or 1
    monthly_rate = (annual_return or 0) / 100 / MONTHS_IN_YEAR
    adjusted_goal = max(goal_amount - current_value * ((1 + monthly_rate) ** months), 0)
    if monthly_rate == 0:
        return adjusted_goal / months
    return adjusted_goal * monthly_rate / (((1 + monthly_rate) ** months - 1) * (1 + monthly_rate))


@dataclass
class ChildGoalResult:
    name: str
    current_age: int
    goal: str
    start_year: int
    years_to_goal: int
    inflated_cost: float
    required_sip: float
    risk_profile: str


def estimate_child_goals(
    children: List[Dict[str, str]],
    inflation_rate: float,
    expected_return: float,
) -> List[ChildGoalResult]:
    plans: List[ChildGoalResult] = []
    for index, child in enumerate(children, start=1):
        current_age = int(child.get("current_age") or 0)
        goal = child.get("goal") or "college"
        start_year = int(child.get("start_year") or 0)
        years_to_goal = max(start_year - current_age, 0)
        base_cost = child_cost_baseline(goal)
        inflated = inflation_adjust(base_cost, inflation_rate, years_to_goal)
        sip = reverse_sip_payment(
            goal_amount=inflated,
            annual_return=expected_return,
            years=years_to_goal,
        )
        plans.append(
            ChildGoalResult(
                name=f"Child {index}",
                current_age=current_age,
                goal=goal,
                start_year=start_year,
                years_to_goal=years_to_goal,
                inflated_cost=inflated,
                required_sip=sip,
                risk_profile=child.get("risk_profile", "Moderate"),
            )
        )
    return plans


def child_cost_baseline(goal: str) -> float:
    mapping = {
        "college": 2500000,
        "sports": 1500000,
        "other": 1000000,
    }
    return mapping.get(goal.lower(), mapping["other"])


def derive_tax_saving_options(annual_income: float, designation: str) -> List[str]:
    options = [
        "Maximize Section 80C with ELSS, EPF, or PPF contributions up to ₹1.5L",
        "Use Section 80D medical insurance premiums for family coverage",
    ]
    if annual_income > 1500000:
        options.append("Consider the new tax regime if deductions are limited")
    if designation.lower() in {"self-employed", "director"}:
        options.append("Claim business expense deductions and set up NPS Tier-1")
    else:
        options.append("Opt for employer NPS contributions under Section 80CCD(2)")
    return options


def compute_expense_allocation(monthly_expenses: float, monthly_income: float) -> Dict[str, float]:
    essentials = monthly_expenses * 0.6
    lifestyle = monthly_expenses * 0.3
    surplus = max(monthly_income - monthly_expenses, 0)
    investments = surplus * 0.5
    emergency = surplus * 0.2
    flexibility = surplus - investments - emergency
    return {
        "Essentials": essentials,
        "Lifestyle": lifestyle,
        "Investments": investments,
        "Emergency": emergency,
        "Flexibility": flexibility,
    }


def validate_user_inputs(payload: Dict[str, str]) -> Tuple[Dict[str, float], List[str]]:
    errors: List[str] = []
    normalized: Dict[str, float] = {}
    required_numbers = {
        "age": (18, 70),
        "monthly_expenses": (1000, 5000000),
        "annual_income": (100000, 100000000),
        "retirement_age": (40, 80),
    }
    for field, (min_value, max_value) in required_numbers.items():
        value = payload.get(field)
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            errors.append(f"{field.replace('_', ' ').title()} must be numeric")
            continue
        if numeric < min_value or numeric > max_value:
            errors.append(f"{field.replace('_', ' ').title()} must be between {min_value} and {max_value}")
        else:
            normalized[field] = numeric
    number_of_kids = payload.get("number_of_kids", 0)
    try:
        normalized["number_of_kids"] = int(number_of_kids)
    except (TypeError, ValueError):
        errors.append("Number of kids must be an integer")
    return normalized, errors

