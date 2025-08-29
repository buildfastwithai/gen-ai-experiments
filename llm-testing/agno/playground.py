# pip install openai duckduckgo-search yfinance sqlalchemy 'fastapi[standard]' agno

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.playground import Playground
from agno.storage.sqlite import SqliteStorage
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.yfinance import YFinanceTools
from agno.team.team import Team
from agno.tools.reasoning import ReasoningTools

# Setting the OpenAI API key from environment variables
import os
from dotenv import load_dotenv
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
if openai_api_key is not None:
    os.environ["OPENAI_API_KEY"] = openai_api_key

agent_storage: str = "tmp/agents.db"

# Agent specializing in web searches
web_agent = Agent(
    name="Web Search Agent",
    role="Handle web search requests and general research",
    model=OpenAIChat(id="gpt-4.1"),
    tools=[DuckDuckGoTools()],
    instructions="Always include sources",
    add_datetime_to_instructions=True,
)

# Agent specializing in financial analysis
finance_agent = Agent(
    name="Finance Agent",
    role="Handle financial data requests and market analysis",
    model=OpenAIChat(id="gpt-4.1"),
    tools=[YFinanceTools(
        stock_price=True, stock_fundamentals=True,
        analyst_recommendations=True, company_info=True
    )],
    instructions=[
        "Use tables to display stock prices, fundamentals (P/E, Market Cap), and recommendations.",
        "Clearly state the company name and ticker symbol.",
        "Focus on delivering actionable financial insights."
    ],
    add_datetime_to_instructions=True,
)

# Team coordinator agent
reasoning_finance_team = Team(
    name="Reasoning Finance Team",
    mode="coordinate",
    model=OpenAIChat(id="gpt-4.1"),
    members=[web_agent, finance_agent],
    tools=[ReasoningTools(add_instructions=True)],
    instructions=[
        "Collaborate to provide comprehensive financial and investment insights.",
        "Consider both fundamental analysis and market sentiment.",
        "Use tables and charts to display data clearly and professionally.",
        "Present findings in a structured, easy-to-follow format.",
        "Only output the final consolidated analysis, not individual agent responses."
    ],
    markdown=True,
    show_members_responses=True,
    enable_agentic_context=True,
    add_datetime_to_instructions=True,
    success_criteria=(
        "The team has provided a complete financial analysis with data, visualizations, "
        "risk assessment, and actionable investment recommendations supported by quantitative analysis and market research."
    ),
)

playground_app = Playground(agents=[web_agent, finance_agent], teams=[reasoning_finance_team],)
app = playground_app.get_app()

if __name__ == "__main__":
    playground_app.serve("playground:app", reload=True)