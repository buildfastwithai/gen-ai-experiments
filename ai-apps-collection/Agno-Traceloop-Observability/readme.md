# Agno + Traceloop Streamlit 

A Streamlit application demonstrating AI agent observability using **Agno** framework with **Traceloop** for OpenTelemetry-based tracing.

## Features

- **Single Agent Chat**: Basic conversational AI with automatic tracing
- **Multi-Agent Team**: Researcher + Writer team collaboration with nested spans
- **Agent with Tools**: Weather and calculator tools with tool call tracing

## Prerequisites

1. **Python 3.9+**
2. **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
3. **Traceloop API Key**: 
   - Sign up at [Traceloop](https://app.traceloop.com/)
   - Get your API key from Settings > API Keys

## Installation

```bash
# Clone or navigate to the project directory
cd agno-traceloop-app

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Configuration

### Option 1: Environment Variables

```bash
export OPENAI_API_KEY=your-openai-api-key
export TRACELOOP_API_KEY=your-traceloop-api-key
```

### Option 2: .env File

Copy the example file and fill in your keys:

```bash
cp .env.example .env
# Edit .env with your API keys
```

### Option 3: Streamlit UI

Enter your API keys directly in the sidebar when running the app.

## Running the App

```bash
streamlit run app.py
```

The app will open at `http://localhost:8501`

## Viewing Traces

1. Make some requests in the Streamlit app
2. Open [Traceloop Dashboard](https://app.traceloop.com/)
3. View detailed traces including:
   - LLM calls with prompts/completions
   - Agent execution spans
   - Tool call spans
   - Multi-agent team coordination

## Architecture

```
┌─────────────────────────────────────────┐
│           Streamlit UI                   │
├─────────────────────────────────────────┤
│                                          │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │Single Agent │  │ Multi-Agent Team│   │
│  └─────────────┘  └─────────────────┘   │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │    Agent with Tools             │    │
│  │  (Weather + Calculator)         │    │
│  └─────────────────────────────────┘    │
│                                          │
├─────────────────────────────────────────┤
│         Agno Framework                   │
├─────────────────────────────────────────┤
│       Traceloop SDK (OpenTelemetry)     │
└─────────────────────────────────────────┘
            │
            ▼
    Traceloop Dashboard
```

## Key Concepts

### Traceloop Initialization

```python
from traceloop.sdk import Traceloop

# Must be called before creating agents
Traceloop.init(app_name="my_app", disable_batch=True)
```

### Agent Tracing

Agent execution is automatically instrumented - no additional code needed:

```python
from agno.agent import Agent
from agno.models.openai import OpenAIChat

agent = Agent(
    name="Assistant",
    model=OpenAIChat(id="gpt-4o-mini"),
)

# Automatically traced!
response = agent.run("Hello!")
```

### Team Tracing

Team execution creates parent spans with child spans for each agent:

```python
from agno.team import Team

team = Team(
    name="MyTeam",
    members=[agent1, agent2],
    model=OpenAIChat(id="gpt-4o-mini"),
)

# Creates hierarchical traces
result = team.run("Collaborate on this task")
```

## Privacy Control

To disable logging prompts and completions:

```bash
export TRACELOOP_TRACE_CONTENT=false
```

## Resources

- [Agno Documentation](https://docs.agno.com)
- [Traceloop Documentation](https://www.traceloop.com/docs)
- [Agno + Traceloop Integration Guide](https://docs.agno.com/integrations/observability/traceloop)

## License

MIT
