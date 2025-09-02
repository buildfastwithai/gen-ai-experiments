## Deepagent Stock Research Chat App

A Streamlit chat application that wraps a multi-agent stock research workflow built on the `deepagents` library. It uses `langchain_openai` with your OpenAI API key, and `yfinance` for market/financial data.

### Features
- **Chat-based interface** with message history
- **Sidebar OpenAI API key input** (stored in session only)
- **Multi-agent research flow** (fundamental, technical, risk)
- **Built-in tools** for prices, financials, and technical indicators

### Requirements
- **Python**: 3.9+
- **OpenAI API key**

### Installation
1. Create and activate a virtual environment (recommended).
2. Install dependencies:
```bash
pip install -r requirements.txt
```
If you don't have a requirements file, install the core packages:
```bash
pip install streamlit deepagents langchain-openai yfinance python-dotenv
```

### Configuration
Provide your OpenAI key in one of two ways:
- **In the app sidebar** (preferred for local use); or
- **Environment variable** before running Streamlit:
```bash
# Windows PowerShell
setx OPENAI_API_KEY "YOUR_KEY_HERE"

# macOS/Linux
export OPENAI_API_KEY="YOUR_KEY_HERE"
```

### Run the App
From the project root:
```bash
streamlit run deepagents/app.py
```
Open the local URL shown in your terminal.

### Usage
1. Open the app in your browser.
2. Enter your OpenAI API key in the sidebar.
3. Ask a question in chat, for example:
   - "Analyze AAPL fundamentals and risks"
   - "Provide a technical analysis on NVDA with indicators"
4. The assistant uses built-in tools and sub-agents to produce a structured response.

### Notes
- The sidebar key updates `OPENAI_API_KEY` for the current app session and initializes the agent.
- Market data comes from `yfinance`; availability can vary by ticker/region.
- Chat and keys are not persisted; refresh clears state.

### Troubleshooting
- Authentication errors: re-enter a valid API key in the sidebar.
- Empty `yfinance` data: try another ticker or retry later.
- Ensure your network allows outbound connections to OpenAI and Yahoo Finance endpoints.

### File Locations
- **App entry**: `deepagents/research_agent.py`
- **This guide**: `deepagents/research_agent_README.md`

### License
Use per your project's license. Replace this section as needed.
