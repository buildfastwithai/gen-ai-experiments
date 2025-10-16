import os
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, Tuple, Dict, Any

import streamlit as st


# UI helpers
def set_page_config() -> None:
    st.set_page_config(page_title="Cerebras vs OpenAI – Comparator", page_icon="⚖️", layout="wide")

with st.sidebar:
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

def inject_styles() -> None:
    st.markdown(
        """
        <style>
        :root { color-scheme: light dark; }
        .app-title { font-weight: 800; font-size: 1.6rem; margin-bottom: 0.75rem; }
        .subtle { opacity: 0.8; }
        .card { border-radius: 14px; padding: 16px 18px; border: 1px solid rgba(127,127,127,0.25);
                box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06); color: inherit; }
        .metric-card { }
        .model-pill { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 0.78rem;
                      border: 1px solid rgba(127,127,127,0.25); background: transparent; color: inherit; }
        .gradient-winner { font-weight: 800; background: linear-gradient(90deg,#8B5CF6,#3B82F6);
                           -webkit-background-clip: text; background-clip: text; color: transparent; }
        .latency { font-weight: 700; }
        .cost { font-weight: 700; }
        .mono { font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; }

        /* Theme-aware card backgrounds */
        @media (prefers-color-scheme: light) {
          .cerebras-card { background: #E6F0FF; }
          .openai-card { background: #EFE6FF; }
          .metric-card { background: #F5F7FB; }
        }
        @media (prefers-color-scheme: dark) {
          .cerebras-card { background: #0F1B2E; }
          .openai-card { background: #1A1430; }
          .metric-card { background: #111827; }
        }

        .error-text { color: #ef4444; }
        </style>
        """,
        unsafe_allow_html=True,
    )


# Inference helpers
def call_cerebras(prompt: str, model: str) -> Tuple[Optional[str], float, Optional[str]]:
    start_time = time.time()
    try:
        # Lazy import to avoid import errors when package is missing
        from cerebras.cloud.sdk import Cerebras  # type: ignore

        client = Cerebras(api_key=os.environ.get("CEREBRAS_API_KEY"))
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=model,
        )
        latency = time.time() - start_time
        # SDK response structure per plan.md
        content = response.choices[0].message.content
        return content, latency, None
    except Exception as exc:  # noqa: BLE001
        latency = time.time() - start_time
        return None, latency, f"Cerebras error: {exc}"


def call_openai(prompt: str, model: str) -> Tuple[Optional[str], float, Optional[str]]:
    start_time = time.time()
    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
        )
        latency = time.time() - start_time
        content = response.choices[0].message.content
        return content, latency, None
    except Exception as exc:  # noqa: BLE001
        latency = time.time() - start_time
        return None, latency, f"OpenAI error: {exc}"


async def run_concurrently(prompt: str, cerebras_model: str, openai_model: str) -> Dict[str, Any]:
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=2) as executor:
        fut_cerebras = loop.run_in_executor(executor, call_cerebras, prompt, cerebras_model)
        fut_openai = loop.run_in_executor(executor, call_openai, prompt, openai_model)
        cerebras_result, openai_result = await asyncio.gather(fut_cerebras, fut_openai)
    return {
        "cerebras": {
            "content": cerebras_result[0],
            "latency": cerebras_result[1],
            "error": cerebras_result[2],
        },
        "openai": {
            "content": openai_result[0],
            "latency": openai_result[1],
            "error": openai_result[2],
        },
    }


def format_seconds(seconds: float) -> str:
    return f"{seconds:.2f}s"


def estimate_cost(tokens: Optional[int], provider: str) -> Optional[float]:
    if tokens is None:
        return None
    if provider == "openai":
        return tokens * 0.002 / 1000
    if provider == "cerebras":
        return tokens * 0.001 / 1000
    return None


def safe_async_run(coro: asyncio.coroutines) -> Any:  # type: ignore[valid-type]
    try:
        return asyncio.run(coro)
    except RuntimeError:
        # Fallback if an event loop is already running
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


