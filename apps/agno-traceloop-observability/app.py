import streamlit as st
import os
from traceloop.sdk import Traceloop
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.team import Team

# Page configuration
st.set_page_config(
    page_title="Agno + Traceloop",
    page_icon="🔍",
    layout="wide"
)

# Custom CSS for chat UI
st.markdown("""
<style>
    .stChatFloatingInputContainer {
        bottom: 20px;
        background-color: transparent;
    }
    .stChatMessage {
        background-color: rgba(255, 255, 255, 0.05);
        border-radius: 10px;
        padding: 10px;
        margin-bottom: 10px;
    }
    [data-testid="stChatMessageContent"] {
        background-color: transparent;
    }
    .chat-container {
        height: 400px;
        overflow-y: auto;
        padding: 10px;
        border-radius: 10px;
        background-color: rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
    }
</style>
""", unsafe_allow_html=True)

# Initialize Traceloop - must be called before creating agents
@st.cache_resource
def init_traceloop():
    api_key = os.getenv("TRACELOOP_API_KEY")
    if api_key:
        Traceloop.init(
            disable_batch=True,
            api_key="tl_f015734b87a246e79553e70c7f372b1b"
        )
        return True
    return False

# Initialize agents
@st.cache_resource
def create_single_agent():
    return Agent(
        name="Assistant",
        model=OpenAIChat(id="gpt-4o"),
        description="A helpful AI assistant",
        instructions=["Be concise and helpful", "Provide accurate information"],
    )

@st.cache_resource
def create_agent_team():
    researcher = Agent(
        name="Researcher",
        role="Research Specialist",
        model=OpenAIChat(id="gpt-4o"),
        instructions=["Research topics thoroughly and provide factual information"],
    )
    
    writer = Agent(
        name="Writer",
        role="Content Writer",
        model=OpenAIChat(id="gpt-4o"),
        instructions=["Write clear, engaging content based on research"],
    )
    
    team = Team(
        name="ContentTeam",
        members=[researcher, writer],
        model=OpenAIChat(id="gpt-4o"),
    )
    return team

def create_tool_agent():
    def get_weather(city: str) -> str:
        """Get the weather for a city."""
        weather_data = {
            "new york": "Partly cloudy, 68°F",
            "london": "Rainy, 55°F",
            "tokyo": "Sunny, 75°F",
            "paris": "Cloudy, 62°F",
            "sydney": "Sunny, 82°F",
        }
        return weather_data.get(city.lower(), f"Weather data for {city}: Sunny, 72°F")
    
    def calculate(expression: str) -> str:
        """Calculate a mathematical expression."""
        try:
            result = eval(expression)
            return f"Result: {result}"
        except:
            return "Error: Invalid expression"
    
    return Agent(
        name="ToolAgent",
        model=OpenAIChat(id="gpt-4o"),
        tools=[get_weather, calculate],
        description="An agent with weather and calculator tools",
        instructions=["Use the available tools to help answer questions"],
    )

