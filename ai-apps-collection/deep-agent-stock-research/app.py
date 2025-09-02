from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI
import yfinance as yf
import logging
import streamlit as st
from langchain_core.tools import tool
from typing import Dict
import json
import os

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s"
)



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


@tool
def get_stock_price(symbol: str) -> str:
    """Get current stock price and basic information."""
    logging.info(f"[TOOL] Fetching stock price for: {symbol}")
    try:
        stock = yf.Ticker(symbol)
        info = stock.info
        hist = stock.history(period="1d")
        if hist.empty:
            logging.error("No historical data found")
            return json.dumps({"error": f"Could not retrieve data for {symbol}"})
            
        current_price = hist['Close'].iloc[-1]
        result = {
            "symbol": symbol,
            "current_price": round(current_price, 2),
            "company_name": info.get('longName', symbol),
            "market_cap": info.get('marketCap', 0),
            "pe_ratio": info.get('trailingPE', 'N/A'),
            "52_week_high": info.get('fiftyTwoWeekHigh', 0),
            "52_week_low": info.get('fiftyTwoWeekLow', 0)
        }
        logging.info(f"[TOOL RESULT] {result}")
        return json.dumps(result, indent=2)

    except Exception as e:
        logging.exception("Exception in get_stock_price")
        return json.dumps({"error": str(e)})

