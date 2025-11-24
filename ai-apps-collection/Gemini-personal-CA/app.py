import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import os
from datetime import datetime
from agno.agent import Agent
from agno.models.google.gemini import Gemini
from agno.team.team import Team
from agno.tools.reasoning import ReasoningTools
from typing import Optional

# Page configuration
st.set_page_config(
    page_title="Personal Financial Planner",
    page_icon="💰",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if "api_key" not in st.session_state:
    st.session_state.api_key = None
if "plans_generated" not in st.session_state:
    st.session_state.plans_generated = False

# Sidebar
with st.sidebar:
    st.title("💰 Financial Planner")
    st.markdown("---")
    
    # API Key Input
    st.subheader("Configuration")
    api_key = st.text_input(
        "Gemini API Key",
        type="password",
        help="Enter your Google Gemini API key",
        value=st.session_state.api_key if st.session_state.api_key else ""
    )
    
    if api_key:
        # Strip leading/trailing whitespace (including tabs, newlines, etc.) to avoid URL encoding issues
        cleaned_key = api_key.strip()
        # Remove any non-printable ASCII characters (tabs, etc. that might have been pasted)
        cleaned_key = ''.join(char for char in cleaned_key if char.isprintable() and ord(char) < 128)
        # Remove any remaining whitespace characters (spaces, tabs) that might be in the middle
        cleaned_key = cleaned_key.replace('\t', '').replace('\n', '').replace('\r', '').replace(' ', '')
        st.session_state.api_key = cleaned_key
        if cleaned_key:
            st.success("✅ API Key configured")
        else:
            st.warning("⚠️ Please enter a valid Gemini API key")
    else:
        st.warning("⚠️ Please enter your Gemini API key")
    
    st.markdown("---")
    
    # Instructions
    st.subheader("📖 How to Use")
    st.markdown("""
    1. **Enter API Key**: Add your Gemini API key above
    2. **Fill Details**: Complete the form on the main page
    3. **Generate Plan**: Click the button to create your financial plan
    4. **Review Results**: Explore your personalized recommendations
    
    The app uses AGNO agents with Gemini LLM to create:
    - Tax-saving strategies
    - Retirement planning
    - Children's education costs
    - Additional goal planning
    """)
    
    st.markdown("---")
    st.markdown("**Built with AGNO & Gemini**")

# Main Content
st.title("🎯 Personalized Financial Planning")
st.markdown("Get a comprehensive financial roadmap powered by AI agents")

# Check if API key is set
if not st.session_state.api_key:
    st.info("👈 Please enter your Gemini API key in the sidebar to continue")
    st.stop()

# User Input Form
with st.form("financial_info_form"):
    st.header("📋 Your Financial Information")
    
    col1, col2 = st.columns(2)
    
    with col1:
        age = st.number_input("Age", min_value=18, max_value=100, value=30)
        annual_income = st.number_input("Annual Income (₹)", min_value=0, value=1000000, step=50000)
        monthly_expenses = st.number_input("Monthly Expenses (₹)", min_value=0, value=50000, step=5000)
    
    with col2:
        designation = st.text_input("Designation/Job Title", value="Software Engineer")
        num_kids = st.number_input("Number of Kids (Optional)", min_value=0, max_value=5, value=0)
    
    # Kids ages
    kids_ages = []
    if num_kids > 0:
        st.subheader("👶 Children's Information")
        kid_cols = st.columns(min(num_kids, 3))
        for i in range(num_kids):
            with kid_cols[i % 3]:
                age_input = st.number_input(
                    f"Kid {i+1} Age",
                    min_value=0,
                    max_value=25,
                    value=5,
                    key=f"kid_{i}"
                )
                kids_ages.append(age_input)
    
    # Optional goals
    st.subheader("🎯 Additional Goals (Optional)")
    gym_expense = st.number_input("Monthly Gym/Health Expenses (₹)", min_value=0, value=0, step=1000)
    lifestyle_goals = st.text_area("Other Lifestyle Goals", placeholder="e.g., Buy a house in 5 years, Travel to Europe next year")
    
    submit_button = st.form_submit_button("🚀 Generate Financial Plan", use_container_width=True)

# Generate Financial Plan
if submit_button:
    with st.spinner("🤖 AI agents are analyzing your financial situation and creating your personalized plan..."):
        try:
            # Clean API key: strip whitespace and remove any non-printable characters
            if not st.session_state.api_key:
                st.error("❌ API key is required. Please enter your Gemini API key in the sidebar.")
                st.stop()
            
            # The key should already be cleaned from sidebar, but clean again to be safe
            api_key_clean = st.session_state.api_key.strip()
            # Remove any non-printable ASCII characters (tabs, etc.)
            api_key_clean = ''.join(char for char in api_key_clean if char.isprintable() and ord(char) < 128)
            # Remove any remaining whitespace characters
            api_key_clean = api_key_clean.replace('\t', '').replace('\n', '').replace('\r', '').replace(' ', '')
            
            if not api_key_clean:
                st.error("❌ Invalid API key. Please check your Gemini API key.")
                st.stop()
            
            # Set API key as environment variable (AGNO expects this)
            os.environ["GOOGLE_API_KEY"] = api_key_clean
            
            # Initialize Gemini model
            model = Gemini(id="gemini-2.5-flash")
            
            # Create specialized agents
            tax_agent = Agent(
                name="Tax Planning Agent",
                role="Analyze tax-saving opportunities and create tax optimization strategies",
                model=model,
                tools=[ReasoningTools(add_instructions=True)],
                instructions=[
                    "Focus on Indian tax-saving instruments (Section 80C, 80D, HRA, etc.)",
                    "Provide specific recommendations with calculations",
                    "Consider the user's income bracket and designation",
                    "Use tables to present tax-saving options clearly",
                ],
                markdown=True,
            )
            
            retirement_agent = Agent(
                name="Retirement Planning Agent",
                role="Calculate retirement corpus needs and create savings plan",
                model=model,
                tools=[ReasoningTools(add_instructions=True)],
                instructions=[
                    "Assume retirement age of 60 years",
                    "Calculate future expenses with inflation (7-8% annually)",
                    "Consider different investment vehicles (EPF, PPF, Mutual Funds, etc.)",
                    "Provide year-by-year projections",
                    "Calculate required monthly SIP for retirement goals",
                ],
                markdown=True,
            )
            
            kids_expense_agent = Agent(
                name="Children's Education Agent",
                role="Calculate future education costs for children",
                model=model,
                tools=[ReasoningTools(add_instructions=True)],
                instructions=[
                    "Assume 10-12% annual inflation for education costs",
                    "Consider undergraduate and graduate education costs",
                    "Calculate required monthly savings (SIP) for each child",
                    "Include both domestic and international education scenarios",
                    "Provide year-by-year projections until each child turns 22",
                ],
                markdown=True,
            )
            
            goals_agent = Agent(
                name="Goals Planning Agent",
                role="Plan for additional lifestyle and financial goals",
                model=model,
                tools=[ReasoningTools(add_instructions=True)],
                instructions=[
                    "Analyze gym expenses and suggest optimization",
                    "Create plans for lifestyle goals mentioned by user",
                    "Provide actionable recommendations",
                ],
                markdown=True,
            )
            
            # Create team
            financial_team = Team(
                name="Financial Planning Team",
                model=model,
                members=[tax_agent, retirement_agent, kids_expense_agent, goals_agent],
                tools=[ReasoningTools(add_instructions=True)],
                instructions=[
                    "Work together to create a comprehensive financial plan",
                    "Ensure all recommendations are consistent and feasible",
                    "Present findings in a structured, easy-to-follow format",
                    "Use tables, bullet points, and clear sections",
                    "Provide actionable next steps",
                ],
                markdown=True,
                show_members_responses=False,
            )
            
            # Prepare user data
            user_context = f"""
            User Profile:
            - Age: {age} years
            - Annual Income: ₹{annual_income:,}
            - Monthly Expenses: ₹{monthly_expenses:,}
            - Designation: {designation}
            - Number of Kids: {num_kids}
            """
            
            if kids_ages:
                user_context += "\n- Kids Ages: " + ", ".join([f"Kid {i+1}: {age} years" for i, age in enumerate(kids_ages)])
            
            if gym_expense > 0:
                user_context += f"\n- Monthly Gym/Health Expenses: ₹{gym_expense:,}"
            
            if lifestyle_goals:
                user_context += f"\n- Additional Goals: {lifestyle_goals}"
            
            # Create comprehensive prompt
            prompt = f"""
            Create a comprehensive, personalized financial plan for this user:
            
            {user_context}
            
            Please provide:
            
            1. **Tax-Saving Plan**: 
               - Analyze current tax liability
               - Recommend tax-saving investments (Section 80C, 80D, HRA, etc.)
               - Calculate potential tax savings
               - Provide specific investment amounts and instruments
            
            2. **Retirement Planning**:
               - Calculate required retirement corpus (considering 60 years retirement age)
               - Assume monthly expenses of ₹{monthly_expenses:,} adjusted for inflation (7-8% annually)
               - Calculate required monthly SIP/investment amount
               - Show year-by-year projections until retirement
               - Recommend investment mix (Equity, Debt, EPF, PPF, etc.)
            
            3. **Children's Education Planning** (if applicable):
               - Calculate future education costs for each child with 10-12% inflation
               - Show year-by-year projections
               - Calculate required monthly SIP for each child's education fund
               - Consider both domestic (₹20-40 lakhs) and international (₹50-100 lakhs) education costs
            
            4. **Additional Goals Planning**:
               - Analyze gym/health expenses and provide optimization suggestions
               - Create actionable plans for lifestyle goals mentioned
            
            5. **Summary & Recommendations**:
               - Overall financial health assessment
               - Priority actions
               - Emergency fund recommendations
               - Investment strategy summary
            
            Format the response with:
            - Clear sections and headers
            - Tables for calculations and projections
            - Specific numbers and percentages
            - Actionable recommendations
            - Beautiful, readable explanations
            """
            
            # Run the team
            response = financial_team.run(prompt, stream=False)
            
            # Display the response
            st.session_state.plans_generated = True
            st.session_state.plan_response = response.content
            
            st.success("✅ Financial plan generated successfully!")
            
        except Exception as e:
            st.error(f"❌ Error generating plan: {str(e)}")
            st.info("Please check your API key and try again.")

# Display the generated plan
if st.session_state.get("plans_generated", False):
    st.markdown("---")
    st.header("📊 Your Personalized Financial Plan")
    
    # Display the full response
    st.markdown(st.session_state.plan_response)
    
    # Generate visualizations from the response
    st.markdown("---")
    st.header("📈 Visual Breakdown")
    
    # Create sample charts (you can enhance this by parsing the response for actual numbers)
    col1, col2 = st.columns(2)
    
    with col1:
        # Expense breakdown
        st.subheader("💸 Expense Distribution")
        expense_data = {
            "Category": ["Monthly Expenses", "Gym/Health", "Tax Savings", "Investments"],
            "Amount (₹)": [monthly_expenses, gym_expense, annual_income * 0.1, annual_income * 0.2]
        }
        df_expenses = pd.DataFrame(expense_data)
        fig_pie = px.pie(
            df_expenses,
            values="Amount (₹)",
            names="Category",
            title="Monthly Financial Distribution",
            color_discrete_sequence=px.colors.qualitative.Set3
        )
        st.plotly_chart(fig_pie, use_container_width=True)
    
    with col2:
        # Retirement projection
        st.subheader("🏖️ Retirement Savings Projection")
        years_to_retirement = 60 - age
        years = list(range(0, years_to_retirement + 1, 5))
        corpus_values = []
        current_value = 0
        monthly_sip = (annual_income * 0.2) / 12
        
        for year in years:
            if year > 0:
                # Simple projection: FV = PV * (1+r)^n + PMT * (((1+r)^n - 1) / r)
                current_value = current_value * (1.12) ** min(5, year) + (monthly_sip * 12 * 5) * ((1.12) ** 5 - 1) / 0.12
            corpus_values.append(current_value)
        
        df_retirement = pd.DataFrame({
            "Year": years,
            "Projected Corpus (₹ Lakhs)": [v / 100000 for v in corpus_values]
        })
        fig_retirement = px.line(
            df_retirement,
            x="Year",
            y="Projected Corpus (₹ Lakhs)",
            title="Retirement Corpus Growth",
            markers=True
        )
        fig_retirement.update_traces(line_color="#1f77b4", line_width=3)
        st.plotly_chart(fig_retirement, use_container_width=True)
    
    # Kids education projection
    if num_kids > 0 and kids_ages:
        st.subheader("🎓 Children's Education Cost Projection")
        fig_kids = go.Figure()
        
        for i, kid_age in enumerate(kids_ages):
            years_to_college = 18 - kid_age
            years = list(range(0, years_to_college + 1))
            costs = []
            current_cost_domestic = 3000000  # 30 lakhs
            current_cost_international = 8000000  # 80 lakhs
            
            for year in years:
                if year > 0:
                    current_cost_domestic *= 1.11
                    current_cost_international *= 1.11
                costs.append((current_cost_domestic, current_cost_international))
            
            df_kid = pd.DataFrame({
                "Year": years,
                "Domestic (₹ Lakhs)": [c[0] / 100000 for c in costs],
                "International (₹ Lakhs)": [c[1] / 100000 for c in costs]
            })
            
            fig_kids.add_trace(go.Scatter(
                x=df_kid["Year"],
                y=df_kid["Domestic (₹ Lakhs)"],
                mode="lines+markers",
                name=f"Kid {i+1} - Domestic",
                line=dict(width=2)
            ))
            fig_kids.add_trace(go.Scatter(
                x=df_kid["Year"],
                y=df_kid["International (₹ Lakhs)"],
                mode="lines+markers",
                name=f"Kid {i+1} - International",
                line=dict(width=2, dash="dash")
            ))
        
        fig_kids.update_layout(
            title="Education Cost Projection (with 11% inflation)",
            xaxis_title="Years from Now",
            yaxis_title="Cost (₹ Lakhs)",
            hovermode="x unified"
        )
        st.plotly_chart(fig_kids, use_container_width=True)
    
    # Summary cards
    st.markdown("---")
    st.header("📋 Quick Summary")
    
    summary_cols = st.columns(4)
    
    with summary_cols[0]:
        st.metric("Annual Income", f"₹{annual_income/100000:.1f}L")
    
    with summary_cols[1]:
        monthly_investment = (annual_income * 0.2) / 12
        st.metric("Recommended Monthly Investment", f"₹{monthly_investment/1000:.1f}K")
    
    with summary_cols[2]:
        years_to_retire = 60 - age
        st.metric("Years to Retirement", f"{years_to_retire}")
    
    with summary_cols[3]:
        savings_rate = ((annual_income - (monthly_expenses * 12)) / annual_income) * 100
        st.metric("Current Savings Rate", f"{savings_rate:.1f}%")

# Footer
st.markdown("---")
st.markdown(
    "<div style='text-align: center; color: gray;'>Built with ❤️ using AGNO Agents & Gemini LLM</div>",
    unsafe_allow_html=True
)

