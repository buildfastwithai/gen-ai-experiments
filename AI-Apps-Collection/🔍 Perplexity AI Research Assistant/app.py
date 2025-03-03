import streamlit as st
import time
from langchain.chat_models import ChatOpenAI
from langchain.schema import HumanMessage
import json
from datetime import datetime
from typing import Dict, List, Optional

# Page config for better appearance
st.set_page_config(
    page_title="Perplexity AI Research Assistant",
    page_icon=":mag:",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Constants
CHAT_HISTORY_FILE = "chat_history.json"
MODEL_NAME = "sonar-deep-research"
API_BASE_URL = "https://api.perplexity.ai"

# Custom CSS for better UI
def apply_custom_css():
    st.markdown("""
        <style>
        .main .block-container {padding-top: 2rem;}
        .stChatMessage {
            background-color: #1A1A1A;
            border-radius: 10px;
            padding: 0.5rem;
            margin-bottom: 1rem;
        }
        .user-message {
            background-color: #2D3748;
            color: white;
            padding: 1rem;
            border-radius: 8px;
        }
        .assistant-message {
            background-color: #1E1E1E;
            color: #F0F0F0;
            padding: 1rem;
            border-radius: 8px;
        }
        .thinking-box {
            background-color: #1A1A1A;
            color: #A0A0A0;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 10px;
        }
        .searching-text {
            color: #4DA6FF;
            font-weight: bold;
        }
        .meta-info {
            font-size: 0.8rem;
            color: #888;
            text-align: right;
        }
        .sidebar .block-container {
            background-color: #1A1A1A;
        }
        </style>
    """, unsafe_allow_html=True)

# Function to initialize the chat model
def initialize_chat_model(api_key: str) -> ChatOpenAI:
    """Initialize the ChatOpenAI model with the provided API key."""
    return ChatOpenAI(
        openai_api_key=api_key,
        openai_api_base=API_BASE_URL,
        model=MODEL_NAME,
        max_tokens=2000
    )

# Function to save chat history
def save_chat_history(messages: List[Dict], filename: str = CHAT_HISTORY_FILE) -> str:
    """Save chat history to a JSON file."""
    try:
        with open(filename, "w") as f:
            json.dump(messages, f, indent=4)
        return filename
    except Exception as e:
        st.error(f"Failed to save chat history: {str(e)}")
        return ""

# Function to load chat history
def load_chat_history(filename: str = CHAT_HISTORY_FILE) -> List[Dict]:
    """Load chat history from a JSON file."""
    try:
        with open(filename, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except Exception as e:
        st.error(f"Failed to load chat history: {str(e)}")
        return []

# Function to handle chat
def process_chat(prompt: str, chat_model: ChatOpenAI) -> Dict:
    """Process the user's prompt and return the assistant's response."""
    try:
        messages = [HumanMessage(content=prompt)]

        # Get response from Perplexity
        with st.spinner(""):
            start_time = time.time()
            response = chat_model(messages)
            end_time = time.time()

        return {
            "content": response.content,
            "time_taken": round(end_time - start_time, 2)
        }
    except Exception as e:
        st.error(f"Error processing chat: {str(e)}")
        return {"content": f"I encountered an error: {str(e)}", "time_taken": 0}

# Function to display chat history
def display_chat_history(messages: List[Dict]):
    """Display the chat history in the Streamlit app."""
    for message in messages:
        if message["role"] == "user":
            with st.chat_message("user", avatar="👤"):  # User avatar
                st.markdown(f"<div class='user-message'>{message['content']}</div>", unsafe_allow_html=True)
        else:
            with st.chat_message("assistant", avatar="🤖"):  # Assistant avatar
                st.markdown(f"<div class='assistant-message'>{message['content']}</div>", unsafe_allow_html=True)
                if "metadata" in message:
                    st.markdown(f"<div class='meta-info'>Response time: {message['metadata']['time_taken']}s</div>",
                                unsafe_allow_html=True)

# Function to handle the sidebar
def sidebar_configuration() -> Optional[str]:
    """Configure the sidebar and return the API key if provided."""
    st.sidebar.header(":gear: Configuration")

    # API Key handling
    api_key = st.sidebar.text_input("Enter your Perplexity API Key", type="password")
    if api_key:
        st.session_state.api_key = api_key
        st.sidebar.success("API Key saved!")

    # New buttons
    st.sidebar.subheader("Actions")
    if st.sidebar.button("Start New Chat", key="start_new_chat"):
        st.session_state.messages = []  # Clear chat history
        st.rerun()

    st.sidebar.markdown("---")  # Divider
    st.sidebar.write(":heart: Built by [Build Fast with AI](https://buildfastwithai.com/genai-course)")

    return api_key if api_key else None

# Main Streamlit app
def main():
    apply_custom_css()

    # App title and description
    col1, col2 = st.columns([6, 1])
    with col1:
        st.title(":mag: Perplexity AI Research Assistant")
    with col2:
        current_time = datetime.now().strftime("%b %d, %Y")
        st.markdown(f"<div style='text-align: right; padding-top: 1rem;'>{current_time}</div>", unsafe_allow_html=True)

    st.markdown("Powered by Sonar Deep Research model - Ask any research question to get comprehensive answers with citations.")

    # Sidebar configuration
    api_key = sidebar_configuration()

    # Check if API key is provided
    if not api_key:
        st.warning("Please enter your Perplexity API key in the sidebar to continue.")
        st.markdown("""
        ### How to get a Perplexity API key
        1. Create an account on [Perplexity AI](https://www.perplexity.ai/)
        2. Navigate to your account settings
        3. Generate a new API key
        4. Copy and paste the key in the sidebar
        """)
        return

    # Initialize chat model with provided API key
    chat_model = initialize_chat_model(api_key)

    # Initialize chat history in session state
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Display chat history
    display_chat_history(st.session_state.messages)

    # Chat input
    if prompt := st.chat_input("What would you like to research today?"):
        # Add user message to chat history
        st.session_state.messages.append({"role": "user", "content": prompt})

        # Display user message
        with st.chat_message("user", avatar="👤"):  # User avatar
            st.markdown(f"<div class='user-message'>{prompt}</div>", unsafe_allow_html=True)

        # Display assistant response with thinking animation
        with st.chat_message("assistant", avatar="🤖"):  # Assistant avatar
            response_container = st.empty()

            # Show thinking/searching status
            response_container.markdown(
                f'<div class="thinking-box">'
                f'<span class="searching-text">Searching</span><br>'
                f'<span>{prompt[:40]}{"..." if len(prompt) > 40 else ""}</span>'
                f'</div>',
                unsafe_allow_html=True
            )

            # Process the chat
            response_data = process_chat(prompt, chat_model)

            # Display the response
            response_container.markdown(
                f"<div class='assistant-message'>{response_data['content']}</div>",
                unsafe_allow_html=True
            )

            # Show metadata about the response
            st.markdown(
                f"<div class='meta-info'>Response time: {response_data['time_taken']}s</div>",
                unsafe_allow_html=True
            )

            # Add to chat history with metadata
            st.session_state.messages.append({
                "role": "assistant",
                "content": response_data['content'],
                "metadata": {
                    "time_taken": response_data['time_taken'],
                    "timestamp": datetime.now().isoformat(),
                    "model": MODEL_NAME
                }
            })

if __name__ == "__main__":
    main()