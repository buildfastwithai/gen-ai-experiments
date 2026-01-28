from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from agno.models.google import GeminiModel
from agno.os import AgentOS
from agno.tools.mcp import MCPTools

# ************* Create Agent with Gemini 3 Pro *************
gemini_agent = Agent(
    name="Gemini Agent",
    model=GeminiModel(id="gemini-3-pro-preview"),  
    db=SqliteDb(db_file="tmp/gemini_agent.db"),
    tools=[MCPTools(transport="streamable-http", url="https://docs.agno.com/mcp")],
    add_history_to_context=True,
    add_datetime_to_context=True,
    enable_agentic_memory=True,
    num_history_runs=3,
    markdown=True,
)

# ************* Create AgentOS *************
agent_os = AgentOS(agents=[gemini_agent])
app = agent_os.get_app()

# ************* Run AgentOS *************
if __name__ == "__main__":
    agent_os.serve(app="gemini_agent:app", reload=True)
