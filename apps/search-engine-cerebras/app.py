import os
import json
from typing import List, Dict, Any

import streamlit as st
from html import escape

# Optional Agno/Cerebras summarizer
try:
    from agno.agent import Agent
    from agno.models.cerebras import Cerebras
    AGNO_AVAILABLE = True
except Exception:
    AGNO_AVAILABLE = False

# Serper tools (from agno) for search convenience
try:
    from agno.tools.serper import SerperTools
    SERPER_TOOL_AVAILABLE = True
except Exception:
    SERPER_TOOL_AVAILABLE = False


def init_session_state() -> None:
    if "messages" not in st.session_state:
        st.session_state.messages = []  # List[Dict[str, Any]] with {role, content, links}
    if "serper_location" not in st.session_state:
        st.session_state.serper_location = "us"
    if "serper_num" not in st.session_state:
        st.session_state.serper_num = 10

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
        .model-pill { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 0.78rem;
                      border: 1px solid rgba(127,127,127,0.25); background: transparent; color: inherit; }
        .gradient-winner { font-weight: 800; background: linear-gradient(90deg,#8B5CF6,#3B82F6);
                           -webkit-background-clip: text; background-clip: text; color: transparent; }
        .latency { font-weight: 700; }
        .mono { font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; }

        @media (prefers-color-scheme: light) {
          .cerebras-card { background: #E6F0FF; }
          .metric-card { background: #F5F7FB; }
        }
        @media (prefers-color-scheme: dark) {
          .cerebras-card { background: #0F1B2E; }
          .metric-card { background: #111827; }
        }

        .error-text { color: #ef4444; }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_sidebar() -> Dict[str, Any]:
    with st.sidebar:
        st.title("Search Settings")

        serper_api_key = st.text_input(
            "Serper API Key",
            type="password",
            help="Get one from serper.dev and paste here.",
            value=os.environ.get("SERPER_API_KEY", ""),
        )

        cerebras_api_key = st.text_input(
            "Cerebras API Key",
            type="password",
            help="Cerebras Inference API key (for summarization)",
            value=os.environ.get("CEREBRAS_API_KEY", ""),
        )

        model_id = st.text_input(
            "Cerebras Model ID",
            value=os.environ.get("CEREBRAS_MODEL_ID", "llama-4-scout-17b-16e-instruct"),
            help="Model used for summarization via Cerebras",
        )

        st.session_state.serper_location = st.selectbox(
            "Search Location (gl)",
            ["us", "uk", "in", "ca", "au", "de", "fr", "jp"],
            index=["us", "uk", "in", "ca", "au", "de", "fr", "jp"].index(
                st.session_state.serper_location
            )
            if st.session_state.serper_location in ["us", "uk", "in", "ca", "au", "de", "fr", "jp"]
            else 0,
        )

        st.session_state.serper_num = st.slider(
            "Number of results",
            min_value=5,
            max_value=10,
            value=min(max(st.session_state.serper_num, 5), 10),
            step=1,
        )

        # Persist keys to env for libraries expecting env vars
        if serper_api_key:
            os.environ["SERPER_API_KEY"] = serper_api_key
        if cerebras_api_key:
            os.environ["CEREBRAS_API_KEY"] = cerebras_api_key
        if model_id:
            os.environ["CEREBRAS_MODEL_ID"] = model_id

        return {
            "serper_api_key": serper_api_key,
            "cerebras_api_key": cerebras_api_key,
            "model_id": model_id,
        }


def make_serper_tool(api_key: str, location: str, num_results: int):
    if SERPER_TOOL_AVAILABLE:
        return SerperTools(api_key=api_key, location=location, num_results=num_results)
    return None


def parse_serper_response(raw: str, limit: int) -> List[Dict[str, str]]:
    try:
        data = json.loads(raw)
    except Exception:
        return []

    results = []
    # Typical Serper response has `organic` entries
    for item in data.get("organic", [])[:limit]:
        results.append(
            {
                "title": item.get("title", ""),
                "snippet": item.get("snippet", ""),
                "url": item.get("link", item.get("url", "")),
                "source": item.get("source", ""),
            }
        )
    return results


def summarize_with_cerebras(model_id: str, cerebras_api_key: str, query: str, results: List[Dict[str, str]]) -> str:
    # Build a compact input for the summarizer
    bullets = []
    for r in results:
        title = r.get("title", "")
        snippet = r.get("snippet", "")
        url = r.get("url", "")
        bullets.append(f"- {title}: {snippet} (source: {url})")
    context_block = "\n".join(bullets)

    prompt = (
        "You are a helpful research assistant. Given the user query and web results, "
        "produce a crisp, well-structured summary (1 short paragraphs no heading etc) with key insights, "
        "and important information about the search user may need to know, Avoid redundancy.\n\n"
        f"Query: {query}\n\n"
        f"Results:\n{context_block}\n\n"
        "Write the summary now."
    )

    if not AGNO_AVAILABLE or not cerebras_api_key:
        # Fallback: simple synthesis without LLM
        return (
            "Summary (fallback):\n" +
            ("\n".join([f"- {r.get('title','')}: {r.get('snippet','')}" for r in results[:5]]))
        )

    try:
        agent = Agent(model=Cerebras(id=model_id))
        # Use .run and normalize response to a plain string
        resp = agent.run(prompt)
        text = getattr(resp, "content", None)
        if isinstance(text, (list, tuple)):
            text = "\n".join([str(x) for x in text])
        if text is None:
            text = str(resp)
        elif not isinstance(text, str):
            text = str(text)
        text = "Here's a crisp summary of the search results:\n"+text
        return text
    except Exception:
        return (
            "Summary (fallback due to model error):\n\n" +
            ("\n".join([f"- {r.get('title','')}: {r.get('snippet','')}" for r in results[:5]]))
        )


def search(query: str, serper_api_key: str, location: str, num_results: int) -> List[Dict[str, str]]:
    tool = make_serper_tool(serper_api_key, location, num_results)
    if tool is None:
        # Minimal client via requests if toolkit unavailable
        import requests

        headers = {
            "X-API-KEY": serper_api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "q": query,
            "gl": location,
            "num": num_results,
        }
        try:
            resp = requests.post("https://google.serper.dev/search", headers=headers, data=json.dumps(payload))
            resp.raise_for_status()
            raw = resp.text
        except Exception:
            return []
    else:
        # Support both Agno variants:
        # - Older/custom variant: search_web(query, num_results)
        # - Current packaged variant: search_google(query, location=None)
        if hasattr(tool, "search_web"):
            raw = tool.search_web(query, num_results)
        elif hasattr(tool, "search_google"):
            raw = tool.search_google(query, location)
        else:
            return []

    return parse_serper_response(raw, num_results)


def render_message(msg: Dict[str, Any]) -> None:
    role = msg.get("role")
    content = msg.get("content", "")
    links: List[Dict[str, str]] = msg.get("links", [])
    with st.chat_message(role):
        if role == "assistant":
            # Render pretty summary card
            model_id = os.environ.get("CEREBRAS_MODEL_ID", "Cerebras")
            # Ensure string before HTML escaping to avoid attribute errors
            text_content = content if isinstance(content, str) else str(content)
            safe_html = escape(text_content).replace("\n", "<br>")
            st.markdown(
                f"<div class='card cerebras-card'>"
                f"<div class='model-pill mono'>🧠 Cerebras · {escape(model_id)}</div>"
                f"<div style='height:8px'></div>"
                f"<div>{safe_html}</div>"
                f"</div>",
                unsafe_allow_html=True,
            )
        else:
            st.markdown(content)
        if role == "assistant" and links:
            st.markdown("---")
            st.markdown("**Related links**")
            for r in links:
                title = r.get("title", "Untitled")
                snippet = r.get("snippet", "")
                url = r.get("url", "")
                source = r.get("source", "")
                st.markdown(f"- [{title}]({url})  ")
                if snippet:
                    st.markdown(f"  {snippet}")
                if source:
                    st.caption(source)


def main() -> None:
    st.set_page_config(page_title="Conversational Search (Serper + Cerebras)", page_icon="🔎", layout="wide")
    init_session_state()
    inject_styles()
    keys = render_sidebar()

    st.title("🔎 Conversational Search")
    st.caption("Serper-powered search with Cerebras summarization")

    # Render history
    for msg in st.session_state.messages:
        render_message(msg)

    prompt = st.chat_input("Ask anything to search the web…")
    if prompt:
        # Show user message immediately
        st.session_state.messages.append({"role": "user", "content": prompt})
        render_message(st.session_state.messages[-1])

        # Execute search
        results = []
        if not keys.get("serper_api_key"):
            assistant_text = (
                "Please add your Serper API key in the sidebar to run web searches."
            )
        else:
            results = search(
                prompt,
                keys.get("serper_api_key", ""),
                st.session_state.serper_location,
                st.session_state.serper_num,
            )
            if not results:
                assistant_text = "No results found or there was an error contacting Serper."
            else:
                assistant_text = summarize_with_cerebras(
                    keys.get("model_id", "llama-4-scout-17b-16e-instruct"),
                    keys.get("cerebras_api_key", ""),
                    prompt,
                    results,
                )

        assistant_msg = {
            "role": "assistant",
            "content": assistant_text,
            "links": results[: st.session_state.serper_num],
        }
        st.session_state.messages.append(assistant_msg)
        render_message(assistant_msg)


if __name__ == "__main__":
    main()