# Main app
def main():
    st.title("🔍 Agno + Traceloop Observability")
    st.markdown("*Monitor your AI agents with OpenTelemetry-based tracing*")
    
    # Sidebar for configuration
    with st.sidebar:
        st.header("⚙️ Configuration")
        
        # API Key inputs
        openai_key = st.text_input("OpenAI API Key", type="password", value=os.getenv("OPENAI_API_KEY", ""))
        traceloop_key = st.text_input("Traceloop API Key", type="password", value=os.getenv("TRACELOOP_API_KEY", ""))
        
        if openai_key:
            os.environ["OPENAI_API_KEY"] = openai_key
        if traceloop_key:
            os.environ["TRACELOOP_API_KEY"] = traceloop_key
        
        # Initialize Traceloop
        traceloop_initialized = init_traceloop()
        
        if traceloop_initialized:
            st.success("✅ Traceloop Connected")
        else:
            st.warning("⚠️ Set TRACELOOP_API_KEY to enable tracing")
        
        st.divider()
        st.markdown("### 📊 View Traces")
        st.markdown("[Open Traceloop Dashboard](https://app.traceloop.com/)")
        
        st.divider()
        st.markdown("### 📚 Resources")
        st.markdown("- [Agno Docs](https://docs.agno.com)")
        st.markdown("- [Traceloop Docs](https://www.traceloop.com/docs)")
    
    # Main content tabs
    tab1, tab2, tab3 = st.tabs(["💬 Single Agent", "👥 Multi-Agent Team", "🛠️ Agent with Tools"])
    
    # Tab 1: Single Agent Chat
    with tab1:
        st.subheader("💬 Single Agent Chat")
        st.caption("Chat with a basic Agno agent. All interactions are traced to Traceloop.")
        
        # Initialize chat history
        if "single_agent_messages" not in st.session_state:
            st.session_state.single_agent_messages = []
        
        # Chat container with messages
        chat_container = st.container(height=400)
        with chat_container:
            if not st.session_state.single_agent_messages:
                st.info("Start a conversation below!")
            for message in st.session_state.single_agent_messages:
                with st.chat_message(message["role"]):
                    st.markdown(message["content"])
        
        # Chat input at bottom
        if prompt := st.chat_input("Ask the assistant anything...", key="single_agent_input"):
            if not os.getenv("OPENAI_API_KEY"):
                st.error("Please enter your OpenAI API Key in the sidebar")
            else:
                # Add user message
                st.session_state.single_agent_messages.append({"role": "user", "content": prompt})
                
                # Get agent response
                with st.spinner("Thinking..."):
                    agent = create_single_agent()
                    response = agent.run(prompt)
                    st.session_state.single_agent_messages.append({"role": "assistant", "content": response.content})
                st.rerun()
    
    # Tab 2: Multi-Agent Team
    with tab2:
        st.subheader("👥 Multi-Agent Team")
        st.caption("Researcher + Writer agents collaborate. Team execution creates nested spans.")
        
        # Initialize team chat history
        if "team_messages" not in st.session_state:
            st.session_state.team_messages = []
        
        # Chat container with messages
        team_container = st.container(height=400)
        with team_container:
            if not st.session_state.team_messages:
                st.info("Ask the team to research and write about something!")
            for message in st.session_state.team_messages:
                with st.chat_message(message["role"]):
                    st.markdown(message["content"])
        
        # Chat input at bottom
        if team_prompt := st.chat_input("Ask the team to research and write...", key="team_input"):
            if not os.getenv("OPENAI_API_KEY"):
                st.error("Please enter your OpenAI API Key in the sidebar")
            else:
                # Add user message
                st.session_state.team_messages.append({"role": "user", "content": team_prompt})
                
                # Get team response
                with st.spinner("Team is collaborating..."):
                    team = create_agent_team()
                    result = team.run(team_prompt)
                    st.session_state.team_messages.append({"role": "assistant", "content": result.content})
                st.rerun()
    
    # Tab 3: Agent with Tools
    with tab3:
        st.subheader("🛠️ Agent with Tools")
        st.caption("Weather & Calculator tools. Tool calls are traced as separate spans.")
        
        col1, col2 = st.columns(2)
        with col1:
            st.success("🌤️ Weather: Ask about any city")
        with col2:
            st.success("🧮 Calculator: Math expressions")
        
        # Initialize tool agent chat history
        if "tool_agent_messages" not in st.session_state:
            st.session_state.tool_agent_messages = []
        
        # Chat container with messages
        tool_container = st.container(height=350)
        with tool_container:
            if not st.session_state.tool_agent_messages:
                st.info("Try: 'What's the weather in Tokyo?' or 'Calculate 25 * 4 + 10'")
            for message in st.session_state.tool_agent_messages:
                with st.chat_message(message["role"]):
                    st.markdown(message["content"])
        
        # Chat input at bottom
        if tool_prompt := st.chat_input("Ask about weather or calculate something...", key="tool_input"):
            if not os.getenv("OPENAI_API_KEY"):
                st.error("Please enter your OpenAI API Key in the sidebar")
            else:
                # Add user message
                st.session_state.tool_agent_messages.append({"role": "user", "content": tool_prompt})
                
                # Get tool agent response
                with st.spinner("Using tools..."):
                    tool_agent = create_tool_agent()
                    response = tool_agent.run(tool_prompt)
                    st.session_state.tool_agent_messages.append({"role": "assistant", "content": response.content})
                st.rerun()
    
    # Footer
    st.divider()
    st.markdown("""
    <div style='text-align: center; color: #666;'>
        <p>Built with <a href='https://docs.agno.com'>Agno</a> + <a href='https://www.traceloop.com'>Traceloop</a> + <a href='https://streamlit.io'>Streamlit</a></p>
        <p>All agent interactions are automatically traced using OpenTelemetry</p>
    </div>
    """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()
