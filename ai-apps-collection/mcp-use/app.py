import streamlit as st
import asyncio
import json
import os
from typing import Dict, Any
import threading
from concurrent.futures import ThreadPoolExecutor
from langchain_openai import ChatOpenAI

# Import the MCP components
try:
    from mcp_use import MCPAgent, MCPClient
except ImportError:
    st.error("Please install the required dependencies: pip install mcp-use langchain-openai python-dotenv")
    st.stop()


# Page configuration
st.set_page_config(
    page_title="MCP Agent Chat",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Main chat interface
st.markdown(
    "<h1 style='text-align: center;'>🤖 MCP Agent Chat</h1>",
    unsafe_allow_html=True
)
st.markdown("<p style='text-align: center;'>Configure your MCP servers in the sidebar, activate the agent and start chatting!</p>", unsafe_allow_html=True)

# Initialize session state
if "messages" not in st.session_state:
    st.session_state.messages = []
if "agent" not in st.session_state:
    st.session_state.agent = None
if "client" not in st.session_state:
    st.session_state.client = None
if "config_text" not in st.session_state:
    st.session_state.config_text = ""

def get_example_config() -> Dict[str, Any]:
    """Return the example configuration from agents.py"""
    return {
        "mcpServers": {
            "airbnb": {
                "command": "npx.cmd",
                "args": ["-y", "@openbnb/mcp-server-airbnb", "--ignore-robots-txt"],
            },
            "playwright": {
                "command": "npx.cmd",
                "args": ["@playwright/mcp@latest"],
                "env": {"DISPLAY": ":1"},
            },
            "filesystem": {
                "command": "npx.cmd",
                "args": [
                    "-y",
                    "@modelcontextprotocol/server-filesystem",
                    os.getcwd(),
                ],
            },
        }
    }

def get_tools_from_config(config_text: str) -> list[str]:
    """Extract list of tool names from MCP configuration"""
    try:
        data = json.loads(config_text)
        return list(data.get("mcpServers", {}).keys())
    except json.JSONDecodeError as e:
        print("Invalid JSON:", e)
        return []

def validate_config(config_text: str) -> tuple[bool, Dict[str, Any] | None, str]:
    """Validate the JSON configuration"""
    try:
        config = json.loads(config_text)
        if "mcpServers" not in config:
            return False, None, "Configuration must contain 'mcpServers' key"
        return True, config, ""
    except json.JSONDecodeError as e:
        return False, None, f"Invalid JSON: {str(e)}"

async def create_agent(config: Dict[str, Any]) -> tuple[bool, str]:
    """Create MCP agent with the given configuration"""
    try:
        # Create MCPClient with the configuration
        client = MCPClient.from_dict(config)
        
        # Create LLM
        llm = ChatOpenAI(model="gpt-4o")
        
        # Create agent with the client
        agent = MCPAgent(llm=llm, client=client, max_steps=30)
        
        return True, "Agent created successfully!"
    except Exception as e:
        return False, f"Error creating agent: {str(e)}"

def run_async_create_agent(config: Dict[str, Any]) -> tuple[bool, str]:
    """Run the async create_agent function in a new event loop"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(create_agent(config))
        return result
    finally:
        loop.close()

async def run_agent_query(query: str) -> str:
    """Run a query with the current agent"""
    try:
        if st.session_state.agent is None:
            return "No agent available. Please configure and submit the MCP configuration first."
        
        result = await st.session_state.agent.run(query, max_steps=30)
        return result
    except Exception as e:
        return f"Error running query: {str(e)}"

def run_async_query(query: str) -> str:
    """Run the async run_agent_query function in a new event loop"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(run_agent_query(query))
        return result
    finally:
        loop.close()

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

# st.sidebar.markdown("### Game Settings")
api_key = st.sidebar.text_input("Enter your OpenAI API Key", type="password")
os.environ["OPENAI_API_KEY"] = api_key

# Sidebar for MCP Configuration
if api_key:
    with st.sidebar:
        st.markdown("---")
        st.title("🤖 MCP Configuration")
        
        # Text area for MCP configuration
        config_text = st.text_area(
            "Paste your MCP configuration JSON here:",
            value=st.session_state.get("config_text", ""),
            height=200,
            placeholder='{"mcpServers": {...}}',
            help="Enter a valid JSON configuration for MCP servers",
            key="config_text_area"
        )
        
        # Activate Config button
        if st.button("🚀 Activate Config", type="primary", use_container_width=True):
            if config_text.strip():
                is_valid, config, error_msg = validate_config(config_text)
                if is_valid:
                    with st.spinner("Creating agent..."):
                        success, message = run_async_create_agent(config)
                        if success:
                            st.session_state.agent = MCPAgent(
                                llm=ChatOpenAI(model="gpt-4o"),
                                client=MCPClient.from_dict(config),
                                max_steps=30
                            )
                            st.session_state.client = MCPClient.from_dict(config)
                            st.session_state.success = message
                        else:
                            st.error(message)
                else:
                    st.error(error_msg)
            else:
                st.warning("Please enter a configuration")
        
        # Success message
        if "success" in st.session_state:
            st.success(st.session_state.success)
        
        st.markdown("---")
        
        # Load Config Example button
        if st.button("📋 Load Config Example", use_container_width=True):
            example_config = get_example_config()
            st.session_state.config_text = json.dumps(example_config, indent=2)
            st.rerun()
        
        
        # Available MCP Tools section
        if st.session_state.client:
            try:
                servers = get_tools_from_config(config_text)
                # Build markdown string
                try:
                    if servers:
                        markdown_text = "#### Available MCP tools:\n\n"
                        markdown_text += "\n".join([f"- {tool}" for tool in servers])
                        st.info(markdown_text)
                    else:
                        st.markdown("• No servers available")
                except Exception as e:
                    st.markdown("• No servers available")
            except:
                st.markdown("• No servers available")
        else:
            # Show tools from current config text if available
            if config_text.strip():
                tools = get_tools_from_config(config_text)
                if tools:
                        markdown_text = "#### Available MCP tools:\n\n"
                        markdown_text += "\n".join([f"- {tool}" for tool in tools])
                        st.info(markdown_text)
                else:
                        st.markdown("• No servers available")
            else:
                st.markdown("• No agent configured")
        
        st.markdown("---")
        
        # Single Clear All button
        if st.button("🗑️ Clear Chat & Config", use_container_width=True, type="secondary"):
            st.session_state.messages = []
            st.session_state.agent = None
            st.session_state.client = None
            st.session_state.config_text = ""
            if "success" in st.session_state:
                del st.session_state.success
            st.rerun()


    # Display chat messages
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
    # Chat input
    if prompt := st.chat_input("Ask agent a question..."):
        # Add user message to chat history
        st.session_state.messages.append({"role": "user", "content": prompt})
        
        # Display user message
        with st.chat_message("user"):
            st.markdown(prompt)
        
        # Display assistant response
        with st.chat_message("assistant"):
            message_placeholder = st.empty()
            
            if st.session_state.agent is None:
                response = "Please configure and submit the MCP configuration first."
            else:
                with st.spinner("Agent is thinking..."):
                    response = run_async_query(prompt)
            
            message_placeholder.markdown(response)
        
        # Add assistant response to chat history
        st.session_state.messages.append({"role": "assistant", "content": response})

else:
    st.error("Please enter your OpenAI API Key")