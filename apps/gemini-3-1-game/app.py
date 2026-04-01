import streamlit as st
import streamlit.components.v1 as components
import os
import re
from agno.agent import Agent
from agno.models.google import Gemini

# Configure Streamlit page
st.set_page_config(
    page_title="AI Web Game Builder",
    page_icon="🎮",
    layout="wide"
)

# Custom CSS for a clean look
st.markdown("""
<style>
    .reportview-container {
        font-family: 'Helvetica Neue', sans-serif;
    }
</style>
""", unsafe_allow_html=True)

st.title("🎮 Chat-Based Game Builder")
st.markdown("Chat with **Google Gemini 3.1 Pro Preview** to generate and iteratively improve playable web games (HTML/CSS/JS) right here in the app!")

# Sidebar Configuration
with st.sidebar:
    st.header("⚙️ Configuration")
    
    # API Key Input
    gemini_api_key = st.text_input("Gemini API Key", type="password", help="Enter your Google Gemini API Key to proceed.")
    if gemini_api_key:
        os.environ["GEMINI_API_KEY"] = gemini_api_key
        
    st.markdown("---")
    
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

# Initialize Session State
if "messages" not in st.session_state:
    # Adding an initial system greeting
    st.session_state.messages = [{"role": "assistant", "content": "Hello! What kind of game would you like to build today? (e.g. 'Build a classic snake game with a neon theme')\n\n*(Note: Provide your API key in the sidebar first!)*"}]
if "current_game_html" not in st.session_state:
    st.session_state.current_game_html = ""

# Main Layout
col_chat, col_game = st.columns([1, 1.2])

with col_chat:
    st.subheader("💬 Chat")
    
    # Display chat messages
    chat_container = st.container(height=550)
    with chat_container:
        for msg in st.session_state.messages:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
    
    # Chat Input
    prompt = st.chat_input("Prompt e.g., 'Make the snake move faster and add sound effects'")

with col_game:
    st.subheader("🕹️ Playable Game")
    
    if st.session_state.current_game_html:
        # Render the HTML snippet safely inside an iframe
        components.html(st.session_state.current_game_html, height=650, scrolling=True)
    else:
        st.info("The generated game will appear here. Start chatting to build one!")

if prompt:
    if not gemini_api_key:
        st.error("⚠️ Please enter your Gemini API Key in the sidebar to begin.")
    else:
        # Add user message to state
        st.session_state.messages.append({"role": "user", "content": prompt})
        
        # Display the user message immediately
        with col_chat:
            with chat_container:
                with st.chat_message("user"):
                    st.markdown(prompt)
                
                with st.chat_message("assistant"):
                    with st.spinner("Gemini 3.1 Pro Preview is coding the game..."):
                        try:
                            os.environ["GEMINI_API_KEY"] = gemini_api_key
                            
                            # Initialize Agent
                            builder_agent = Agent(
                                model=Gemini(id="gemini-3.1-pro-preview"),
                                description="You are an expert game developer. You write complete, self-contained HTML files with embedded CSS and JS. Your code must be beautiful, functional, and include interactive elements.",
                                markdown=True
                            )
                            
                            # Construct conversation history for context
                            history = "\n".join([f"{m['role'].capitalize()}: {m['content']}" for m in st.session_state.messages])
                            # Adding the current HTML allows the agent to modify it
                            context = f"Current Game HTML (Iterate on this):\n```html\n{st.session_state.current_game_html}\n```" if st.session_state.current_game_html else "No game has been generated yet. Please create one from scratch based on the user's prompt."
                            
                            system_instruction = f"""
                            Conversation History:
                            {history}
                            
                            {context}
                            
                            Instructions:
                            Based on the user's latest request, generate or update the browser game. 
                            You MUST provide the full, runnable HTML file inside a single markdown code block (```html ... ```). 
                            Ensure the game runs perfectly in an iframe. Use inline scripting and styling. Ensure canvas focused scripts take key inputs seamlessly.
                            Include a brief conversational response answering the user before or after the code block explaining what you did.
                            """
                            
                            # Run the agent
                            response = builder_agent.run(system_instruction)
                            response_text = str(response.content)
                            
                            # Extract HTML block
                            html_code = ""
                            text_content = response_text.strip()
                            
                            # Standard markdown extraction
                            html_match = re.search(r"```(html|xml|javascript|js)?\s*(.*?)\s*```", text_content, re.DOTALL | re.IGNORECASE)
                            if html_match:
                                extracted = html_match.group(2).strip()
                                # Sometimes it outputs just JS
                                if html_match.group(1) in ["javascript", "js"] or not ("<html" in extracted.lower() or "<body" in extracted.lower() or "<canvas" in extracted.lower() or "<div" in extracted.lower()):
                                    html_code = f"<html><body><script>{extracted}</script></body></html>"
                                else:
                                    html_code = extracted
                            elif "<html" in text_content.lower() or "<body" in text_content.lower() or "<canvas" in text_content.lower():
                                # Fallback: No markdown ticks, just raw HTML/tags
                                html_code = text_content
                            
                            if html_code:
                                # Ensure it has basic HTML scaffolding if it's just raw tags 
                                if "<html" not in html_code.lower() and "<body" not in html_code.lower():
                                    html_code = f"<html><body>{html_code}</body></html>"
                                
                                st.session_state.current_game_html = html_code
                            else:
                                # Inject helpful debugging element instead of failing silently
                                st.error("Failed to parse game code. The AI returned:")
                                with st.expander("Raw AI Output"):
                                    st.code(text_content)
                                
                            # Clean the response text for the chat UI to avoid rendering huge code blocks
                            content_for_chat = re.sub(r"```(html|xml|javascript|css)?\s*.*?\s*```", "\n*(Game code updated and rendered on the right)*\n", response_text, flags=re.DOTALL | re.IGNORECASE)
                            
                            st.session_state.messages.append({"role": "assistant", "content": content_for_chat})
                            
                            # Rerun the app to refresh the iframe and chat properly
                            st.rerun()

                        except Exception as e:
                            st.error(f"Error: {e}")
                            st.info("Check your Gemini API key and internet connectivity.")