def main() -> None:
    set_page_config()
    inject_styles()

    st.title('⚖️ Cerebras vs OpenAI Comparator')
    st.write(
        "Compare model responses, latency, and cost side-by-side."
    )
    with st.expander("About This App"):
        st.markdown(
            "- Get your [Cerebras](https://chat.cerebras.ai/) and [OpenAI API](https://platform.openai.com/api-keys) Key\n"
            "- Enter Your prompt and get evaulation on time and speed metrics\n"
            "- The Cost is estimation generated on Cost per token"
        )
        

    # Sidebar inputs
    with st.sidebar:
        st.markdown("### Settings")
        cerebras_api_key = st.text_input("Cerebras API Key", type="password", help="Will be used only for this session")
        openai_api_key = st.text_input("OpenAI API Key", type="password", help="Will be used only for this session")

        cerebras_model = st.selectbox(
            "Cerebras model",
            options=[
                "llama-4-scout-17b-16e-instruct",
                "llama-3.3-70b-instruct",
                "llama-3.1-8b-instruct",
            ],
            index=0,
        )
        openai_model = st.selectbox(
            "OpenAI model",
            options=[
                "gpt-4o-mini",
                "gpt-4o",
                "gpt-4o-mini-translate",
            ],
            index=0,
        )

    # Initialize session state
    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []  # list[dict]

    # Renderer for a single turn
    def render_turn(turn: Dict[str, Any]) -> None:
        st.chat_message("user").markdown(turn["prompt"])  
        bot = st.chat_message("assistant")
        with bot:
            # Two response cards
            col_left, col_right = st.columns(2)
            with col_left:
                st.markdown(
                    f"<div class='card cerebras-card'>"
                    f"<div class='model-pill mono'>🧠 Cerebras · {turn['cerebras']['model']}</div>"
                    f"<div style='height:8px'></div>"
                    f"<div class='subtle'>Latency: <span class='latency'>{format_seconds(turn['cerebras']['latency'])}</span></div>"
                    f"</div>",
                    unsafe_allow_html=True,
                )
                if turn["cerebras"]["content"]:
                    st.markdown(turn["cerebras"]["content"])  
                if turn["cerebras"]["error"]:
                    st.markdown(f"<span class='error-text'>{turn['cerebras']['error']}</span>", unsafe_allow_html=True)

            with col_right:
                st.markdown(
                    f"<div class='card openai-card'>"
                    f"<div class='model-pill mono'>⚡ OpenAI · {turn['openai']['model']}</div>"
                    f"<div style='height:8px'></div>"
                    f"<div class='subtle'>Latency: <span class='latency'>{format_seconds(turn['openai']['latency'])}</span></div>"
                    f"</div>",
                    unsafe_allow_html=True,
                )
                if turn["openai"]["content"]:
                    st.markdown(turn["openai"]["content"])  
                if turn["openai"]["error"]:
                    st.markdown(f"<span class='error-text'>{turn['openai']['error']}</span>", unsafe_allow_html=True)

            # Summary card
            st.markdown(
                f"<div class='card metric-card'>"
                f"<div class='mono'>{turn['summary']['lat_line']}</div>"
                f"<div style='height:6px'></div>"
                f"<div class='mono'>{turn['summary']['cost_line']}</div>"
                f"<div style='height:6px'></div>"
                f"<div class='mono'>{turn['summary']['winner_line']}</div>"
                f"</div>",
                unsafe_allow_html=True,
            )
        st.divider()

    # Render full history first (so users can scroll)
    for t in st.session_state.chat_history:
        render_turn(t)

    # Chat input
    user_prompt = st.chat_input("Type your message…")
    if user_prompt is not None and user_prompt.strip():
        if not cerebras_api_key or not openai_api_key:
            st.warning("Please provide both API keys in the sidebar.")
            return

        # Set environment variables for SDKs
        os.environ["CEREBRAS_API_KEY"] = cerebras_api_key
        os.environ["OPENAI_API_KEY"] = openai_api_key

        with st.chat_message("assistant"):
            st.info("Running both inferences concurrently…")

        results = safe_async_run(run_concurrently(user_prompt, cerebras_model, openai_model))

        # Costs (N/A by default) – you can replace token estimation with real usage when available
        tokens_estimate: Optional[int] = None
        cost_cerebras = estimate_cost(tokens_estimate, "cerebras")
        cost_openai = estimate_cost(tokens_estimate, "openai")

        # Winner logic
        winner_reason = None
        winner_name = None
        if results["cerebras"]["latency"] < results["openai"]["latency"]:
            winner_name = "Cerebras"
            winner_reason = "Faster"
        elif results["cerebras"]["latency"] > results["openai"]["latency"]:
            winner_name = "OpenAI"
            winner_reason = "Faster"

        if cost_cerebras is not None and cost_openai is not None:
            if cost_cerebras < cost_openai:
                winner_name = "Cerebras"
                winner_reason = "Cheaper"
            elif cost_cerebras > cost_openai:
                winner_name = "OpenAI"
                winner_reason = "Cheaper"

        lat_line = (
            f"⚡ Latency — Cerebras: {format_seconds(results['cerebras']['latency'])} | "
            f"OpenAI: {format_seconds(results['openai']['latency'])}"
        )
        cost_line = (
            f"💸 Cost — Cerebras: {('$' + format(cost_cerebras, '.4f')) if cost_cerebras is not None else 'N/A'} | "
            f"OpenAI: {('$' + format(cost_openai, '.4f')) if cost_openai is not None else 'N/A'}"
        )
        winner_line = (
            f"🏆 Winner: <span class='gradient-winner'>{winner_name}</span> ({winner_reason})"
            if winner_name and winner_reason
            else "🏆 Winner: N/A"
        )

        # Append to history
        turn: Dict[str, Any] = {
            "prompt": user_prompt,
            "cerebras": {
                "model": cerebras_model,
                "content": results["cerebras"]["content"],
                "latency": results["cerebras"]["latency"],
                "error": results["cerebras"]["error"],
            },
            "openai": {
                "model": openai_model,
                "content": results["openai"]["content"],
                "latency": results["openai"]["latency"],
                "error": results["openai"]["error"],
            },
            "summary": {
                "lat_line": lat_line,
                "cost_line": cost_line,
                "winner_line": winner_line,
            },
        }
        st.session_state.chat_history.append(turn)

        # Render the new turn
        render_turn(turn)


if __name__ == "__main__":
    main()


