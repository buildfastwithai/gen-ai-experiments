from typing import List, Optional
import json
import os

import streamlit as st
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from pydantic import BaseModel, Field




# -------------------------
# Schemas
# -------------------------
class ArchitectureRequest(BaseModel):
    description: str = Field(..., description="Feature or product requirement to design")
    constraints: Optional[List[str]] = Field(
        default=None, description="Hard constraints (compliance, stack, budget, latency)"
    )
    non_functionals: Optional[List[str]] = Field(
        default=None, description="NFRs like availability, RTO/RPO, SLOs, scalability"
    )


class ArchitecturePlan(BaseModel):
    executive_summary: str = Field(..., description="Short summary of the recommended approach")
    high_level_diagram: List[str] = Field(
        ..., description="Bullet list representing a high-level diagram of components"
    )
    services_and_responsibilities: List[str] = Field(
        ..., description="Service decomposition with clear responsibilities"
    )
    api_design: List[str] = Field(
        ..., description="Key APIs/endpoints including purpose and payload highlights"
    )
    data_model: List[str] = Field(
        ..., description="Important entities and relationships (bulleted modeling notes)"
    )
    data_and_caching: List[str] = Field(
        ..., description="Caching strategy, storage choices, TTLs, and invalidation approach"
    )
    scalability_and_reliability: List[str] = Field(
        ..., description="Scaling approach, availability targets, and failure handling"
    )
    security_and_compliance: List[str] = Field(
        ..., description="Security controls, authn/z, secrets, and compliance considerations"
    )
    delivery_plan: List[str] = Field(
        ..., description="Phased milestones with risks and mitigations"
    )


# -------------------------
# App Config
# -------------------------
st.set_page_config(page_title="Architecture Plan Generator", page_icon="🧭", layout="wide")
st.title("🧭 Architecture Plan Generator")
st.caption("Generate a pragmatic architecture plan from a short requirement.")


# -------------------------
# Sidebar: Keys and Settings (always from sidebar)
# -------------------------

with st.sidebar:
    # === BRANDING SECTION ===
    st.markdown(
        "<div style='text-align: center; margin: 2px 0;'>"
        "<a href='https://www.buildfastwithai.com/' target='_blank' style='text-decoration: none;'>"
        "<div style='border: 2px solid #e0e0e0; border-radius: 6px; padding: 4px; "
        "background: linear-gradient(145deg, #ffffff, #f5f5f5); "
        "box-shadow: 0 2px 6px rgba(0,0,0,0.1); "
        "transition: all 0.3s ease; display: inline-block; width: 100%;'>"
        "<img src='https://github.com/Shubhwithai/chat-with-qwen/blob/main/company_logo.png?raw=true' "
        "style='width: 100%; max-width: 100%; height: auto; border-radius: 8px; display: block;' "
        "alt='Build Fast with AI Logo'>"
        "</div>"
        "</a>"
    "</div>",
    unsafe_allow_html=True
    )

    st.header("Configuration")

    openai_key = st.text_input("OpenAI API Key", type="password", placeholder="sk-...")

    main_model_id = st.text_input("Main Model ID (OpenAI)", value="gpt-5-nano")
    parser_model_id = st.text_input("Parser Model ID (OpenAI)", value="gpt-5-nano")

    run_btn = st.button("Generate Plan", use_container_width=True)

    st.markdown("---")
    st.header("About this app")
    st.markdown("""
    This app uses OpenAI to generate an architecture plan from a short requirement.
    
    **Features:**
    - Generate an architecture plan from a short requirement
    - Use OpenAI to generate the architecture plan, parse the architecture plan, and return the architecture plan in a JSON format
    """)
    
    st.markdown("---")
    st.markdown(
        "**❤️ Built by** [Build Fast with AI](https://buildfastwithai.com/genai-course)",
        unsafe_allow_html=True
    )