@tool
def get_financial_statements(symbol: str) -> str:
    """Retrieve key financial statement data."""
    try:
        stock = yf.Ticker(symbol)
        financials = stock.financials
        balance_sheet = stock.balance_sheet
        
        latest_year = financials.columns[0]
        
        return json.dumps({
            "symbol": symbol,
            "period": str(latest_year.year),
            "revenue": float(financials.loc['Total Revenue', latest_year]) if 'Total Revenue' in financials.index else 'N/A',
            "net_income": float(financials.loc['Net Income', latest_year]) if 'Net Income' in financials.index else 'N/A',
            "total_assets": float(balance_sheet.loc['Total Assets', latest_year]) if 'Total Assets' in balance_sheet.index else 'N/A',
            "total_debt": float(balance_sheet.loc['Total Debt', latest_year]) if 'Total Debt' in balance_sheet.index else 'N/A'
        }, indent=2)
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def get_technical_indicators(symbol: str, period: str = "3mo") -> str:
    """Calculate key technical indicators."""
    try:
        stock = yf.Ticker(symbol)
        hist = stock.history(period=period)
        
        if hist.empty:
            return f"Error: No historical data for {symbol}"
        
        hist['SMA_20'] = hist['Close'].rolling(window=20).mean()
        hist['SMA_50'] = hist['Close'].rolling(window=50).mean()
        
        delta = hist['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        latest = hist.iloc[-1]
        latest_rsi = rsi.iloc[-1]
        
        return json.dumps({
            "symbol": symbol,
            "current_price": round(latest['Close'], 2),
            "sma_20": round(latest['SMA_20'], 2),
            "sma_50": round(latest['SMA_50'], 2),
            "rsi": round(latest_rsi, 2),
            "volume": int(latest['Volume']),
            "trend_signal": "bullish" if latest['Close'] > latest['SMA_20'] > latest['SMA_50'] else "bearish"
        }, indent=2)
    except Exception as e:
        return f"Error: {str(e)}"


# Sub-agent configurations
fundamental_analyst = {
    "name": "fundamental-analyst",
    "description": "Performs deep fundamental analysis of companies including financial ratios, growth metrics, and valuation",
    "prompt": """You are an expert fundamental analyst with 15+ years of experience. 
    Focus on:
    - Financial statement analysis
    - Ratio analysis (P/E, P/B, ROE, ROA, Debt-to-Equity)
    - Growth metrics and trends
    - Industry comparisons
    - Intrinsic value calculations
    Always provide specific numbers and cite your sources."""
}

technical_analyst = {
    "name": "technical-analyst", 
    "description": "Analyzes price patterns, technical indicators, and trading signals",
    "prompt": """You are a professional technical analyst specializing in chart analysis and trading signals.
    Focus on:
    - Price action and trend analysis
    - Technical indicators (RSI, MACD, Moving Averages)
    - Support and resistance levels
    - Volume analysis
    - Entry/exit recommendations
    Provide specific price levels and timeframes for your recommendations."""
}

risk_analyst = {
    "name": "risk-analyst",
    "description": "Evaluates investment risks and provides risk assessment",
    "prompt": """You are a risk management specialist focused on identifying and quantifying investment risks.
    Focus on:
    - Market risk analysis
    - Company-specific risks
    - Sector and industry risks
    - Liquidity and credit risks
    - Regulatory and compliance risks
    Always quantify risks where possible and suggest mitigation strategies."""
}

subagents = [fundamental_analyst, technical_analyst, risk_analyst]


# Main research instructions
research_instructions = """You are an elite stock research analyst with access to multiple specialized tools and sub-agents. 

Your research process should be systematic and comprehensive:

1. **Initial Data Gathering**: Start by collecting basic stock information, price data, and recent news
2. **Fundamental Analysis**: Deep dive into financial statements, ratios, and company fundamentals
3. **Technical Analysis**: Analyze price patterns, trends, and technical indicators
4. **Risk Assessment**: Identify and evaluate potential risks
5. **Competitive Analysis**: Compare with industry peers when relevant
6. **Synthesis**: Combine all findings into a coherent investment thesis
7. **Recommendation**: Provide clear buy/sell/hold recommendation with price targets

Always:
- Use specific data and numbers to support your analysis
- Cite your sources and methodology
- Consider multiple perspectives and potential scenarios
- Provide actionable insights and concrete recommendations
- Structure your final report professionally

When using sub-agents, provide them with specific, focused tasks and incorporate their specialized insights into your overall analysis."""

# Define all tools
tools = [
    get_stock_price,
    get_financial_statements, 
    get_technical_indicators
]

def create_stock_research_agent(api_key: str):
    if not api_key:
        raise ValueError("OpenAI API key is required.")
    os.environ["OPENAI_API_KEY"] = api_key
    openai_model = ChatOpenAI(
        model="gpt-4o",
        temperature=0,
    )
    return create_deep_agent(
        tools=tools,
        instructions=research_instructions,
        subagents=subagents,
        model=openai_model
    )





def run_stock_research(messages: list, agent):
    """Run the stock research agent with chat history and return the final message content."""
    try:
        logging.info(f"[run_stock_research] Messages received: {len(messages)}")
        
        result = agent.invoke({
            "messages": messages
        })

        logging.debug(f"[run_stock_research] Full result: {result}")
        
        messages = result.get("messages", [])
        output_text = ""
        
        if not messages:
            logging.warning("[run_stock_research] No messages returned in result.")
            output_text = "Error: No response messages received."
        elif isinstance(messages[-1], dict):
            output_text = messages[-1].get("content", "")
            logging.debug(f"[run_stock_research] Output content from dict: {output_text}")
        elif hasattr(messages[-1], "content"):
            output_text = messages[-1].content
            logging.debug(f"[run_stock_research] Output content from object: {output_text}")
        else:
            logging.error("[run_stock_research] Unrecognized message format.")
            output_text = "Error: Invalid response message format."

        file_output = ""
        if "files" in result:
            file_output += "\n\n=== Generated Research Files ===\n"
            for filename, content in result["files"].items():
                preview = content[:500] + "..." if len(content) > 500 else content
                file_output += f"\n**{filename}**\n{preview}\n"
                logging.debug(f"[run_stock_research] File: {filename}, Preview: {preview[:100]}")

        return output_text + file_output

    except Exception as e:
        logging.exception("[run_stock_research] Exception during invocation:")
        return f"Error: {str(e)}"

# Streamlit Chat App
st.set_page_config(page_title="Deepagent Stock Research Agent", page_icon="📊", layout="wide")

st.title("📊 Deepagent Stock Research Agent")
st.caption("Chat with a multi-agent stock researcher. Made from deepagents library.")

with st.sidebar:
    st.header("Settings")
    api_key = st.text_input("OpenAI API Key", type="password")
    if api_key:
        os.environ["OPENAI_API_KEY"] = api_key
        st.sidebar.success("API key set successfully!")

if "agent" not in st.session_state:
    st.session_state.agent = None
if "messages" not in st.session_state:
    st.session_state.messages = []

if api_key:
    try:
        st.session_state.agent = create_stock_research_agent(api_key)
        st.sidebar.success("API key applied. Agent initialized.")
    except Exception as e:
        st.session_state.agent = None
        st.sidebar.error(f"Failed to initialize agent: {e}")

    # Display chat history
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # Chat input
    user_input = st.chat_input("Ask about a stock, e.g., 'Analyze AAPL fundamentals and risks'.")
    if user_input:
        st.session_state.messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        if not st.session_state.agent:
            with st.chat_message("assistant"):
                st.warning("Please set your OpenAI API key in the sidebar and click 'Apply API Key'.")
        else:
            with st.chat_message("assistant"):
                with st.spinner("Analyzing..."):
                    output = run_stock_research(st.session_state.messages, st.session_state.agent)
                st.markdown(output)
                st.session_state.messages.append({"role": "assistant", "content": output})
else:
    st.warning("Please enter your OpenAI API key to continue.")
