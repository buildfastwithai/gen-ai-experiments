# 🏦 Personal Finance Management System

A multi-agent AI financial advisor built with [Agno](https://docs.agno.com) - featuring two specialized agents for comprehensive financial management.

## 🎯 What This Does

This application creates a **Personal Finance Management System** with two AI agents:

- **💰 Finance Assistant**: Provides investment advice, financial planning, and market research
- **📊 Budget Tracker**: Handles expense tracking, spending analysis, and budget optimization

Both agents share a unified database and work together to provide comprehensive financial guidance.

## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- OpenAI API Key

### 1. Setup Environment

```bash
# Create virtual environment
uv venv --python 3.12
source .venv/bin/activate

# Install dependencies
uv pip install -U agno openai 'fastapi[standard]' sqlalchemy
```

### 2. Set API Key

```bash
export OPENAI_API_KEY="your-openai-api-key-here"
```

### 3. Run the Application

```bash
# Start the development server
fastapi dev finance_assistant_app.py

# Your app will be running at:
# 🌐 http://localhost:8000
# 📚 API docs: http://localhost:8000/docs
```

### 4. Connect to AgentOS UI

1. Go to [os.agno.com](https://os.agno.com)
2. Click "Add new OS" 
3. Select "Local"
4. Enter endpoint: `http://localhost:8000`
5. Name it "Finance Management System"
6. Click "Connect"

## 🏗️ Architecture Overview

### Multi-Agent System

```python
# Two specialized agents
finance_agent = Agent(...)  # Investment & planning advice
budget_agent = Agent(...)   # Expense tracking & analysis

# Unified system
finance_os = AgentOS(agents=[finance_agent, budget_agent])
```

### Key Components

| Component | Purpose |
|-----------|---------|
| **AgentOS** | Production runtime for multi-agent orchestration |
| **SqliteDb** | Shared database for persistent conversations |
| **OpenAI GPT-4o** | Language model powering both agents |
| **DuckDuckGo Tools** | Web search for market research |
| **File Tools** | Document processing and analysis |

## 🤖 Agent Capabilities

### Finance Assistant Agent
- **Model**: GPT-4o
- **Tools**: DuckDuckGo search, File processing
- **Specialization**: Investment advice, financial planning, market research
- **Instructions**: Provides practical financial advice with proper disclaimers

### Budget Tracker Agent  
- **Model**: GPT-4o
- **Tools**: File processing
- **Specialization**: Expense tracking, spending pattern analysis
- **Instructions**: Tracks expenses, analyzes patterns, suggests optimizations

## 📊 Features

### ✅ Core Features
- **Multi-agent collaboration** - Two specialized financial agents
- **Persistent conversations** - Shared database maintains context
- **Real-time web search** - Market research and financial data
- **File processing** - Analyze financial documents
- **Production-ready API** - FastAPI with automatic documentation

### ✅ AgentOS Benefits
- **Pre-built FastAPI Runtime** - Ready-to-use web application
- **Integrated Control Plane** - Monitor and manage via web UI
- **Private by Design** - Runs entirely in your environment

## 🛠️ Code Structure

```python
# 1. Create shared database
shared_db = SqliteDb(db_file="finance_system.db")

# 2. Define specialized agents
finance_agent = Agent(
    name="Finance Assistant",
    model=OpenAIChat(id="gpt-4o"),
    tools=[DuckDuckGoTools(), FileTools()],
    db=shared_db
)

budget_agent = Agent(
    name="Budget Tracker",
    model=OpenAIChat(id="gpt-4o"), 
    tools=[FileTools()],
    db=shared_db
)

# 3. Create AgentOS system
finance_os = AgentOS(
    agents=[finance_agent, budget_agent],
    name="Personal Finance Management System"
)

# 4. Get FastAPI app
app = finance_os.get_app()
```

## 🔧 Configuration Options

### Environment Variables
```bash
# Required
OPENAI_API_KEY=your-openai-api-key

# Optional
AGNO_LOG_LEVEL=INFO
AGNO_DB_URL=sqlite:///finance_system.db
```

### Customization

#### Add More Tools
```python
from agno.tools.calculator import CalculatorTools
from agno.tools.email import EmailTools

# Add to agent tools
tools=[DuckDuckGoTools(), FileTools(), CalculatorTools(), EmailTools()]
```

#### Change Models
```python
from agno.models.anthropic import Claude

# Use Claude instead
model=Claude(id="claude-sonnet-4-5")
```

#### Add Memory
```python
from agno.memory.db import DbMemory

# Add long-term memory
memory=DbMemory(db=shared_db)
```

## 📡 API Endpoints

Once running, your application provides these endpoints:

- `GET /health` - Health check
- `GET /agents` - List available agents  
- `POST /agents/{agent_name}/runs` - Chat with specific agent
- `GET /sessions` - Manage conversation sessions
- `GET /docs` - Interactive API documentation

## 🎯 Usage Examples

### Chat with Finance Assistant
```bash
curl -X POST "http://localhost:8000/agents/finance-assistant/runs" \
  -H "Content-Type: application/json" \
  -d '{"message": "What should I know about investing in index funds?"}'
```

### Chat with Budget Tracker
```bash
curl -X POST "http://localhost:8000/agents/budget-tracker/runs" \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze my monthly spending patterns"}'
```

## 🚀 Production Deployment

### Using AgentOS Serve
```python
if __name__ == "__main__":
    finance_os.serve(
        app="finance_assistant_app:app",
        host="0.0.0.0", 
        port=8001
    )
```

### Using Docker
```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["fastapi", "run", "finance_assistant_app.py", "--host", "0.0.0.0", "--port", "8000"]
```

## 🔍 Monitoring & Debugging

### View Logs
```bash
# Enable debug mode
export AGNO_LOG_LEVEL=DEBUG
fastapi dev finance_assistant_app.py
```

### Database Inspection
```python
# Check stored conversations
from agno.db.sqlite import SqliteDb
db = SqliteDb(db_file="finance_system.db")
# Inspect tables and data
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📚 Learn More

- [Agno Documentation](https://docs.agno.com)
- [AgentOS Guide](https://docs.agno.com/concepts/agentos)
- [Agent Building Guide](https://docs.agno.com/concepts/agents/building-agents)
- [Cookbook Examples](https://github.com/agno-agi/agno/tree/main/cookbook)

## 📄 License

This project is licensed under the MIT License.

---

**Built with ❤️ using [Agno](https://agno.com) - The fastest multi-agent framework**
