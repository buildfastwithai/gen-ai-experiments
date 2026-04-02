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


st.set_page_config(page_title="Image to Code Atelier", page_icon="🎨", layout="wide")

st.markdown(
    """
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        :root {
            --text: #fefce8;
            --muted: #fde68a;
            --line: rgba(254, 240, 138, 0.3);
            --accent: #fb7185;
            --accent-2: #22d3ee;
        }

    .stApp {
      background:
                radial-gradient(900px 520px at 8% 5%, rgba(251,113,133,0.3), transparent),
                radial-gradient(900px 520px at 90% 95%, rgba(34,211,238,0.24), transparent),
                radial-gradient(500px 280px at 50% 35%, rgba(250,204,21,0.12), transparent),
                linear-gradient(145deg, #1e1b4b, #0f172a 60%, #0c4a6e);
            color: var(--text);
            font-family: 'Plus Jakarta Sans', sans-serif;
    }

    .title-card {
            border: 1px solid var(--line);
            background: linear-gradient(120deg, rgba(15,23,42,0.58), rgba(49,46,129,0.3));
            border-radius: 24px;
            padding: 1.2rem 1.35rem;
      margin-bottom: 1rem;
            box-shadow: 0 22px 46px rgba(2,6,23,0.35);
      animation: glide 500ms ease-out;
    }

    .title-card h1 {
      margin: 0;
            font-size: 2.25rem;
      font-weight: 800;
            line-height: 1.04;
            font-family: 'Fraunces', serif;
    }

    .title-card p {
            margin: 0.42rem 0 0;
            color: var(--muted);
        }

        .title-card .tag {
            display: inline-block;
            border: 1px solid rgba(34,211,238,0.5);
            background: rgba(34,211,238,0.14);
            color: #cffafe;
            font-size: 0.76rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            border-radius: 999px;
            padding: 0.15rem 0.58rem;
            margin-bottom: 0.5rem;
        }

        .stTextInput input, .stTextArea textarea {
            border-radius: 12px !important;
            border: 1px solid var(--line) !important;
            background: rgba(15,23,42,0.46) !important;
            color: var(--text) !important;
        }

        .stSelectbox [data-baseweb="select"] > div,
        .stMultiSelect [data-baseweb="select"] > div {
            border-radius: 12px !important;
            border: 1px solid var(--line) !important;
            background: rgba(15,23,42,0.46) !important;
        }

        .stButton > button {
            border-radius: 999px !important;
            border: 1px solid rgba(255,255,255,0.32) !important;
            background: linear-gradient(90deg, var(--accent), var(--accent-2)) !important;
            color: #fff !important;
            font-weight: 700 !important;
            transition: transform 150ms ease, box-shadow 150ms ease;
        }

        .stButton > button:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 28px rgba(251,113,133,0.3);
    }

    @keyframes glide {
      from { opacity: 0; transform: translateX(-8px); }
      to { opacity: 1; transform: translateX(0); }
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class='title-card'>
            <span class='tag'>Art Direction Mode</span>
      <h1>Image Screenshot ➜ Pixel-Aware UI Code</h1>
      <p>Turn any design screenshot into reusable front-end implementation with responsive behavior.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

lcol, rcol = st.columns([1, 1])

with lcol:
    screenshot = st.file_uploader("Upload UI screenshot", type=["png", "jpg", "jpeg", "webp"])
    framework = st.selectbox("Framework", ["React + Tailwind", "HTML/CSS/JS", "Vue + Tailwind", "Svelte"])
    complexity = st.select_slider("Code detail", options=["Lean", "Balanced", "Very detailed"], value="Balanced")
    focus = st.multiselect(
        "Focus areas",
        ["Typography", "Spacing", "Color tokens", "Accessibility", "Animation", "Component reuse"],
        default=["Typography", "Spacing", "Accessibility", "Component reuse"],
    )
    notes = st.text_area("Designer notes", height=90, placeholder="Any custom interaction details...")

    b1, b2, b3 = st.columns(3)
    with b1:
        temperature = st.slider("Creativity", 0.0, 1.0, 0.25, 0.05)
    with b2:
        max_tokens = st.slider("Max tokens", 512, 8192, 3000, 128)
    with b3:
        enable_thinking = st.toggle("Thinking", value=True)

    generate = st.button("Generate from Image", type="primary", use_container_width=True)

with rcol:
    st.markdown("### Live Preview")
    if screenshot:
        st.image(screenshot, caption="Input Screenshot", use_container_width=True)
    else:
        st.warning("Upload an image to preview it here.")

if generate:
    if not screenshot:
        st.error("Please upload an image screenshot.")
    else:
        with st.spinner("Analyzing layout, hierarchy, and visual style..."):
            try:
                image_data_url = file_to_data_url(screenshot)

                prompt = dedent(
                    f"""
                    Convert this UI screenshot into front-end code.
                    Target framework: {framework}
                    Code detail level: {complexity}
                    Focus areas: {', '.join(focus) if focus else 'General fidelity'}
                    Notes: {notes or 'None'}

                    Return only code. Keep visual fidelity high and ensure responsive behavior.
                    """
                ).strip()

                messages = [
                    {
                        "role": "system",
                        "content": "You are an expert design-to-code engineer with strong visual fidelity and accessibility standards.",
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": image_data_url}},
                            {"type": "text", "text": prompt},
                        ],
                    },
                ]

                output = call_glm(messages, temperature, max_tokens, enable_thinking)
                st.success("Image converted successfully.")
                st.markdown("### Generated Output")
                st.code(output, language="html")
            except Exception as exc:
                st.error(f"Request failed: {exc}")
