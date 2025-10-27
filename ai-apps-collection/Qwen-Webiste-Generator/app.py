# app.py
import streamlit as st
from langchain_openai import ChatOpenAI
import os

# ========== Setup ==========

st.set_page_config(page_title="🌐 Website Generator (Cerebras)", layout="centered")

st.sidebar.header("⚙️ Configuration")

# Cerebras API key + models
api_key = st.sidebar.text_input("Enter your Cerebras API Key", type="password")
model_name = st.sidebar.selectbox(
    "Model",
    [
        # Solid production picks; adjust as you like
        "gpt-oss-120b",
        "qwen-3-32b",
        "llama-3.3-70b"
  
    ],
    index=0,
)

st.sidebar.divider()

# Website helper presets (optional, just to guide the LLM)
st.sidebar.subheader("Preset (optional)")
site_preset = st.sidebar.selectbox(
    "Website Type",
    [
        "Landing Page",
        "Personal Portfolio",
        "Startup Product Page",
        "Restaurant Page",
        "Event/Conference Page",
        "Simple Blog Home",
        "SaaS Marketing Page",
    ],
    index=0,
)
style_preset = st.sidebar.selectbox(
    "Style",
    [
        "Modern & Minimal",
        "Playful & Colorful",
        "Professional & Corporate",
        "Dark Theme",
        "Neumorphic",
        "Glassmorphism",
    ],
    index=0,
)

st.sidebar.divider()
st.sidebar.markdown(
    "**❤️ Built by** [Build Fast with AI](https://buildfastwithai.com/genai-course)",
    unsafe_allow_html=True,
)

@st.cache_resource(show_spinner=False)
def get_llm(api_key, model_name):
    # Cerebras exposes an OpenAI-compatible API, so we can keep ChatOpenAI
    # and just change the base URL.
    return ChatOpenAI(
        model=model_name,
        openai_api_key=api_key,
        openai_api_base="https://api.cerebras.ai/v1",
    )

# ========== Session State ==========
if "messages" not in st.session_state:
    st.session_state.messages = []  # memory for chat
if "site_code" not in st.session_state:
    st.session_state.site_code = ""

# ========== UI Header ==========
st.title("🌐 Website Generator using Cerebras")

# Small helper to build a starter brief from presets
def build_brief(user_idea: str, preset: str, style: str) -> str:
    base = f"Type: {preset}\nStyle: {style}\n\n"
    if user_idea.strip():
        base += f"Additional requirements from user:\n{user_idea.strip()}\n"
    return base

if api_key:
    # ========== Chat UI ==========
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    user_input = st.chat_input("Describe your website or suggest an improvement...")

    if user_input:
        # Show + store user message
        st.chat_message("user").markdown(user_input)
        st.session_state.messages.append({"role": "user", "content": user_input})

        # Check if it's the first prompt (site creation) or improvement
        is_site_creation = "<html" not in st.session_state.site_code.lower()

        # ========== Prompt Engineering ==========
        if is_site_creation:
            brief = build_brief(user_input, site_preset, style_preset)
            full_prompt = f"""
You are an expert front-end engineer and web designer.

Generate a **responsive**, **accessible**, and **visually modern** single-file website based on the brief below.

### HARD REQUIREMENTS
- Output a **complete, standalone HTML** document only (no markdown, no explanations, no backticks).
- Include all CSS in a `<style>` tag and any JS in a `<script>` tag (no external CDNs).
- Must include:
  - Semantic structure (e.g., `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`).
  - A hero section with a clear headline and CTA.
  - A responsive navbar with anchor links to sections.
  - A features/services section using cards.
  - A testimonials or social-proof section (dummy content is fine).
  - A contact/footer section with links and placeholders.
- Add subtle animations (CSS transitions) and hover states.
- Ensure good color contrast and mobile-first responsiveness (flex/grid).
- Add minimal inline JS only if needed for small interactions (e.g., mobile menu toggle).

### TONE & BRANDING
- Use the style and vibe from the brief (colors, typography hints).
- Use a tasteful, minimal color palette and system UI fonts (no external fonts).

### BRIEF
{brief}
"""
        else:
            full_prompt = f"""
Improve the following **single-file website** based on the user's request.

### HARD REQUIREMENTS
- Return a **complete, standalone HTML** document only (no explanations, no markdown).
- Keep CSS in `<style>` and any JS in `<script>` (no external CDNs).
- Preserve responsiveness, accessibility, and clean structure.
- Implement the user's requested changes comprehensively.

### USER REQUEST
{user_input}

### CURRENT SITE CODE
{st.session_state.site_code}
"""

        with st.chat_message("assistant"):
            with st.spinner("🧠 Thinking... Generating your website..."):
                try:
                    llm = get_llm(api_key, model_name)
                    response = llm.invoke(full_prompt)
                    site_html = response.content.strip()

                    if "<html" not in site_html.lower():
                        st.error("❌ Invalid HTML received. Try rephrasing your request.")
                    else:
                        st.session_state.site_code = site_html
                        st.session_state.messages.append(
                            {"role": "assistant", "content": "✅ Website updated! See below 👇"}
                        )
                        st.rerun()
                except Exception as e:
                    st.error(f"Cerebras API Error: {str(e)}")

    # ========== Show Website ==========
    if st.session_state.site_code:
        st.divider()
        st.subheader("🌐 Your Website")
        st.components.v1.html(st.session_state.site_code, height=900, scrolling=True)

        st.download_button(
            label="⬇️ Download Website HTML",
            data=st.session_state.site_code,
            file_name="ai_site.html",
            mime="text/html",
        )

else:
    st.error("Please enter your **Cerebras API Key** in the sidebar to start generating websites.")
