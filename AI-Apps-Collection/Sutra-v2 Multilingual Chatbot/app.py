from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage
import streamlit as st
import os

# Set up Streamlit page
st.title("🌍 Sutra-v2 Multilingual Chatbot")
st.write("⚡ Powered by Sutra AI with support for multiple languages")

# Language options
LANGUAGES = {
    "English": "en",
    "Hindi": "hi",
    "Marathi": "mr",
    "Telugu": "te",
    "Tamil": "ta",
    "Bengali": "bn",
    "Gujarati": "gu",
    "Kannada": "kn",
    "Malayalam": "ml",
    "Punjabi": "pa",
    "French": "fr",
    "Spanish": "es"
}

# Add sidebar for configuration
with st.sidebar:
    st.header("⚙️ Configuration")
    
    # API key input
    st.session_state.sutra_api_key = st.text_input("Sutra API Key", type="password")
    
    # Language selection
    selected_lang = st.selectbox(
        "Select Conversation Language",
        options=list(LANGUAGES.keys()),
        index=0
    )
    st.session_state.language = LANGUAGES[selected_lang]
    
    # Model details
    st.divider()
    st.markdown("**Model Details**")
    st.caption("Running: `sutra-v2`")
    st.caption("Supports multiple Indian and international languages")
    
    # New chat button
    st.divider()
    if st.button("🔄 Start New Chat", use_container_width=True):
        st.session_state.messages = [
            SystemMessage(content=f"You are a helpful AI assistant. Respond in {selected_lang} language when appropriate.")
        ]
        st.rerun()

# Initialize chat history with system message
if "messages" not in st.session_state:
    st.session_state.messages = [
        SystemMessage(content="You are a helpful AI assistant. Respond in English by default.")
    ]

# Display welcome message in selected language
welcome_messages = {
    "en": "Hello! How can I help you today?",
    "hi": "नमस्ते! मैं आपकी कैसे मदद कर सकता हूँ?",
    "mr": "नमस्कार! मी तुमची कशी मदत करू शकतो?",
    "te": "హలో! నేను మీకు ఎలా సహాయం చేయగలను?",
    "ta": "வணக்கம்! நான் உங்களுக்கு எப்படி உதவ முடியும்?",
    "fr": "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
    # Add more language greetings as needed
}

with st.chat_message("assistant"):
    st.write(welcome_messages.get(st.session_state.language, "Hello! How can I help you today?"))

# Display chat history
for message in st.session_state.messages[1:]:  # Skip system message
    if isinstance(message, HumanMessage):
        with st.chat_message("user"):
            st.write(message.content)
    else:
        with st.chat_message("assistant"):
            st.write(message.content)

# Chat input
if prompt := st.chat_input("Type your message here..."):
    # Validate API key
    if not st.session_state.sutra_api_key:
        st.error("Please enter your Sutra API key in the sidebar")
        st.stop()
    
    # Initialize the ChatOpenAI model with Sutra
    try:
        chat = ChatOpenAI(
            api_key=st.session_state.sutra_api_key,
            base_url="https://api.two.ai/v2",
            model="sutra-v2"
        )
        
        # Add user message to chat history
        st.session_state.messages.append(HumanMessage(content=prompt))
        
        # Display user message
        with st.chat_message("user"):
            st.write(prompt)
        
        # Get AI response
        with st.chat_message("assistant"):
            message_placeholder = st.empty()
            full_response = ""
            
            # Stream the response
            for chunk in chat.stream(st.session_state.messages):
                if chunk.content:
                    full_response += chunk.content
                    message_placeholder.write(full_response)
            
            # Update with final response
            message_placeholder.write(full_response)
        
        # Add AI response to chat history
        st.session_state.messages.append(AIMessage(content=full_response))
    
    except Exception as e:
        st.error(f"An error occurred: {str(e)}")