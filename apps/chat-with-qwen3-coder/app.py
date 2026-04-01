from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
import streamlit as st
import os

# Set up Streamlit page
st.set_page_config(page_title="Chat With Qwen3 Coder", page_icon="🚀")
st.title("🚀 Chat With Qwen3 Coder")
st.write("Powered By [OpenRouter](https://openrouter.ai/models)")

# Sidebar for API key input and details
with st.sidebar:
    st.header("⚙️ Configuration")
    # Use a consistent name for the API key in session state
    if 'openrouter_api_key' not in st.session_state:
        st.session_state.openrouter_api_key = ''

    st.session_state.openrouter_api_key = st.text_input(
        "OpenRouter API Key", type="password", value=st.session_state.openrouter_api_key
    )

    st.divider()
    st.markdown("**Model Details**")
    # Corrected model name typo
    st.caption("Running: `qwen/qwen3-coder`")
    st.caption("via OpenRouter")

    st.divider()
    if st.button("🔄 Start New Chat", use_container_width=True):
        st.session_state.messages = [
            SystemMessage(content="You are a helpful AI assistant.")
        ]
        st.rerun()

    st.divider()
    st.markdown(
        "**❤️ Built by** [Build Fast with AI](https://buildfastwithai.com/genai-course)",
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
    if not st.session_state.openrouter_api_key:
        st.error("Please enter your OpenRouter API key in the sidebar.")
        st.stop()

    # Add user message to history and display it
    st.session_state.messages.append(HumanMessage(content=prompt))
    with st.chat_message("user"):
        st.markdown(prompt)

    # Initialize the ChatOpenAI model
    try:
        chat = ChatOpenAI(
            model="qwen/qwen3-coder",
            openai_api_key=st.session_state.openrouter_api_key,
            openai_api_base="https://openrouter.ai/api/v1",
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