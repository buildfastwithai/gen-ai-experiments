import os
from textwrap import dedent

import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = "z-ai/glm-5v-turbo"
BASE_URL = "https://openrouter.ai/api/v1/chat/completions"


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


st.set_page_config(
    page_title="URL to Code Studio",
    page_icon="🧩",
    layout="wide",
)

st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');

        :root {
            --bg-1: #09090b;
            --bg-2: #1f2937;
            --glass: rgba(255, 255, 255, 0.06);
            --text: #f5f5f4;
            --muted: #d6d3d1;
            --accent: #fb923c;
            --accent-2: #38bdf8;
            --line: rgba(255,255,255,0.2);
        }

    .stApp {
      background:
                radial-gradient(1300px 650px at 0% 0%, rgba(251, 146, 60, 0.25), transparent),
                radial-gradient(1100px 620px at 100% 100%, rgba(56, 189, 248, 0.22), transparent),
                repeating-linear-gradient(125deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 28px),
                linear-gradient(135deg, var(--bg-1), var(--bg-2));
      color: var(--text);
            font-family: 'Bricolage Grotesque', sans-serif;
    }

    .hero {
      background: var(--glass);
            border: 1px solid var(--line);
            border-radius: 24px;
            padding: 1.35rem 1.55rem;
            backdrop-filter: blur(10px) saturate(120%);
            margin-bottom: 1rem;
            box-shadow: 0 24px 50px rgba(0,0,0,0.28);
            animation: riseIn 580ms ease-out;
    }

    .hero h1 {
            font-size: 2.35rem;
      margin: 0;
            letter-spacing: 0.1px;
            line-height: 1.05;
    }

    .hero p {
      color: var(--muted);
            margin: 0.45rem 0 0;
            font-size: 1.03rem;
    }

        .hero .eyebrow {
            display: inline-block;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 0.76rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #fed7aa;
            border: 1px solid rgba(251,146,60,0.45);
            border-radius: 999px;
            padding: 0.18rem 0.58rem;
            margin-bottom: 0.45rem;
            background: rgba(251,146,60,0.12);
        }

    .code-block {
            background: rgba(12, 10, 9, 0.68);
            border: 1px solid rgba(251,146,60,0.28);
      border-radius: 14px;
      padding: 0.5rem;
    }

        .stTextInput input, .stTextArea textarea {
            border-radius: 12px !important;
            border: 1px solid rgba(255,255,255,0.28) !important;
            background: rgba(255,255,255,0.06) !important;
            color: var(--text) !important;
        }

        .stSelectbox [data-baseweb="select"] > div,
        .stMultiSelect [data-baseweb="select"] > div {
            border-radius: 12px !important;
            border: 1px solid rgba(255,255,255,0.28) !important;
            background: rgba(255,255,255,0.06) !important;
        }

        .stButton > button {
            border-radius: 999px !important;
            border: 1px solid rgba(255,255,255,0.26) !important;
            background: linear-gradient(90deg, #ea580c, #0284c7) !important;
            font-weight: 700 !important;
            letter-spacing: 0.02em;
            transition: transform 160ms ease, box-shadow 160ms ease;
        }

        .stButton > button:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 26px rgba(2,132,199,0.3);
        }

    @keyframes riseIn {
      from { transform: translateY(12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class='hero'>
            <span class='eyebrow'>Editorial Build Engine</span>
      <h1>Website URL ➜ Production UI Code</h1>
      <p>Paste any website URL and generate a complete, polished front-end implementation.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

left, right = st.columns([1, 1])

with left:
    target_url = st.text_input("Website URL", placeholder="https://example.com")
    tech_stack = st.selectbox(
        "Target stack",
        ["React + Tailwind", "Next.js + Tailwind", "Vanilla HTML/CSS/JS", "Vue + Tailwind"],
    )
    tone = st.selectbox(
        "Visual tone",
        ["Editorial & premium", "Playful & colorful", "Corporate & clean", "Futuristic landing page"],
    )
    include_pages = st.multiselect(
        "Generate sections",
        ["Hero", "Features", "Pricing", "Testimonials", "FAQ", "Footer"],
        default=["Hero", "Features", "Pricing", "Footer"],
    )

    col_a, col_b, col_c = st.columns(3)
    with col_a:
        temperature = st.slider("Creativity", 0.0, 1.0, 0.35, 0.05)
    with col_b:
        max_tokens = st.slider("Max tokens", 512, 8192, 2600, 128)
    with col_c:
        enable_thinking = st.toggle("Thinking", value=True)

    generate = st.button("Generate UI Code", type="primary", use_container_width=True)

with right:
    st.markdown("### Prompt Preview")
    preview = dedent(
        f"""
        Recreate the website from URL: {target_url or '[missing]'}
        Stack: {tech_stack}
        Tone: {tone}
        Sections: {', '.join(include_pages) if include_pages else 'Not specified'}

        Output requirements:
        - Return complete code only.
        - Keep responsive behavior for desktop and mobile.
        - Include semantic HTML and accessible labels.
        - Add subtle motion and polished visual details.
        """
    ).strip()
    st.code(preview, language="markdown")

if generate:
    if not target_url:
        st.error("Please provide a website URL.")
    else:
        with st.spinner("Generating code from URL..."):
            try:
                user_text = dedent(
                    f"""
                    Recreate the website from this URL: {target_url}

                    Technical requirements:
                    - Stack: {tech_stack}
                    - Visual tone: {tone}
                    - Must include sections: {', '.join(include_pages) if include_pages else 'Choose sensible default sections'}
                    - Responsive on mobile and desktop
                    - Use modern, readable component structure
                    - Return code only, no explanation
                    """
                ).strip()

                messages = [
                    {
                        "role": "system",
                        "content": "You are a senior front-end engineer and UI designer. Generate high-quality production code.",
                    },
                    {"role": "user", "content": user_text},
                ]

                output = call_glm(messages, temperature, max_tokens, enable_thinking)
                st.success("Code generated successfully.")
                st.markdown("### Generated Output")
                st.markdown("<div class='code-block'>", unsafe_allow_html=True)
                st.code(output, language="html")
                st.markdown("</div>", unsafe_allow_html=True)
            except Exception as exc:
                st.error(f"Request failed: {exc}")
