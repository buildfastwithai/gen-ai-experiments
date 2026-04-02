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
    mime = uploaded_file.type or mimetypes.guess_type(uploaded_file.name)[0] or "video/mp4"
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
        timeout=240,
    )
    response.raise_for_status()
    data = response.json()
    return data.get("choices", [{}])[0].get("message", {}).get("content", "")


st.set_page_config(page_title="Video to Code Director", page_icon="🎬", layout="wide")

st.markdown(
    """
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Antonio:wght@400;600;700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');

        :root {
            --text: #f8fafc;
            --muted: #dbeafe;
            --line: rgba(191, 219, 254, 0.35);
            --accent: #0ea5e9;
            --accent-2: #f97316;
        }

    .stApp {
      background:
                radial-gradient(900px 520px at 0% 100%, rgba(14,165,233,0.28), transparent),
                radial-gradient(900px 520px at 100% 0%, rgba(249,115,22,0.22), transparent),
                linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px),
                linear-gradient(130deg, #020617, #172554 65%, #0c4a6e);
            background-size: auto, auto, 26px 26px, auto;
            color: var(--text);
            font-family: 'Hanken Grotesk', sans-serif;
    }

    .hero {
            border: 1px solid var(--line);
            border-radius: 24px;
            padding: 1.25rem 1.5rem;
            background: linear-gradient(120deg, rgba(2,6,23,0.64), rgba(30,58,138,0.32));
      backdrop-filter: blur(8px);
      margin-bottom: 1rem;
            box-shadow: 0 20px 44px rgba(0,0,0,0.35);
      animation: pulseIn 520ms ease-out;
    }

    .hero h1 {
      margin: 0;
            font-size: 2.45rem;
            font-family: 'Antonio', sans-serif;
            font-weight: 700;
            letter-spacing: 0.03em;
    }

    .hero p {
            margin: 0.42rem 0 0;
            color: var(--muted);
        }

        .hero .chip {
            display: inline-block;
            border: 1px solid rgba(14,165,233,0.65);
            background: rgba(14,165,233,0.18);
            border-radius: 999px;
            font-size: 0.76rem;
            letter-spacing: 0.07em;
            text-transform: uppercase;
            font-weight: 700;
            padding: 0.15rem 0.58rem;
            margin-bottom: 0.48rem;
            color: #dbeafe;
        }

        .stTextInput input, .stTextArea textarea {
            border-radius: 12px !important;
            border: 1px solid var(--line) !important;
            background: rgba(2,6,23,0.48) !important;
            color: var(--text) !important;
        }

        .stSelectbox [data-baseweb="select"] > div,
        .stMultiSelect [data-baseweb="select"] > div {
            border-radius: 12px !important;
            border: 1px solid var(--line) !important;
            background: rgba(2,6,23,0.48) !important;
        }

        .stButton > button {
            border-radius: 10px !important;
            border: 1px solid rgba(148,163,184,0.5) !important;
            background: linear-gradient(90deg, var(--accent), var(--accent-2)) !important;
            color: #f8fafc !important;
            font-weight: 700 !important;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            transition: transform 150ms ease, box-shadow 150ms ease;
        }

        .stButton > button:hover {
            transform: translateY(-1px);
            box-shadow: 0 14px 30px rgba(14,165,233,0.3);
    }

    @keyframes pulseIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class='hero'>
            <span class='chip'>Cinematic Flow Engine</span>
      <h1>Video Demo ➜ Interactive UI Code</h1>
      <p>Upload a product/video walkthrough and generate a web UI that reflects flows and screen states.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

left, right = st.columns([1.1, 0.9])

with left:
    uploaded_video = st.file_uploader("Upload UI video", type=["mp4", "mov", "webm", "mkv"])
    video_url = st.text_input("Or video URL", placeholder="https://example.com/demo.mp4")

    stack = st.selectbox("Output stack", ["React + Tailwind", "Next.js + Tailwind", "HTML/CSS/JS"])
    output_mode = st.selectbox(
        "What to generate",
        [
            "Single-page recreation",
            "Multi-section website based on key scenes",
            "Component library inferred from video",
        ],
    )
    interaction_level = st.select_slider(
        "Interaction fidelity",
        options=["Basic", "Moderate", "Advanced"],
        value="Moderate",
    )

    extra_notes = st.text_area("Extra constraints", height=90, placeholder="Example: Include sticky nav + animated cards.")

    c1, c2, c3 = st.columns(3)
    with c1:
        temperature = st.slider("Creativity", 0.0, 1.0, 0.35, 0.05)
    with c2:
        max_tokens = st.slider("Max tokens", 512, 8192, 3200, 128)
    with c3:
        enable_thinking = st.toggle("Thinking", value=True)

    run = st.button("Generate from Video", type="primary", use_container_width=True)

with right:
    st.markdown("### Input Status")
    if uploaded_video:
        st.video(uploaded_video)
        st.success("Video file attached.")
    elif video_url:
        st.info("Video URL provided.")
    else:
        st.warning("Provide either a video file or URL.")

if run:
    if not uploaded_video and not video_url:
        st.error("Please upload a video file or provide a video URL.")
    else:
        with st.spinner("Extracting visual flow and building code..."):
            try:
                content_parts = []

                if uploaded_video:
                    content_parts.append(
                        {"type": "video_url", "video_url": {"url": file_to_data_url(uploaded_video)}}
                    )
                elif video_url:
                    content_parts.append({"type": "video_url", "video_url": {"url": video_url}})

                prompt = dedent(
                    f"""
                    Convert this UI video into front-end code.
                    Stack: {stack}
                    Output mode: {output_mode}
                    Interaction fidelity: {interaction_level}
                    Additional notes: {extra_notes or 'None'}

                    Requirements:
                    - infer major screen states/components from the video
                    - ensure responsive design
                    - return code only
                    """
                ).strip()

                content_parts.append({"type": "text", "text": prompt})

                messages = [
                    {
                        "role": "system",
                        "content": "You are a senior multimodal front-end engineer converting videos into robust UI code.",
                    },
                    {"role": "user", "content": content_parts},
                ]

                output = call_glm(messages, temperature, max_tokens, enable_thinking)
                st.success("Video converted successfully.")
                st.markdown("### Generated Output")
                st.code(output, language="html")
            except Exception as exc:
                st.error(f"Request failed: {exc}")
