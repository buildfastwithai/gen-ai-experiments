import streamlit as st
from langchain_openai import ChatOpenAI
import os

# ========== Setup ==========

st.set_page_config(page_title="🎮 Qwen Game Generator", layout="centered")

st.sidebar.image("logo.png", use_container_width=True)
st.sidebar.header("⚙️ Configuration")
api_key = st.sidebar.text_input("Enter your OpenRouter API Key", type="password")
model_name = st.sidebar.selectbox("Model", ["qwen/qwen3-coder"], index=0)

st.sidebar.divider()
    
# About section
st.sidebar.markdown("### About Qwen3-Coder")
st.sidebar.markdown("Qwen3-Coder is a powerful, open-source AI model designed specifically for code generation and other software development tasks, released by Alibaba's Qwen team. It is their most advanced code model to date.")
st.sidebar.divider()
st.sidebar.markdown(
        "**❤️ Built by** [Build Fast with AI](https://buildfastwithai.com/genai-course)",
        unsafe_allow_html=True
    )   

@st.cache_resource(show_spinner=False)
def get_llm(api_key, model_name):
    return ChatOpenAI(
        model=model_name,
        openai_api_key=api_key,
        openai_api_base="https://openrouter.ai/api/v1"
    )

if "messages" not in st.session_state:
    st.session_state.messages = []  # memory for chat
if "game_code" not in st.session_state:
    st.session_state.game_code = ""

st.title("🎮 Game Generator using Qwen3")

if api_key:
    # ========== Chat UI ==========
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    user_input = st.chat_input("Describe your game or suggest an improvement...")

    if user_input:
        st.chat_message("user").markdown(user_input)
        st.session_state.messages.append({"role": "user", "content": user_input})

        # Check if it's the first prompt (game creation) or improvement
        is_game_creation = "<html" not in st.session_state.game_code.lower()

        # ========== Prompt Engineering ==========
        if is_game_creation:
            full_prompt = f"""
    You're an expert HTML5 game developer.

    Generate a visually appealing and playable HTML5 game based on the following idea.
    Requirements:
    - Canvas-based game
    - Retry button after losing
    - Entire game in one standalone HTML file
    - NO markdown (no triple backticks)

    Game idea: {user_input}
    """
        else:
            full_prompt = f"""
    Improve the following HTML5 game based on the user request.

    Request: "{user_input}"

    Only return a full, standalone HTML file (no explanations or markdown).

    Game code:
    {st.session_state.game_code}
    """

        with st.chat_message("assistant"):
            with st.spinner("🧠 Thinking... Generating your game..."):
                try:
                    llm = get_llm(api_key, model_name)
                    response = llm.invoke(full_prompt)
                    # response = client.chat.completions.create(
                    #     model="gpt-4o",
                    #     messages=[{"role": "user", "content": full_prompt}],
                    #     temperature=0.7,
                    # )
                    game_html = response.content.strip()

                    if "<html" not in game_html.lower():
                        st.error("❌ Invalid HTML received. Try rephrasing your request.")
                    else:
                        st.session_state.game_code = game_html
                        st.session_state.messages.append({
                            "role": "assistant",
                            "content": "✅ Game updated! See below 👇",
                        })
                        st.rerun()

                except Exception as e:
                    st.error(f"OpenAI API Error: {str(e)}")

    # ========== Show Game ==========
    if st.session_state.game_code:
        st.divider()
        st.subheader("🎮 Your Game")
        st.components.v1.html(st.session_state.game_code, height=600, scrolling=False)

        st.download_button(
            label="⬇️ Download Game HTML",
            data=st.session_state.game_code,
            file_name="ai_game.html",
            mime="text/html"
        )

else:
    st.error("Please enter your OpenRouter API Key in the sidebar to start generating games.")