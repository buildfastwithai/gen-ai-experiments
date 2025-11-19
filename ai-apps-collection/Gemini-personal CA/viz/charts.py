from __future__ import annotations

from typing import Dict, List

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from utils.finance import sip_future_value


def retirement_projection_chart(
    suggested_monthly_investment: float,
    expected_return: float,
    years_to_retirement: int,
    target_corpus: float,
) -> go.Figure:
    years = list(range(0, years_to_retirement + 1))
    corpus = [
        sip_future_value(
            monthly_investment=suggested_monthly_investment,
            annual_return=expected_return,
            years=year,
        )
        for year in years
    ]
    df = pd.DataFrame({"Year": years, "Projected Corpus": corpus})
    fig = px.line(df, x="Year", y="Projected Corpus", markers=True)
    fig.add_hline(y=target_corpus, line_dash="dot", line_color="#F97316", annotation_text="Target Corpus")
    fig.update_layout(title="Retirement Corpus Projection", template="plotly_white")
    return fig


def kids_goal_chart(kids_plan: List[Dict[str, float]]) -> go.Figure:
    if not kids_plan:
        return go.Figure()
    df = pd.DataFrame(kids_plan)
    fig = px.bar(
        df,
        x="name",
        y="inflated_cost",
        color="risk_profile",
        hover_data=["goal", "years_to_goal", "required_sip"],
    )
    fig.update_layout(title="Child Goal Cost Forecast", template="plotly_white", yaxis_title="Cost (₹)")
    return fig


def expense_donut_chart(allocation: Dict[str, float]) -> go.Figure:
    labels = list(allocation.keys())
    values = list(allocation.values())
    fig = go.Figure(data=[go.Pie(labels=labels, values=values, hole=0.55)])
    fig.update_layout(title="Expense & Savings Mix", template="plotly_white")
    return fig


def allocation_stack_chart(allocation: Dict[str, float]) -> go.Figure:
    df = pd.DataFrame({"Category": list(allocation.keys()), "Amount": list(allocation.values())})
    fig = px.bar(df, x="Category", y="Amount", color="Category", text_auto=".2s")
    fig.update_layout(showlegend=False, title="Monthly Allocation Snapshot", template="plotly_white")
    return fig

