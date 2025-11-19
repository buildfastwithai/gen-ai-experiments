from __future__ import annotations

from typing import Dict, List

import pandas as pd
import streamlit as st

from agents import IntakeAgent, KidsAgent, PlannerAgent, RetirementAgent, TaxAgent
from llm import GeminiClient
from viz import (
    allocation_stack_chart,
    expense_donut_chart,
    kids_goal_chart,
    retirement_projection_chart,
)


st.set_page_config(page_title="Personal Finance Planner", layout="wide")


def sidebar_configuration() -> Dict[str, object]:
    with st.sidebar:
        st.header("API Keys")
        gemini_key = st.text_input("Gemini API Key", type="password")
        agno_key = st.text_input("AGNO API Key / Config", type="password")
        st.markdown("### About this app")
        st.markdown(
            "Generates a personalized, intelligent financial plan covering tax steps, "
            "retirement readiness, education funding, and savings guidance."
        )
        st.markdown("Keys stay on your device and are discarded after the session.")
        st.markdown("Version 1.0.0")
        with st.expander("Assumptions"):
            default_inflation = st.number_input("Inflation (%)", 2.0, 12.0, 5.0, 0.25)
            default_return = st.number_input("Expected return (%)", 6.0, 18.0, 12.0, 0.25)
            default_retirement_age = st.number_input("Default retirement age", 40, 80, 60, 1)
        return {
            "gemini_key": gemini_key,
            "agno_key": agno_key,
            "default_inflation": default_inflation,
            "default_return": default_return,
            "default_retirement_age": default_retirement_age,
        }


def capture_user_inputs(defaults: Dict[str, float]) -> Dict[str, object]:
    with st.form("planner-form", clear_on_submit=False):
        st.subheader("Tell us about yourself")
        col1, col2, col3 = st.columns(3)
        age = col1.number_input("Age", 21, 65, 32, 1)
        monthly_expenses = col2.number_input("Monthly expenses (₹)", 10000, 1000000, 80000, 1000)
        annual_income = col3.number_input("Annual income (₹)", 300000, 10000000, 2400000, 50000)
        designation = st.selectbox(
            "Designation",
            ["Junior Dev", "Senior Dev", "Manager", "Director", "Self-employed"],
        )
        kids_count = st.slider("Number of kids", 0, 5, 1, 1)
        assumptions_note = st.text_area("Key assumptions or goals", placeholder="Boost emergency fund, buy a second home, etc.")
        with st.expander("Optional overrides"):
            inflation_override = st.number_input(
                "Inflation override (%)",
                0.0,
                20.0,
                defaults["default_inflation"],
                0.25,
            )
            return_override = st.number_input(
                "Expected return override (%)",
                0.0,
                25.0,
                defaults["default_return"],
                0.25,
            )
            retirement_age_override = st.number_input(
                "Planned retirement age",
                40,
                80,
                defaults["default_retirement_age"],
                1,
            )
        children_inputs: List[Dict[str, str]] = []
        for idx in range(kids_count):
            with st.expander(f"Child {idx + 1} plan"):
                child_age = st.number_input(f"Current age (Child {idx + 1})", 0, 21, 5, 1, key=f"child_age_{idx}")
                goal = st.selectbox(
                    f"Goal focus (Child {idx + 1})",
                    ["college", "sports", "other"],
                    key=f"goal_{idx}",
                )
                start_year = st.number_input(
                    f"Goal start age (Child {idx + 1})",
                    child_age + 1,
                    30,
                    child_age + 10,
                    1,
                    key=f"start_year_{idx}",
                )
                risk_profile = st.selectbox(
                    f"Risk profile (Child {idx + 1})",
                    ["Conservative", "Moderate", "Aggressive"],
                    key=f"risk_{idx}",
                )
                children_inputs.append(
                    {
                        "current_age": str(child_age),
                        "goal": goal,
                        "start_year": str(start_year),
                        "risk_profile": risk_profile,
                    }
                )
        submitted = st.form_submit_button("Generate financial plan")
        return {
            "submitted": submitted,
            "age": age,
            "monthly_expenses": monthly_expenses,
            "annual_income": annual_income,
            "designation": designation,
            "kids_count": kids_count,
            "children": children_inputs,
            "inflation_rate": inflation_override,
            "expected_return": return_override,
            "retirement_age": retirement_age_override,
            "assumptions_note": assumptions_note,
        }


@st.cache_data(show_spinner=False)
def build_cached_plan(
    gemini_key: str,
    agno_key: str,
    intake_payload: Dict[str, float],
    retirement_plan: Dict[str, float],
    kids_plan: List[Dict[str, object]],
    tax_plan: Dict[str, List[str]],
) -> Dict[str, object]:
    client = GeminiClient(api_key=gemini_key)
    planner = PlannerAgent(gemini_client=client, agno_api_key=agno_key)
    return planner.build_plan(intake_payload, retirement_plan, kids_plan, tax_plan)


