import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import os
from datetime import datetime
from agno.agent import Agent
from agno.models.google.gemini import Gemini

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
        cleaned_key = api_key.strip()
        cleaned_key = ''.join(char for char in cleaned_key if char.isprintable() and ord(char) < 128)
        cleaned_key = cleaned_key.replace('\t', '').replace('\n', '').replace('\r', '').replace(' ', '')
        st.session_state.api_key = cleaned_key
        if cleaned_key:
            st.success("✅ API Key configured")
        else:
            st.warning("⚠️ Please enter a valid Gemini API key")
    else:
        st.warning("⚠️ Please enter your Gemini API key")

    # Build Fast with AI Promotion
    st.markdown(
        """
        <div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    padding: 20px; 
                    border-radius: 10px; 
                    text-align: center;
                    margin: 10px 0;'>
            <h3 style='color: white; margin: 0 0 10px 0;'>🚀 Want to Build AI Apps?</h3>
            <p style='color: white; margin: 0 0 15px 0; font-size: 0.9em;'>
                Learn to build production-ready AI applications from scratch
            </p>
            <a href='https://www.buildfastwithai.com/genai-course' 
               target='_blank' 
               style='background-color: white; 
                      color: #764ba2; 
                      padding: 10px 20px; 
                      text-decoration: none; 
                      border-radius: 5px; 
                      font-weight: bold;
                      display: inline-block;'>
                Join Gen AI Crash Course →
            </a>
        </div>
        """,
        unsafe_allow_html=True
    )
    
    st.markdown(
        """
        <div style='text-align: center; padding: 10px;'>
            <p style='color: #666; font-size: 0.85em; margin: 5px 0;'>
                By <b>Build Fast with AI</b>
            </p>
            <p style='color: #888; font-size: 0.75em; margin: 0;'>
                Master GenAI • Build Real Projects • Launch Fast
            </p>
        </div>
        """,
        unsafe_allow_html=True
    )
    
    st.markdown("---")
    
    # Instructions
    st.subheader("📖 How to Use")
    st.markdown("""
    1. **Enter API Key**: Add your Gemini API key above
    2. **Fill Details**: Complete the form on the main page
    3. **Generate Plan**: Click the button to create your financial plan
    4. **Review Results**: Explore your personalized recommendations
    
    The app uses AGNO agents with Gemini Flash for fast, comprehensive planning:
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
    with st.spinner("🤖 AI agent is analyzing your financial situation..."):
        try:
            # Clean and validate API key
            if not st.session_state.api_key:
                st.error("❌ API key is required. Please enter your Gemini API key in the sidebar.")
                st.stop()
            
            api_key_clean = st.session_state.api_key.strip()
            api_key_clean = ''.join(char for char in api_key_clean if char.isprintable() and ord(char) < 128)
            api_key_clean = api_key_clean.replace('\t', '').replace('\n', '').replace('\r', '').replace(' ', '')
            
            if not api_key_clean:
                st.error("❌ Invalid API key. Please check your Gemini API key.")
                st.stop()
            
            # Set API key as environment variable
            os.environ["GOOGLE_API_KEY"] = api_key_clean
            
            # Initialize Gemini Flash model (much faster than Pro)
            model = Gemini(id="gemini-2.0-flash-exp")
            
            # Create single comprehensive agent (instead of team)
            financial_agent = Agent(
                name="Financial Planning Agent",
                role="Create comprehensive financial plans including tax optimization, retirement, education, and lifestyle goals",
                model=model,
                instructions=[
                    "Provide structured financial analysis with clear sections and headers",
                    "Focus on Indian tax-saving instruments (Section 80C, 80D, HRA, NPS, etc.)",
                    "Include specific numbers, calculations, and actionable recommendations",
                    "Use tables for key calculations and projections",
                    "Calculate retirement corpus with 12% assumed returns and 7% inflation",
                    "Calculate children's education costs with 11% annual inflation",
                    "Be concise but thorough - focus on actionable insights",
                ],
                markdown=True,
            )
            
            # Prepare user context
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
            
            # Streamlined prompt for faster processing
            prompt = f"""
Create a comprehensive yet concise financial plan for this user:

{user_context}

Please provide:

1. **Tax-Saving Strategy**:
   - Calculate current annual tax liability
   - Recommend specific tax-saving investments (80C, 80D, 80CCD(1B), HRA, etc.)
   - Show potential tax savings with a comparison table
   - Provide exact investment amounts for each instrument

2. **Retirement Planning**:
   - Target retirement age: 60 years
   - Calculate required retirement corpus (assume current monthly expenses adjusted for 7% inflation)
   - Calculate monthly SIP needed (assume 12% annual returns)
   - Show a 5-year milestone projection table
   - Recommend investment allocation (Equity/Debt/EPF/PPF)

3. **Children's Education Planning** (if applicable):
   - Calculate future education costs for each child (11% inflation)
   - Assume ₹30 lakhs for domestic UG/PG, ₹80 lakhs for international
   - Calculate required monthly SIP for each child
   - Show when funds will be needed and projected corpus

4. **Additional Goals & Optimization**:
   - Analyze gym/health expenses if provided
   - Create actionable plans for lifestyle goals
   - Suggest optimizations

5. **Priority Action Items**:
   - List top 5 immediate actions to take
   - Emergency fund recommendation (6 months expenses)
   - Overall financial health score

Format: Use clear headers, bullet points, and tables. Be specific with numbers and timelines.
"""
            
            # Generate plan with streaming for better UX
            response_content = ""
            response_placeholder = st.empty()
            
            # Stream the response
            response_stream = financial_agent.run(prompt, stream=True)
            
            for chunk in response_stream:
                if hasattr(chunk, 'content') and chunk.content:
                    response_content += chunk.content
                    # Update display in real-time
                    response_placeholder.markdown(response_content)
            
            # Store the complete response
            st.session_state.plans_generated = True
            st.session_state.plan_response = response_content
            
            # Store form data for visualizations
            st.session_state.form_data = {
                'age': age,
                'annual_income': annual_income,
                'monthly_expenses': monthly_expenses,
                'gym_expense': gym_expense,
                'num_kids': num_kids,
                'kids_ages': kids_ages
            }
            
            st.success("✅ Financial plan generated successfully!")
            
        except Exception as e:
            st.error(f"❌ Error generating plan: {str(e)}")
            st.info("Please check your API key and try again. If the error persists, try refreshing the page.")

# Display the generated plan
if st.session_state.get("plans_generated", False):
    st.markdown("---")
    st.header("📊 Your Personalized Financial Plan")
    
    # Display the full response
    st.markdown(st.session_state.plan_response)
    
    # Retrieve stored form data
    form_data = st.session_state.get('form_data', {})
    age = form_data.get('age', 30)
    annual_income = form_data.get('annual_income', 1000000)
    monthly_expenses = form_data.get('monthly_expenses', 50000)
    gym_expense = form_data.get('gym_expense', 0)
    num_kids = form_data.get('num_kids', 0)
    kids_ages = form_data.get('kids_ages', [])
    
    # Generate visualizations
    st.markdown("---")
    st.header("📈 Visual Breakdown")
    
    col1, col2 = st.columns(2)
    
    with col1:
        # Expense breakdown
        st.subheader("💸 Monthly Financial Distribution")
        monthly_investment = (annual_income * 0.2) / 12
        expense_data = {
            "Category": ["Living Expenses", "Investments", "Tax Savings", "Health/Gym"],
            "Amount (₹)": [
                monthly_expenses, 
                monthly_investment, 
                (annual_income * 0.1) / 12,
                gym_expense
            ]
        }
        df_expenses = pd.DataFrame(expense_data)
        df_expenses = df_expenses[df_expenses["Amount (₹)"] > 0]  # Remove zero values
        
        fig_pie = px.pie(
            df_expenses,
            values="Amount (₹)",
            names="Category",
            title="Monthly Financial Allocation",
            color_discrete_sequence=px.colors.qualitative.Set3,
            hole=0.3
        )
        fig_pie.update_traces(textposition='inside', textinfo='percent+label')
        st.plotly_chart(fig_pie, use_container_width=True)
    
    with col2:
        # Retirement projection
        st.subheader("🏖️ Retirement Corpus Growth")
        years_to_retirement = max(60 - age, 0)
        
        if years_to_retirement > 0:
            years = list(range(0, years_to_retirement + 1, 5))
            corpus_values = []
            monthly_sip = (annual_income * 0.2) / 12
            
            for year in years:
                if year == 0:
                    corpus_values.append(0)
                else:
                    # FV of SIP: PMT × [(1 + r)^n - 1] / r × (1 + r)
                    r_monthly = 0.12 / 12
                    n_months = year * 12
                    fv = monthly_sip * (((1 + r_monthly) ** n_months - 1) / r_monthly) * (1 + r_monthly)
                    corpus_values.append(fv)
            
            df_retirement = pd.DataFrame({
                "Years from Now": years,
                "Projected Corpus (₹ Lakhs)": [v / 100000 for v in corpus_values]
            })
            
            fig_retirement = px.line(
                df_retirement,
                x="Years from Now",
                y="Projected Corpus (₹ Lakhs)",
                title=f"Retirement Savings (₹{monthly_sip:,.0f}/month SIP @ 12% returns)",
                markers=True
            )
            fig_retirement.update_traces(line_color="#1f77b4", line_width=3, marker=dict(size=8))
            fig_retirement.update_layout(
                hovermode="x unified",
                yaxis_title="Corpus (₹ Lakhs)"
            )
            st.plotly_chart(fig_retirement, use_container_width=True)
        else:
            st.info("You've reached retirement age!")
    
    # Kids education projection
    if num_kids > 0 and kids_ages:
        st.subheader("🎓 Children's Education Cost Projection")
        
        fig_kids = go.Figure()
        
        for i, kid_age in enumerate(kids_ages):
            years_to_college = max(18 - kid_age, 0)
            
            if years_to_college > 0:
                years = list(range(0, years_to_college + 1))
                domestic_costs = []
                international_costs = []
                
                current_cost_domestic = 3000000  # 30 lakhs
                current_cost_international = 8000000  # 80 lakhs
                
                for year in years:
                    domestic_costs.append(current_cost_domestic * (1.11 ** year))
                    international_costs.append(current_cost_international * (1.11 ** year))
                
                # Domestic education line
                fig_kids.add_trace(go.Scatter(
                    x=years,
                    y=[c / 100000 for c in domestic_costs],
                    mode="lines+markers",
                    name=f"Kid {i+1} - Domestic (₹30L base)",
                    line=dict(width=2),
                    hovertemplate="Year %{x}<br>Cost: ₹%{y:.1f}L<extra></extra>"
                ))
                
                # International education line
                fig_kids.add_trace(go.Scatter(
                    x=years,
                    y=[c / 100000 for c in international_costs],
                    mode="lines+markers",
                    name=f"Kid {i+1} - International (₹80L base)",
                    line=dict(width=2, dash="dash"),
                    hovertemplate="Year %{x}<br>Cost: ₹%{y:.1f}L<extra></extra>"
                ))
        
        fig_kids.update_layout(
            title="Education Cost Projection (11% annual inflation)",
            xaxis_title="Years from Now",
            yaxis_title="Cost (₹ Lakhs)",
            hovermode="x unified",
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        st.plotly_chart(fig_kids, use_container_width=True)
    
    # Summary cards
    st.markdown("---")
    st.header("📋 Quick Financial Snapshot")
    
    summary_cols = st.columns(4)
    
    with summary_cols[0]:
        st.metric("Annual Income", f"₹{annual_income/100000:.1f}L")
    
    with summary_cols[1]:
        monthly_investment = (annual_income * 0.2) / 12
        st.metric("Recommended Monthly SIP", f"₹{monthly_investment/1000:.1f}K")
    
    with summary_cols[2]:
        years_to_retire = max(60 - age, 0)
        st.metric("Years to Retirement", f"{years_to_retire}")
    
    with summary_cols[3]:
        savings_rate = max(0, ((annual_income - (monthly_expenses * 12)) / annual_income) * 100)
        savings_rate = min(savings_rate, 100)
        st.metric("Current Savings Rate", f"{savings_rate:.1f}%")
    
    # Download button for the plan
    st.markdown("---")
    col_download, col_space = st.columns([1, 3])
    with col_download:
        st.download_button(
            label="📥 Download Financial Plan",
            data=st.session_state.plan_response,
            file_name=f"financial_plan_{datetime.now().strftime('%Y%m%d')}.md",
            mime="text/markdown",
            use_container_width=True
        )

# Footer
st.markdown("---")
st.markdown(
    """
    <div style='text-align: center; color: gray; padding: 1rem;'>
        <p style='margin: 0;'>Built with ❤️ using <strong>AGNO Agents</strong> & <strong>Gemini Flash</strong></p>
        <p style='margin: 0; font-size: 0.9rem; color: #999;'>⚡ Optimized for speed and accuracy</p>
    </div>
    """,
    unsafe_allow_html=True
)
