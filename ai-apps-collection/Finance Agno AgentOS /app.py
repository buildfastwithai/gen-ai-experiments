from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from agno.models.openai import OpenAIChat
from agno.os import AgentOS
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.file import FileTools

# Financial Assistant Agent
finance_agent = Agent(
    name="Finance Assistant",
    model=OpenAIChat(id="gpt-4.1"),
    description="AI financial advisor for budgeting, investments, and planning",
    tools=[DuckDuckGoTools(), FileTools()],
    db=SqliteDb(db_file="finance.db", id="finance_db"),
    instructions=["Provide practical financial advice with proper disclaimers"]
)

# Budget Tracker Agent
budget_agent = Agent(
    name="Budget Tracker", 
    model=OpenAIChat(id="gpt-4.1"),
    description="Expense tracking and budget management specialist",
    tools=[FileTools()],
    db=SqliteDb(db_file="budget.db", id="budget_db"),
    instructions=["Track expenses, analyze spending patterns, suggest optimizations"]
)

# Create the AgentOS for Financial Management
finance_os = AgentOS(
    agents=[finance_agent, budget_agent],
    name="Personal Finance Management System",
    description="AI-powered financial assistant for personal finance management"
)

# Get the FastAPI app
app = finance_os.get_app()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
 