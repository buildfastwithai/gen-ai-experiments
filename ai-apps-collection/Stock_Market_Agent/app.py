import os
import streamlit as st
from agno.agent import Agent
import plotly.graph_objects as go
import yfinance as yf
from agno.models.google import Gemini

def compare_stocks(symbols):
    data = {}
    for symbol in symbols:
        try:
            # Fetch stock data
            stock = yf.Ticker(symbol) # Initialize the Ticker object
            hist = stock.history(period="6mo")  # Fetch last 6 months' data

            if hist.empty:
                print(f"No data found for {symbol}, skipping it.")
                continue  # Skip this ticker if no data found

            # Calculate overall % change
            data[symbol] = hist['Close'].pct_change().sum() # Calculate total percentage change over the period

        except Exception as e:
            print(f"Could not retrieve data for {symbol}. Reason: {str(e)}")
            continue  # Skip this ticker if an error occurs

    return data

# Define the Market Analyst Agent
market_analyst = Agent(
    model=Gemini(id="gemini-2.5-flash"),
    description="Analyzes and compares stock performance over time.",
    instructions=[
        "Retrieve and compare stock performance from Yahoo Finance.",
        "Calculate percentage change over a 6-month period.",
        "Rank stocks based on their relative performance."
    ],
    show_tool_calls=True,
    markdown=True
)

# Function to get market analysis
def get_market_analysis(symbols):
    performance_data = compare_stocks(symbols) # get stock performance data from the compare_stocks function

    if not performance_data:
        return "No valid stock data found for the given symbols."

    analysis = market_analyst.run(f"Compare these stock performances: {performance_data}")  # Run the market analyst agent with the performance data
    return analysis.content


def get_company_info(symbol):
    stock = yf.Ticker(symbol)
    return {
        "name": stock.info.get("longName", "N/A"),
        "sector": stock.info.get("sector", "N/A"),
        "market_cap": stock.info.get("marketCap", "N/A"),
        "summary": stock.info.get("longBusinessSummary", "N/A"),
    }

# Function to get company news
def get_company_news(symbol):
    stock = yf.Ticker(symbol)
    news = stock.news[:5]  # Get latest 5 news articles
    return news

company_researcher = Agent(
    model=Gemini(id="gemini-2.5-flash"),
    description="Fetches company profiles, financials, and latest news.",
    instructions=[
        "Retrieve company information from Yahoo Finance.",
        "Summarize latest company news relevant to investors.",
        "Provide sector, market cap, and business overview."
    ],
    markdown=True
)

def get_company_analysis(symbol):
    info = get_company_info(symbol)
    news = get_company_news(symbol)
    response = company_researcher.run(    # company_researcher agent uses  get_company_info(symbol) , get_company_news(symbol) to do analysis
        f"Provide an analysis for {info['name']} in the {info['sector']} sector.\n"
        f"Market Cap: {info['market_cap']}\n"
        f"Summary: {info['summary']}\n"
        f"Latest News: {news}"
    )
    return response.content

# Stock strategist agent
stock_strategist = Agent(
    model=Gemini(id="gemini-2.5-flash"),
    description="Provides investment insights and recommends top stocks.",
    instructions=[
        "Analyze stock performance trends and company fundamentals.",
        "Evaluate risk-reward potential and industry trends.",
        "Provide top stock recommendations for investors."
    ],
    markdown=True
)

def get_stock_recommendations(symbols):
    market_analysis = get_market_analysis(symbols)
    data = {}
    for symbol in symbols:
        data[symbol] = get_company_analysis(symbol)
    recommendations = stock_strategist.run(
        f"Based on the market analysis: {market_analysis}, and company news {data}"
        f"which stocks would you recommend for investment?"
    )
    return recommendations.content

# Team Lead agent
team_lead = Agent(
    model=Gemini(id="gemini-2.5-flash"),
    description="Aggregates stock analysis, company research, and investment strategy.",
    instructions=[
        "Compile stock performance, company analysis, and recommendations.",
        "Ensure all insights are structured in an investor-friendly report.",
        "Rank the top stocks based on combined analysis."
    ],
    markdown=True
)

def get_final_investment_report(symbols):
    market_analysis = get_market_analysis(symbols)
    company_analyses = [get_company_analysis(symbol) for symbol in symbols]
    stock_recommendations = get_stock_recommendations(symbols)

    final_report = team_lead.run(
        f"Market Analysis:\n{market_analysis}\n\n"
        f"Company Analyses:\n{company_analyses}\n\n"
        f"Stock Recommendations:\n{stock_recommendations}\n\n"
        f"Provide the full analysis of each stock with Fundamentals and market news."
        f"Generate a final ranked list in ascending order on which should I buy."
    )
    return final_report.content

# Streamlit page configuration
st.set_page_config(page_title="Stock Market Insights Engine", page_icon="📈", layout="wide")

with st.sidebar:
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
        "</div></a></div>", unsafe_allow_html=True
    )
    st.header("Configuration")
    openai_api_key = st.text_input("Enter your Gemini API key", type="password")
    st.divider()
    st.markdown(" Model: `gemini-2.5-flash` ")
    st.markdown("---")
    st.markdown("""<div class="sidebar-footer">
                    <p>❤️ Built by <a href="https://buildfastwithai.com" target="_blank">Build Fast with AI</a></p>
                </div> """, unsafe_allow_html=True)

# Set environment variable for OpenAI API
os.environ["GOOGLE_API_KEY"]= openai_api_key

# Title and header
st.markdown("""
    <h1 style="text-align: center; color: #8cbed6;">🤖 AI-Powered Stock Market Insights Engine 📈 </h1>
    <h3 style="text-align: center; color: #6c757d;">Unlocking Market Trends with Advanced AI Analytics</h3>
    <h6 style="text-align: center; color: #6c757d; font-style: italic;">This tool is designed to help you make informed investment decisions by combining the power of AI with the latest market data.</h6>
""", unsafe_allow_html=True)


# Check if the API key is entered
if not openai_api_key:
    st.info("Please enter your Gemini API key in the sidebar to proceed.")
    st.stop()

# Stock symbols input
input_symbols = st.text_input("Enter Stock Symbols (separated by commas)", "AAPL, TSLA, GOOG")

# Parse the stock symbols input
stocks_symbols = [symbol.strip() for symbol in input_symbols.split(",")]

if st.button("Generate Investment Report"):
    if not stocks_symbols:
        st.warning("Please enter at least one stock symbol.")
    else:
        with st.spinner("⏳ Generating investment report..."):
            # Temporarily show "Generating..." text
            st.markdown(
                "<style>.stButton button {pointer-events: none;}</style>",
                unsafe_allow_html=True
            )

            # Generate the final report
            report = get_final_investment_report(stocks_symbols)

        # Display the report
        st.subheader("Investment Report")
        st.markdown(report)

        st.info(
            "This report provides detailed insights, including market performance, company analysis, and investment recommendations."
        )

        # Interactive Stock Performance Chart
        st.markdown("### 📊 Stock Performance Report (6-Months)")
        stock_data = yf.download(stocks_symbols, period="6mo", auto_adjust=False)["Close"]

        fig = go.Figure()
        for symbol in stocks_symbols:
            fig.add_trace(go.Scatter(x=stock_data.index, y=stock_data[symbol], mode="lines", name=symbol))

        fig.update_layout(
            title="Stock Performance Over the Last 6 Months",
            xaxis_title="Date",
            yaxis_title="Price (in USD)",
            template="plotly_dark",
        )
        st.plotly_chart(fig)