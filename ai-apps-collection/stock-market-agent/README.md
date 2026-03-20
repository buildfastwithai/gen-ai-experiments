# Stock Market Analysis Agents 🤖📈

[![Python 3.13+](https://img.shields.io/badge/python-v3.13+-blue.svg)](https://www.python.org/downloads/)
[![Streamlit](https://img.shields.io/badge/Streamlit-1.48+-FF4B4B.svg)](https://streamlit.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Dependencies](https://img.shields.io/badge/dependencies-up%20to%20date-brightgreen.svg)](requirements.txt)
[![Made with Gemini](https://img.shields.io/badge/Made%20with-Gemini-orange.svg)](https://gemini.google.com)

> AI-powered stock market analysis and investment recommendations using Google's Gemini 2.5 Flash model.

### Smarter investing starts here :👉 https://stock-market-insights---ai-agent.streamlit.app/

## 🚀 Features

- **Multi-Agent Architecture**: Specialized AI agents for market analysis, company research, and investment strategy
- **Real-time Data**: Live stock data from Yahoo Finance covering 6-month performance trends
- **Interactive Visualization**: Beautiful plots and charts via Plotly and Streamlit
- **Company Analysis**: Deep-dive profiles with sector, market cap, and business summaries
- **Investment Recommendations**: AI-powered stock picks based on fundamentals and news sentiment
- **News Integration**: Latest company news and market developments affecting investment decisions

## 🔧 Technology Stack

| Category | Technology |
|----------|------------|
| **Framework** | Streamlit (1.48+) |
| **LLM** | Google Gemini 2.5 Flash |
| **Data** | Yahoo Finance (yfinance) |
| **Visualization** | Plotly |
| **Agent Framework** | Agno |
| **Language** | Python 3.13+ |

## 📦 Installation

### Prerequisites
- Python 3.13 or higher
- Google Gemini API key

### Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/username/stock-market-agent.git
   cd stock-market-agent
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```
   
4. **Launch the application**
   ```bash
   streamlit run app.py
   ```

### Alternative Installation via pyproject.toml

```bash
pip install -e .
```

## 🎯 Usage

### Web Interface (Recommended)

Navigate to `http://localhost:8501` after launching with Streamlit.

1. **Stock Comparison**: Enter multiple ticker symbols (e.g., `AAPL, MSFT, GOOGL`)
2. **Company Research**: Get detailed analysis for individual stocks
3. **Investment Recommendations**: Receive AI-curated stock picks

### API Usage (Python Scripts)

```python
from app import get_market_analysis, get_company_analysis, get_stock_recommendations

# Compare stock performance
symbols = ["TSLA", "NVDA", "AMD"]
analysis = get_market_analysis(symbols)
print(analysis)

# Analyze a specific company
company_analysis = get_company_analysis("AAPL")
print(company_analysis)

# Get investment recommendations
recommendations = get_stock_recommendations(["META", "AMZN", "NFLX"])
print(recommendations)
```

## 📊 Supported Stock Symbols

For best results, use common ticker symbols:
- **Technology**: `AAPL`, `MSFT`, `GOOGL`, `META`, `NVDA`
- **Finance**: `JPM`, `BAC`, `V`, `MA`
- **Healthcare**: `JNJ`, `PFE`, `UNH`, `ABBV`
- **Consumer**: `COST`, `WMT`, `HD`, `AMZN`
- **S&P 500**: `SPY`
- **Enternational**: International symbols are supported (e.g., `TCEHY`, `ASML`)

## 🏗️ Architecture

```
Stock Market Agent System
├── Market Analyst Agent
│   ├── Fetches price data (6 months)
│   ├── Calculates percentage changes
│   └── Ranks performance
├── Company Researcher Agent
│   ├── Retrieves company profiles
│   ├── Fetches latest news
│   └── Provides business summaries
├── Stock Strategist Agent
│   ├── Combines analysis
│   ├── Evaluates fundamentals
│   └── Recommends investments
└── Team Lead Agent [WIP]
    └── Coordinates all agents
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/stock-market-agent.git
   cd stock-market-agent
   ```

2. **Install dev dependencies**
   ```bash
   pip install -r requirements.txt -e .
   ```




### Adding New Agents

To create a new specialized agent:

```python
from agno.agent import Agent
from agno.models.google import Gemini

custom_agent = Agent(
    model=Gemini(id="gemini-2.5-flash"),
    description="Your agent description here",
    instructions=[
        "Add task-specific instructions",
        "Include data sources",
        "Define output format"
    ]
)
```

### Pull Request Process

1. Create feature branch: `git checkout -b feature/new-analysis-tool`
2. Make changes and test locally
3. Add/update tests for new functionality
4. Update documentation
5. Submit PR with clear description


## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **"No valid stock data"** | Check ticker symbol validity and network connectivity |
| **API timeout errors** | Verify GOOGLE_API_KEY is set correctly |
| **Streamlit crashes** | Ensure all dependencies are installed via `requirements.txt` |
| **Permission errors** | Run `pip install --user -r requirements.txt` on restricted systems |



## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.


<div align="center">
  <sub>Built with ❤️ by the AI & Finance team</sub>
  <br>
  <img src="https://img.shields.io/github/stars/username/stock-market-agent?style=for-the-badge&color=yellow" />
</div>