# -------------------------
# Main Inputs
# -------------------------
col1, col2 = st.columns([3, 2])
with col1:
    description = st.text_area(
        "Describe the feature or product",
        height=200,
        placeholder=(
            "Example: Build a real-time collaborative note editor with presence, comments, "
            "and offline sync for teams up to 1k users. Target P95 latency <150ms."
        ),
    )
with col2:
    constraints_raw = st.text_area(
        "Constraints (optional)", height=100, placeholder="One per line (e.g., HIPAA, Postgres, region: us-east-1)"
    )
    nfr_raw = st.text_area(
        "Non-Functionals (optional)", height=100, placeholder="SLOs, availability, RTO/RPO, cost limits, scalability"
    )


def _parse_lines(text: str) -> List[str]:
    lines = [line.strip(" \t\n\r") for line in text.split("\n")]
    return [line for line in lines if line]


def _build_model(model_id: str):
    if not os.environ.get("OPENAI_API_KEY"):
        raise ValueError("Missing OpenAI API key in sidebar.")
    return OpenAIChat(id=model_id)


def _build_agent(model_obj, parser_model_id: str) -> Agent:
    return Agent(
        model=model_obj,
        tools=[],
        instructions=(
            "You are a seasoned systems architect. Produce a concise, actionable architecture plan "
            "that balances delivery speed with reliability and cost. Prefer boring, proven tech. "
            "Quantify choices where sensible. Ensure the output matches the JSON schema."
        ),
        input_schema=ArchitectureRequest,
        output_schema=ArchitecturePlan,
        parser_model=OpenAIChat(id=parser_model_id),
    )


if run_btn:
    if not description.strip():
        st.warning("Please provide a description.")
        st.stop()

    # Always take keys from sidebar → export to env for SDKs
    if openai_key:
        os.environ["OPENAI_API_KEY"] = openai_key

    # Validate required key
    if not os.environ.get("OPENAI_API_KEY"):
        st.error("OpenAI API Key is required (sidebar).")
        st.stop()

    try:
        model = _build_model(main_model_id)
    except Exception as e:
        st.error(str(e))
        st.stop()

    constraints = _parse_lines(constraints_raw) if constraints_raw else None
    nfrs = _parse_lines(nfr_raw) if nfr_raw else None

    request = ArchitectureRequest(
        description=description.strip(),
        constraints=constraints,
        non_functionals=nfrs,
    )

    agent = _build_agent(model, parser_model_id)

    with st.spinner("Generating architecture plan..."):
        response = agent.run(input=request)

    raw_content = getattr(response, "content", response)

    # Normalize to dict for rendering
    if hasattr(raw_content, "model_dump"):
        content = raw_content.model_dump()
    elif hasattr(raw_content, "dict"):
        content = raw_content.dict()
    elif isinstance(raw_content, dict):
        content = raw_content
    elif isinstance(raw_content, str):
        try:
            content = json.loads(raw_content)
        except Exception:
            content = {"executive_summary": raw_content}
    else:
        content = {"executive_summary": str(raw_content)}

    st.success("Plan generated.")

    # Render structured output
    st.subheader("Executive Summary")
    st.write(content.get("executive_summary", ""))

    def section(title: str, items_key: str):
        st.markdown(f"**{title}**")
        items = content.get(items_key) or []
        for bullet in items:
            st.markdown(f"- {bullet}")

    section("High-level Diagram", "high_level_diagram")
    section("Services & Responsibilities", "services_and_responsibilities")
    section("API Design", "api_design")
    section("Data Model", "data_model")
    section("Data & Caching", "data_and_caching")
    section("Scalability & Reliability", "scalability_and_reliability")
    section("Security & Compliance", "security_and_compliance")
    section("Delivery Plan", "delivery_plan")

    with st.expander("Raw JSON"):
        st.json(content)

    st.download_button(
        label="Download JSON",
        data=json.dumps(content, indent=2),
        file_name="architecture_plan.json",
        mime="application/json",
        use_container_width=True,
    )