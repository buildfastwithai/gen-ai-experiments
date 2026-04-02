import base64
import mimetypes
import os
from textwrap import dedent

import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = "z-ai/glm-5v-turbo"
BASE_URL = "https://openrouter.ai/api/v1/chat/completions"


def file_to_data_url(uploaded_file):
    file_bytes = uploaded_file.getvalue()
    mime = uploaded_file.type or mimetypes.guess_type(uploaded_file.name)[0] or "image/png"
    encoded = base64.b64encode(file_bytes).decode("utf-8")
    return f"data:{mime};base64,{encoded}"


def call_glm(messages, temperature, max_tokens, enable_thinking):
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is missing. Set it in your environment or .env file.")

    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
        "thinking": {"type": "enabled" if enable_thinking else "disabled"},
    }

    response = requests.post(
        BASE_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    return data.get("choices", [{}])[0].get("message", {}).get("content", "")


st.set_page_config(page_title="Wireframe to Code Lab", page_icon="🧪", layout="wide")

st.markdown(
    """
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

        :root {
            --ink: #ecfeff;
            --grid: rgba(153, 246, 228, 0.15);
            --line: rgba(153, 246, 228, 0.5);
            --accent: #14b8a6;
            --accent-2: #f59e0b;
        }

    .stApp {
      background:
                linear-gradient(rgba(153, 246, 228, 0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(153, 246, 228, 0.06) 1px, transparent 1px),
                radial-gradient(1000px 600px at 0% 0%, rgba(20,184,166,0.2), transparent),
                radial-gradient(1000px 600px at 100% 100%, rgba(245,158,11,0.16), transparent),
                linear-gradient(115deg, #042f2e, #0f172a);
            background-size: 28px 28px, 28px 28px, auto, auto, auto;
            color: var(--ink);
            font-family: 'Chakra Petch', sans-serif;
    }

    .panel {
            border-radius: 10px;
            border: 1px solid var(--line);
            background: linear-gradient(120deg, rgba(15,23,42,0.55), rgba(8,47,73,0.38));
            padding: 1.25rem;
            backdrop-filter: blur(6px) saturate(115%);
            box-shadow: 0 20px 44px rgba(0,0,0,0.35);
      animation: fadeSlide 520ms ease-out;
    }

    .headline {
            font-size: 2.25rem;
      margin: 0;
            font-weight: 700;
            letter-spacing: 0.02em;
    }

    .sub {
            color: #ccfbf1;
      margin-top: 0.4rem;
    }

        .stTextInput input, .stTextArea textarea {
            border-radius: 10px !important;
            border: 1px solid var(--line) !important;
            background: rgba(15,23,42,0.52) !important;
            color: var(--ink) !important;
        }

        .stSelectbox [data-baseweb="select"] > div,
        .stMultiSelect [data-baseweb="select"] > div {
            border-radius: 10px !important;
            border: 1px solid var(--line) !important;
            background: rgba(15,23,42,0.52) !important;
        }

        .stButton > button {
            border-radius: 8px !important;
            border: 1px solid rgba(20,184,166,0.8) !important;
            background: linear-gradient(90deg, rgba(20,184,166,0.32), rgba(245,158,11,0.28)) !important;
            color: #e6fffa !important;
            font-weight: 700 !important;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            transition: transform 140ms ease, box-shadow 140ms ease;
        }

        .stButton > button:hover {
            transform: translateY(-1px);
            box-shadow: 0 10px 24px rgba(20,184,166,0.28);
        }

    @keyframes fadeSlide {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class='panel'>
            <p style='font-family: IBM Plex Mono, monospace; font-size: 0.75rem; letter-spacing: 0.08em; margin: 0 0 0.45rem; color: #99f6e4;'>BLUEPRINT INTERPRETER</p>
      <p class='headline'>Wireframe ➜ Clean Front-End Code</p>
      <p class='sub'>Upload a low-fidelity sketch and get polished, responsive code with better visual hierarchy.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

left, right = st.columns([1.05, 0.95])

with left:
    wireframe = st.file_uploader("Upload wireframe", type=["png", "jpg", "jpeg", "webp"])
    target_stack = st.selectbox("Target stack", ["React + CSS Modules", "Next.js + Tailwind", "HTML/CSS/JS"])
    component_style = st.selectbox("Component style", ["Minimal cards", "Soft glassmorphism", "Bento grid", "SaaS dashboard"])
    instructions = st.text_area(
        "Extra instructions",
        placeholder="Example: Use a fixed top navbar and a 2-column feature section.",
        height=90,
    )

    c1, c2, c3 = st.columns(3)
    with c1:
        temperature = st.slider("Creativity", 0.0, 1.0, 0.3, 0.05)
    with c2:
        max_tokens = st.slider("Max tokens", 512, 8192, 2400, 128)
    with c3:
        enable_thinking = st.toggle("Thinking", value=True)

    run = st.button("Transform Wireframe", type="primary", use_container_width=True)

with right:
    st.markdown("### Conversion Notes")
    st.info(
        "This flow sends your uploaded wireframe image and instructions to GLM-5V-Turbo, then returns code only."
    )
    if wireframe:
        st.image(wireframe, caption="Uploaded Wireframe", use_container_width=True)

if run:
    if not wireframe:
        st.error("Please upload a wireframe image.")
    else:
        with st.spinner("Interpreting structure and generating code..."):
            try:
                image_data_url = file_to_data_url(wireframe)
                user_prompt = dedent(
                    f"""
                    Convert this wireframe into production-quality responsive code.
                    Stack: {target_stack}
                    Style direction: {component_style}
                    Additional instructions: {instructions or 'None'}

                    Requirements:
                    - Keep layout intent from wireframe
                    - Improve spacing, typography, and hierarchy
                    - Include mobile breakpoints
                    - Return code only
                    """
                ).strip()

                messages = [
                    {
                        "role": "system",
                        "content": "You are a senior UI engineer specializing in turning wireframes into clean front-end code.",
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": image_data_url}},
                            {"type": "text", "text": user_prompt},
                        ],
                    },
                ]

                output = call_glm(messages, temperature, max_tokens, enable_thinking)
                st.success("Wireframe converted successfully.")
                st.markdown("### Generated Output")
                st.code(output, language="html")
            except Exception as exc:
                st.error(f"Request failed: {exc}")
