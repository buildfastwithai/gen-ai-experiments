import streamlit as st
import os
import re
import json
import streamlit.components.v1 as components
from openai import OpenAI
from textwrap import dedent

# ---------- Streamlit UI ----------
st.set_page_config(page_title="Check Similarity ", page_icon="⭕", layout="wide")

with st.sidebar:
    st.title("🤖 Analyze Similarity")
    st.sidebar.caption("Powered by New GLM 4.6")

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

    openrouter_api_key = st.text_input(
        "OpenRouter API Key",
        type="password",
        placeholder="sk-or-v1-...",
        help="Your key is only used locally to call the model.",
    )
    os.environ['OPENROUTER_API_KEY'] = openrouter_api_key


st.sidebar.markdown(
        dedent(
            """
            **How to use**
            - Enter two random things (e.g., "cats" and "blockchain").
            - Paste your OpenRouter API key.
            - Click Generate. We'll fill in what they share in common.

            **Why it's viral**
            - Fun, weird connections.
            - Shareable visuals.
            - Infinite prompts.

            **Tips**
            - Try opposite domains.
            - Add niche hobbies or trends.
            - Keep inputs short for punchier results.
            """
        )
    )


# ---------- Helper: extract JSON ----------
def extract_json_from_text(text: str) -> str | None:
    text = re.sub(r"```json\s*", "```", text, flags=re.IGNORECASE)
    text = re.sub(r"```[^\n]*\n", "", text)
    text = text.replace("```", "")
    start = text.find("{")
    if start == -1:
        return None
    stack = []
    for i in range(start, len(text)):
        ch = text[i]
        if ch == "{":
            stack.append("{")
        elif ch == "}":
            if stack:
                stack.pop()
                if not stack:
                    return text[start:i+1]
    return None

# ---------- HTML template ----------
def build_venn_html(data: dict, title1: str, title2: str) -> str:
    c1_list = data.get("concept1") or []
    c2_list = data.get("concept2") or []
    inter = data.get("similarity") or data.get("intersection") or data.get("fun_weird") or []

    if isinstance(c1_list, str):
        c1_list = [s.strip() for s in re.split(r"\n|;|-", c1_list) if s.strip()]
    if isinstance(c2_list, str):
        c2_list = [s.strip() for s in re.split(r"\n|;|-", c2_list) if s.strip()]
    if isinstance(inter, str):
        inter = [s.strip() for s in re.split(r"\n|;|-", inter) if s.strip()]

    c1_list, c2_list = c1_list[:3], c2_list[:3]

    html = f"""
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * {{ box-sizing: border-box; font-family: Inter, sans-serif; }}
        body {{
          margin: 0;
          padding: 24px;
          background: rgb(14,17,23);
          color: #f8fafc;
        }}
        h1 {{ font-size: 20px; margin: 0 0 20px; color:#e2e8f0; }}
        .diagram {{
          position: relative;
          width: 640px;
          height: 360px;
          margin: 0 auto;
        }}
        .circle {{
          position: absolute;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 22px;
          transition: all 0.25s ease;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          font-size: 14px;
          line-height: 1.4;
          z-index: 1;
        }}
        .circle:hover {{
          z-index: 5;
          transform: scale(1.05);
        }}
        .left {{
          left: 0;
          top: 20px;
          background: linear-gradient(180deg,#ffadc8,#ff80a5);
          color:#1e0b15;
        }}
        .right {{
          right: 0;
          top: 20px;
          background: linear-gradient(180deg,#7dc4ff,#559dff);
          color:#0b1321;
        }}
        .center {{
          position: absolute;
          left: calc(50% - 140px);
          top: 40px;
          width: 280px;
          height: 280px;
          border-radius: 50%;
          background: linear-gradient(180deg,#fcd68a,#f7b84b);
          color:#1a1002;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:18px;
          text-align:center;
          transition: all 0.25s ease;
          z-index: 2;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }}
        .center:hover {{
          z-index: 6;
          transform: scale(1.07);
        }}
        ul.points {{
          margin: 0; padding: 0; list-style: none;
        }}
        ul.points li {{
          padding: 6px 0;
          font-size: 13px;
        }}
        .title {{ font-weight: 700; margin-bottom: 8px; font-size: 15px; }}
      </style>
    </head>
    <body>
      <h1>Connections: {title1} &amp; {title2}</h1>
      <div class="diagram">
        <div class="circle left">
          <div>
            <div class="title">{title1}</div>
            <ul class="points">
              {''.join(f'<li>{pt}</li>' for pt in c1_list)}
            </ul>
          </div>
        </div>
        <div class="circle right">
          <div>
            <div class="title">{title2}</div>
            <ul class="points">
              {''.join(f'<li>{pt}</li>' for pt in c2_list)}
            </ul>
          </div>
        </div>
        <div class="center">
          <div>
            <div class="title">Fun, Weird Connections</div>
            {"<ul class='points'>" + ''.join(f'<li>{it}</li>' for it in inter) + "</ul>" if inter else "<div>No obvious similarities — but that’s the fun!</div>"}
          </div>
        </div>
      </div>
    </body>
    </html>
    """
    return html

