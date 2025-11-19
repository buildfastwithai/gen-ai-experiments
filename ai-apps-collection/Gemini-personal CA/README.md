# Gemini Personal Finance Planner

Production-ready Streamlit app that combines deterministic financial calculations with AGNO modular agents and Gemini narratives to deliver personalized tax, retirement, and education planning guidance.

## Features
- Sidebar gated by Gemini and AGNO API keys with privacy notice and deterministic assumptions
- Intake agent validating demographics, cashflow, and family goals
- Tax, kids, and retirement agents producing structured insights via deterministic math
- Planner agent leveraging Gemini for human-friendly narratives and structured action lists
- Interactive Plotly visuals (retirement projection, savings mix, child goal costs)
- Downloadable CSV tables for key plan sections
- Streamlit caching around Gemini summaries for faster iterations

## Project Structure
```
app.py
agents/
  intake.py
  tax_agent.py
  kids_agent.py
  retirement_agent.py
  planner_agent.py
llm/
  gemini_client.py
utils/
  finance.py
viz/
  charts.py
tests/
requirements.txt
.env.example
README.md
```

## Setup
1. Clone the repository and enter the project directory.
2. Create and activate a virtual environment.
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Copy `.env.example` to `.env` and populate:
   - `GEMINI_API_KEY`
   - `AGNO_API_KEY`

## Running the App
```
streamlit run app.py
```
Open the provided URL, enter both API keys in the sidebar, adjust assumptions, and generate the plan.

## Tests
Run unit tests for financial utilities and agents:
```
pytest
```

## Notes
- All numeric forecasts rely on deterministic Python logic.
- Gemini is only invoked for the narrative JSON summary via the planner agent.
- Keys remain client-side; the app never stores or logs them.

