from utils.finance import (
    ChildGoalResult,
    calculate_retirement_plan,
    estimate_child_goals,
    inflation_adjust,
    reverse_sip_payment,
    sip_future_value,
)


def test_inflation_adjust_increases_value():
    assert round(inflation_adjust(1000, 5, 2), 2) == round(1000 * 1.1025, 2)


def test_sip_future_value_zero_rate():
    assert sip_future_value(1000, 0, 1) == 12000


def test_reverse_sip_payment_zero_rate():
    assert reverse_sip_payment(12000, 0, 1) == 1000


def test_estimate_child_goals_returns_results():
    children = [
        {"current_age": "5", "goal": "college", "start_year": "18", "risk_profile": "Moderate"},
    ]
    plans = estimate_child_goals(children, 5, 10)
    assert len(plans) == 1
    assert isinstance(plans[0], ChildGoalResult)


def test_calculate_retirement_plan_keys_present():
    plan = calculate_retirement_plan(30, 60, 50000, 5, 12)
    for key in [
        "years_to_retirement",
        "inflated_monthly_expense",
        "target_corpus",
        "suggested_monthly_investment",
        "projected_corpus",
    ]:
        assert key in plan