st.title("🤯 What Do They Have in Common?")
st.write("Type any two random things—cats & blockchain, pizza & AI—and watch the AI uncover fun, weird, and totally unexpected connections in a Venn diagram!")
st.subheader("Enter two concepts and click Generate")

col1, col2 = st.columns(2)
with col1:
    concept1 = st.text_input("First concept", value=st.session_state.get("concept1", "cats"))
with col2:
    concept2 = st.text_input("Second concept", value=st.session_state.get("concept2", "blockchain"))

def clean_json_text(text: str) -> str:
    # Remove code fences like ```json ... ```
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

# ---------- Main ----------
if st.button("🔄 Generate Venn Diagram", use_container_width=True):
    if not openrouter_api_key:
        st.error("Please enter your OpenRouter API key in the sidebar.")
    else:
        with st.spinner(f"Requesting JSON for '{concept1}' and '{concept2}'..."):
            try:
                client = OpenAI(api_key=openrouter_api_key, base_url="https://openrouter.ai/api/v1")
                json_prompt = f"""
                    You are an AI that creates **fun and weird connections** between any two concepts.

                    ⚡ Requirements:
                    1. Output **ONLY valid JSON** — no extra text, explanations, or markdown.
                    2. JSON format must be exactly:
                    {{
                    "concept1": ["point1","point2","point3"],
                    "concept2": ["point1","point2","point3"],
                    "similarity": ["shared1","shared2","shared3"]
                    }}
                    3. For each concept, list **three quirky or interesting points or sentences** describing it.(but keep it concise, each sentence can be 4-5 worrds maximum)
                    4. For similarity, list **three fun or weird things both concepts share** (can be surprising or counter-intuitive).

                    Now generate the JSON for:
                    concept1: "{concept1}"
                    concept2: "{concept2}"

                    Keep it creative, funny, and engaging!
                    """
                response = client.chat.completions.create(
                    model="moonshotai/kimi-k2:free",
                    messages=[{"role": "user", "content": json_prompt}],
                    temperature=0.3,
                    max_tokens=500
                )

                raw_text = response.choices[0].message.content or ""
                json_text = extract_json_from_text(raw_text) or raw_text.strip()
                json_text = clean_json_text(json_text)

                # Debug output in expandable
                # with st.expander("🔍 Debug: Raw LLM Output"):
                #     st.code(raw_text, language="json")

                try:
                    parsed = json.loads(json_text)
                except json.JSONDecodeError as e:
                    st.error(f"❌ JSON parse error: {e}")
                    st.write("Raw JSON string received:")
                    st.code(json_text)
                    st.stop()

                html = build_venn_html(parsed, concept1, concept2)
                components.html(html, height=600, scrolling=False)

            except Exception as exc:
                st.error(f"Error: {exc}")

# Example buttons
st.divider()
st.write("**💡 Try these examples:**")
examples = [
    ("cats", "blockchain"),
    ("music", "maths"),
    ("pizza", "GenAI"),
    ("plants", "computers"),
    ("chocolate", "time travel"),
]
cols = st.columns(len(examples))
for i, (ex1, ex2) in enumerate(examples):
    with cols[i]:
        if st.button(f"{ex1} & {ex2}", key=f"example_{i}"):
            st.session_state.concept1 = ex1
            st.session_state.concept2 = ex2
            st.rerun()