def render_summary_card(summary: Dict[str, object]):
    st.markdown("### Summary")
    with st.container():
        st.markdown(f"**Narrative:** {summary.get('narrative', '')}")
        actions = summary.get("priority_actions", [])
        if actions:
            st.markdown("**Priority Actions**")
            for action in actions:
                st.markdown(f"- {action}")
        notes = summary.get("notes", [])
        if notes:
            st.markdown("**Notes**")
            for note in notes:
                st.markdown(f"- {note}")


def render_charts(plan: Dict[str, object], expected_return: float):
    columns = st.columns(2)
    retirement = plan["retirement"]
    columns[0].plotly_chart(
        retirement_projection_chart(
            retirement["suggested_monthly_investment"],
            expected_return,
            int(retirement["years_to_retirement"]),
            retirement["target_corpus"],
        ),
        use_container_width=True,
    )
    columns[1].plotly_chart(
        expense_donut_chart(plan["savings_allocation"]),
        use_container_width=True,
    )
    st.plotly_chart(allocation_stack_chart(plan["savings_allocation"]), use_container_width=True)
    if plan["kids"]:
        st.plotly_chart(kids_goal_chart(plan["kids"]), use_container_width=True)


def render_tables(plan: Dict[str, object]):
    retirement_df = pd.DataFrame([plan["retirement"]])
    st.dataframe(retirement_df, use_container_width=True)
    st.download_button(
        "Download retirement plan",
        data=retirement_df.to_csv(index=False),
        file_name="retirement_plan.csv",
        mime="text/csv",
    )
    kids = plan["kids"]
    if kids:
        kids_df = pd.DataFrame(kids)
        st.dataframe(kids_df, use_container_width=True)
        st.download_button(
            "Download child plans",
            data=kids_df.to_csv(index=False),
            file_name="child_plans.csv",
            mime="text/csv",
        )
    tax_rows = []
    for action in plan["tax"]["priority"]:
        tax_rows.append({"Type": "Priority", "Recommendation": action})
    for action in plan["tax"]["additional"] or []:
        tax_rows.append({"Type": "Additional", "Recommendation": action})
    if not tax_rows:
        tax_rows.append({"Type": "Info", "Recommendation": "No tax actions detected"})
    tax_df = pd.DataFrame(tax_rows)
    st.dataframe(tax_df, use_container_width=True)
    st.download_button(
        "Download tax ideas",
        data=tax_df.to_csv(index=False),
        file_name="tax_ideas.csv",
        mime="text/csv",
    )


sidebar_state = sidebar_configuration()

if not sidebar_state["gemini_key"] or not sidebar_state["agno_key"]:
    st.title("Streamlined Financial Planning")
    st.info("Enter both API keys in the sidebar to activate the planner.")
    st.stop()

intake_state = capture_user_inputs(sidebar_state)

if not intake_state["submitted"]:
    st.warning("Provide your details and hit Generate to see recommendations.")
    st.stop()

intake_agent = IntakeAgent()
normalized_payload, intake_errors = intake_agent.run(
    {
        "age": str(intake_state["age"]),
        "monthly_expenses": str(intake_state["monthly_expenses"]),
        "annual_income": str(intake_state["annual_income"]),
        "retirement_age": str(intake_state["retirement_age"]),
        "number_of_kids": str(intake_state["kids_count"]),
    }
)

if intake_errors:
    for issue in intake_errors:
        st.error(issue)
    st.stop()

tax_agent = TaxAgent(
    designation=intake_state["designation"],
    annual_income=normalized_payload["annual_income"],
)
tax_plan = tax_agent.run()

kids_agent = KidsAgent(
    children=intake_state["children"],
    inflation_rate=intake_state["inflation_rate"],
    expected_return=intake_state["expected_return"],
)
kids_plan = kids_agent.run()

retirement_agent = RetirementAgent(
    age=int(normalized_payload["age"]),
    retirement_age=int(intake_state["retirement_age"]),
    monthly_expenses=normalized_payload["monthly_expenses"],
    inflation_rate=intake_state["inflation_rate"],
    expected_return=intake_state["expected_return"],
)
retirement_plan = retirement_agent.run()

try:
    structured_plan = build_cached_plan(
        gemini_key=sidebar_state["gemini_key"],
        agno_key=sidebar_state["agno_key"],
        intake_payload={
            "age": normalized_payload["age"],
            "monthly_expenses": normalized_payload["monthly_expenses"],
            "annual_income": normalized_payload["annual_income"],
            "designation": intake_state["designation"],
            "assumptions_note": intake_state["assumptions_note"],
        },
        retirement_plan=retirement_plan,
        kids_plan=[kid.__dict__ for kid in kids_plan],
        tax_plan=tax_plan,
    )
except Exception as exc:
    st.error(f"Unable to generate Gemini summary: {exc}")
    st.stop()

st.title("Intelligent Personal Finance Plan")
render_summary_card(structured_plan["llm_summary"])
render_charts(structured_plan, intake_state["expected_return"])
render_tables(structured_plan)

