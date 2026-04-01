import streamlit as st
import os
from openai import OpenAI
import json

# === PAGE CONFIGURATION ===
st.set_page_config(
    page_title="LifePath AI - Decision Architect",
    page_icon="🧭",
    layout="wide",
    initial_sidebar_state="expanded"
)

# === CUSTOM CSS FOR "PREMIUM" LOOK ===
st.markdown("""
    <style>
    /* Use Streamlit theme variables for better light/dark mode support */
    .stButton>button {
        width: 100%;
        background-color: #4F46E5; /* Primary color */
        color: white;
        border-radius: 8px;
        font-weight: 600;
        padding: 0.5rem 1rem;
        border: none;
    }
    .stButton>button:hover {
        background-color: #4338ca;
    }
    .agent-box {
        background-color: var(--secondary-background-color);
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        margin-bottom: 20px;
        border-left: 5px solid #4F46E5;
        color: var(--text-color);
    }
    .agent-title {
        color: var(--text-color);
        font-size: 1.1rem;
        font-weight: 700;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    h1, h2, h3 {
        font-family: 'Inter', sans-serif;
    }
    </style>
""", unsafe_allow_html=True)

# === SIDEBAR ===
with st.sidebar:
    st.title("🧭 Configuration")
    
    api_key = st.text_input("OpenRouter API Key", type="password", help="Enter your OpenRouter API key to access GLM-4.7")
    
    st.markdown("### Decision Context")
    dilemma_type = st.selectbox(
        "Select Your Dilemma",
        ["Career Change", "Relocation", "Relationship", "Financial Investment", "Education Path", "Custom"]
    )
    
    deep_thinking = st.toggle("Deep Thinking Mode", value=True, help="Enables simulated multi-agent reasoning for deeper analysis.")
    
    st.divider()
    
    # === BRANDING SECTION (MANDATORY) ===
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

# === MAIN INTERFACE ===
st.title("🧭 LifePath AI")
st.markdown("### Your Personal Decision Architect")
st.markdown("Unsure about a big life choice? Let our **AI Agent Team** break it down, simulate outcomes, and provide a reasoned path forward.")

# === INPUT SECTION ===
with st.container():
    col1, col2 = st.columns([2, 1])
    
    with col1:
        user_query = st.text_area(
            "Describe your situation in detail:",
            height=150,
            placeholder="E.g., I have a job offer in London with a 20% pay rise, but my partner likes our current city. We also want to buy a house soon..."
        )
    
    with col2:
        st.info("💡 **Tip:** Be specific about constraints, fears, and long-term goals for the best advice.")
        generate_btn = st.button("Analyze Decision 🚀")

# === LOGIC ===
if generate_btn:
    if not api_key:
        st.error("🔑 Please enter your OpenRouter API Key in the sidebar to proceed.")
    elif not user_query:
        st.warning("✍️ Please describe your dilemma first.")
    else:
        # Initialize Client
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        
        # Define System Prompt for "Agentic" Behavior
        system_prompt = """
        You are 'LifePath AI', a decision support system running on GLM-4.7.
        Your goal is to help users make complex life decisions by simulating a team of agents.
        
        IMPORTANT: Always respond in ENGLISH.
        
        You must structure your response EXACTLY in JSON format with the following keys:
        {
            "analyst_thought": "The Analyst's breakdown of the core factors, emotional vs logical constraints.",
            "simulator_scenarios": [
                {"title": "Option A: [Name]", "outcome": "Predicted outcome..."},
                {"title": "Option B: [Name]", "outcome": "Predicted outcome..."}
            ],
            "advisor_recommendation": "The final synthesized advice.",
            "decision_matrix": {
                "factors": ["Factor 1", "Factor 2", "Factor 3"],
                "options": [
                    {"name": "Option A", "scores": [8, 5, 9]},
                    {"name": "Option B", "scores": [6, 9, 7]}
                ]
            }
        }
        
        Be empathetic but logical. Use the user's input context deeply.
        """
        
        # User Prompt
        user_prompt = f"""
        Context: {dilemma_type}
        User Situation: {user_query}
        
        Deep Thinking Mode: {'Enabled' if deep_thinking else 'Disabled'}
        
        Act as the Analyst, Simulator, and Advisor. Provide the JSON response.
        """
        
        try:
            with st.spinner("🤖 The Agent Team is analyzing your life path..."):
                response = client.chat.completions.create(
                    model="z-ai/glm-4.7",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"}
                )
                
                content = response.choices[0].message.content
                try:
                    data = json.loads(content)
                    
                    # === DISPLAY RESULTS ===
                    
                    # 1. The Analyst
                    st.markdown('<div class="agent-box">', unsafe_allow_html=True)
                    st.markdown('<div class="agent-title">🔍 The Analyst</div>', unsafe_allow_html=True)
                    st.markdown(f"*{data.get('analyst_thought', 'Analyzing...')}*")
                    st.markdown('</div>', unsafe_allow_html=True)
                    
                    # 2. The Simulator
                    st.markdown('<div class="agent-box">', unsafe_allow_html=True)
                    st.markdown('<div class="agent-title">🔮 The Simulator</div>', unsafe_allow_html=True)
                    cols = st.columns(len(data.get('simulator_scenarios', [])))
                    for idx, scen in enumerate(data.get('simulator_scenarios', [])):
                        with cols[idx]:
                            st.subheader(scen.get('title', f'Option {idx+1}'))
                            st.write(scen.get('outcome', ''))
                    st.markdown('</div>', unsafe_allow_html=True)
                    
                    # 3. Decision Matrix
                    st.markdown("### 📊 Decision Matrix")
                    matrix = data.get('decision_matrix', {})
                    if matrix:
                        # Simple table construction
                        factors = matrix.get('factors', [])
                        options = matrix.get('options', [])
                        
                        header = "| Option | " + " | ".join(factors) + " |"
                        separator = "|---|" + "|".join(["---"] * len(factors)) + "|"
                        rows = []
                        for opt in options:
                            row = f"| **{opt['name']}** | " + " | ".join(map(str, opt['scores'])) + " |"
                            rows.append(row)
                        
                        st.markdown("\n".join([header, separator] + rows))
                    
                    # 4. The Advisor
                    st.markdown('<div class="agent-box" style="border-left-color: #10B981;">', unsafe_allow_html=True)
                    st.markdown('<div class="agent-title">🎓 The Advisor Recommendation</div>', unsafe_allow_html=True)
                    st.markdown(f"### {data.get('advisor_recommendation', 'Finalizing advice...')}")
                    st.markdown('</div>', unsafe_allow_html=True)
                    
                except json.JSONDecodeError:
                    st.error("Error parsing the agent's thought process. Please try again.")
                    st.text(content) # Fallback to raw text
                    
        except Exception as e:
            st.error(f"An error occurred: {str(e)}")

# === FOOTER ===
st.markdown("---")
st.markdown(
    "<div style='text-align: center; color: #666;'>"
    "Powered by <b>z-ai/glm-4.7</b> via OpenRouter &middot; Built with ❤️ by LifePath AI"
    "</div>",
    unsafe_allow_html=True
)
