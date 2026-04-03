from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
import streamlit as st
import os

# Page configuration
st.set_page_config(
    page_title="Chat With gpt-oss-120b",
    page_icon="🚀",
    layout="centered",
    initial_sidebar_state="expanded",
)
st.title("🚀 Chat With Gpt-Oss-120b")
st.write("Powered By [Cerebras](https://cerebras.ai)")

# Sidebar for API key input and details
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
    
    # === CONFIGURATION SECTION ===
    st.markdown("### ⚙️ Configuration")
    
    # API Key input with better styling
    if 'cerebras_api_key' not in st.session_state:
        st.session_state.cerebras_api_key = ''
    
    st.markdown("**🔑 API Key**")
    st.session_state.cerebras_api_key = st.text_input(
        "Enter your Cerebras API Key",
        type="password",
        value=st.session_state.cerebras_api_key,
        placeholder="sk-cerebras-...",
        help="Get your API key from Cerebras.ai"
    )
    
    # Connection status
    if st.session_state.cerebras_api_key:
        st.success("✅ API Key configured")
    else:
        st.warning("⚠️ Please enter your API key to start chatting")
    
    st.markdown("---")
    
    # === MODEL INFO SECTION ===
    st.markdown("### 🤖 Model Information")
    
    # Using columns to align model information
    col1, col2 = st.columns([1, 2])
    with col1:
        st.markdown("**Model:**")
    with col2:
        st.markdown("`gpt-oss-120b`")

    col1, col2 = st.columns([1, 2])
    with col1:
        st.markdown("**Provider:**")
    with col2:
        st.markdown("Cerebras")

    col1, col2 = st.columns([1, 2])
    with col1:
        st.markdown("**Status:**")
    with col2:
        st.markdown("🟢 Active")
    
    st.markdown("---")
    
    # === ACTIONS SECTION ===
    st.markdown("### 🎯 Actions")
    
    if st.button("🔄 Start New Chat", use_container_width=True, type="primary"):
        st.session_state.messages = [
            SystemMessage(content="You are a helpful AI assistant.")
        ]
        st.rerun()
    
    if st.button("🗑️ Clear History", use_container_width=True):
        if 'messages' in st.session_state:
            st.session_state.messages = [
                SystemMessage(content="You are a helpful AI assistant.")
            ]
            st.success("Chat history cleared!")
            st.rerun()
    
    st.markdown("---")
    
    # === FOOTER SECTION ===
    st.markdown(
        "<div style='text-align: center; margin-top: 20px;'>"
        "<p style='font-size: 12px; color: #666;'>Built with ❤️ by</p>"
        "<a href='https://buildfastwithai.com/genai-course' target='_blank' "
        "style='text-decoration: none; color: #1f77b4; font-weight: bold;'>"
        "Build Fast with AI</a>"
        "</div>",
        unsafe_allow_html=True
    )

# Initialize chat history in session state if it doesn't exist
if "messages" not in st.session_state:
    st.session_state.messages = [
        SystemMessage(content="You are a helpful AI assistant.")
    ]

# Display chat history, skipping the initial system message
for message in st.session_state.messages:
    if isinstance(message, HumanMessage):
        with st.chat_message("user"):
            st.markdown(message.content)
    elif isinstance(message, AIMessage):
        with st.chat_message("assistant"):
            st.markdown(message.content)

# Chat input
if prompt := st.chat_input("What's on your mind?"):
    if not st.session_state.cerebras_api_key:
        st.error("Please enter your Cerebras API key in the sidebar.")
        st.stop()

    # Add user message to history and display it
    st.session_state.messages.append(HumanMessage(content=prompt))
    with st.chat_message("user"):
        st.markdown(prompt)

    # Initialize the ChatOpenAI model
    try:
        chat = ChatOpenAI(
            model="gpt-oss-120b",
            openai_api_key=st.session_state.cerebras_api_key,
            base_url="https://api.cerebras.ai/v1",
            streaming=True
        )

        # Get AI response
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                response = chat.invoke(st.session_state.messages)
                st.markdown(response.content)
        
        # Add AI response to chat history
        st.session_state.messages.append(AIMessage(content=response.content))

    except Exception as e:
        st.error(f"An error occurred: {e}")
