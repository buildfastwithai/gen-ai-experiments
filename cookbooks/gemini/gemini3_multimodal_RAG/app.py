import io
import math
from typing import List, Dict, Optional, Tuple

import streamlit as st
from google import genai
from google.genai import types

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - optional dependency for PDFs
    PdfReader = None  # type: ignore[assignment]


st.set_page_config(
    page_title="Gemini 3 Pro Multimodal RAG",
    page_icon="✨",
    layout="wide",
)

MEDIA_RESOLUTION_LEVELS = {
    "High · images / OCR (1120 tokens)": "media_resolution_high",
    "Medium · docs / PDFs (560 tokens)": "media_resolution_medium",
    "Low · fast preview (280 tokens)": "media_resolution_low",
}

PART_SUPPORTS_MEDIA_RESOLUTION = "media_resolution" in getattr(
    types.Part, "model_fields", {}
)


def init_state() -> None:
    if "chat_history" not in st.session_state:
        st.session_state.chat_history: List[Dict[str, str]] = []
    if "rag_chunks" not in st.session_state:
        st.session_state.rag_chunks: List[Dict[str, List[float]]] = []
    if "client" not in st.session_state:
        st.session_state.client = None
    if "media_files" not in st.session_state:
        st.session_state.media_files: List[Dict[str, str]] = []


def init_client(api_key: str) -> Optional[genai.Client]:
    if not api_key:
        return None
    if (
        st.session_state.get("client") is not None
        and st.session_state.get("client_key") == api_key
    ):
        return st.session_state.client
    client = genai.Client(
        api_key=api_key,
        http_options={"api_version": "v1alpha"},
    )
    st.session_state.client = client
    st.session_state.client_key = api_key
    return client


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 200) -> List[str]:
    text = text.replace("\r\n", "\n").strip()
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(end - overlap, 0)
    return chunks


def extract_text(file) -> str:
    if file.type in {"text/plain", "text/markdown"}:
        return file.getvalue().decode("utf-8")
    if file.type == "application/pdf":
        if PdfReader is None:
            raise RuntimeError(
                "PDF support requires the optional 'pypdf' package. "
                "Run 'pip install pypdf' and restart the app."
            )
        reader = PdfReader(io.BytesIO(file.getvalue()))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)
    return ""


def embed_chunks(client: genai.Client, chunks: List[str]) -> List[Dict]:
    vectors = []
    for chunk in chunks:
        embedding = client.models.embed_content(
            model="text-embedding-004",
            contents=chunk,
        )
        vector = extract_embedding_values(embedding)
        vectors.append(
            {
                "chunk": chunk,
                "embedding": vector,
            }
        )
    return vectors


def cosine_similarity(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    denom = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    if denom == 0:
        return 0.0
    return dot / denom


def retrieve_context(
    client: genai.Client, query: str, top_k: int = 3
) -> List[str]:
    if not st.session_state.rag_chunks:
        return []
    query_embedding_resp = client.models.embed_content(
        model="text-embedding-004",
        contents=query,
    )
    query_embedding = extract_embedding_values(query_embedding_resp)

    scored = [
        (cosine_similarity(item["embedding"], query_embedding), item["chunk"])
        for item in st.session_state.rag_chunks
    ]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [chunk for _, chunk in scored[:top_k] if chunk.strip()]


def make_media_part(upload, level: str) -> types.Part | None:
    data = upload.getvalue()
    if not data:
        return None
    mime = upload.type or "application/octet-stream"
    kwargs = {}
    if PART_SUPPORTS_MEDIA_RESOLUTION and level:
        kwargs["media_resolution"] = {"level": level}
    return types.Part(
        inline_data=types.Blob(
            mime_type=mime,
            data=data,
        ),
        **kwargs,
    )


def build_contents(
    user_prompt: str,
    context_blurbs: List[str],
    thinking_level: str,
) -> List[types.Content]:
    contents: List[types.Content] = []
    thinking_text = (
        "Use dynamic thinking for maximum reasoning quality."
        if thinking_level == "dynamic"
        else "Use low-level thinking to prioritize speed over depth unless clarification is required."
    )
    for message in st.session_state.chat_history:
        contents.append(
            types.Content(
                role=message["role"],
                parts=[types.Part(text=message["content"])],
            )
        )

    augmented_prompt = (
        f"{thinking_text}\n"
        "Follow the conversation history faithfully. "
        "When RAG snippets are provided, cite them before general knowledge.\n\n"
    )
    augmented_prompt += user_prompt
    if context_blurbs:
        context_text = "\n\n".join(
            f"[Context {idx+1}]\n{chunk}" for idx, chunk in enumerate(context_blurbs)
        )
        augmented_prompt = (
            f"{thinking_text}\n"
            "Use the retrieved RAG context when it improves accuracy. "
            "If the context conflicts with prior knowledge, prefer the context.\n"
            f"{context_text}\n\nUser question:\n{user_prompt}"
        )

    user_parts: List[types.Part] = [types.Part(text=augmented_prompt)]
    for upload in st.session_state.media_files:
        user_parts.append(upload)

    contents.append(types.Content(role="user", parts=user_parts))
    return contents


def extract_embedding_values(response: types.EmbedContentResponse) -> List[float]:
    data = response.model_dump()
    if "embedding" in data and data["embedding"]:
        return data["embedding"].get("values", [])
    embeddings = data.get("embeddings") or []
    if embeddings:
        return embeddings[0].get("values", [])
    raise ValueError("No embedding vector returned from embed_content call.")


def display_history() -> None:
    for message in st.session_state.chat_history:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])


def sidebar_layout() -> Tuple[Optional[genai.Client], Dict[str, str]]:
    st.sidebar.title("🔐 Setup & Inputs")
    st.sidebar.caption(
        "Gemini 3 Pro defaults to dynamic thinking. Keep temperature at 1.0 "
        "for best reasoning stability."
    )

    api_key = st.sidebar.text_input(
        "Google AI Studio API Key",
        type="password",
        help="Your key is only stored in the current session.",
    )
    client = init_client(api_key)

    thinking_choice = st.sidebar.radio(
        "Thinking level",
        options=[
            "Dynamic (recommended)",
            "Low latency",
        ],
        help=(
            "Dynamic maximizes reasoning quality. Choose Low latency only if you need "
            "faster responses for simpler prompts."
        ),
    )
    thinking_level = "dynamic" if "Dynamic" in thinking_choice else "low"

    image_resolution_label = st.sidebar.selectbox(
        "Vision resolution per image",
        options=list(MEDIA_RESOLUTION_LEVELS.keys()),
        index=0,
        help=(
            "High ensures best OCR/Text extraction (1120 tokens). "
            "Medium is often enough for PDFs; Low minimizes cost."
        ),
    )
    image_resolution_level = MEDIA_RESOLUTION_LEVELS[image_resolution_label]

    if not PART_SUPPORTS_MEDIA_RESOLUTION:
        st.sidebar.warning(
            "Installed google-genai SDK version does not yet expose the "
            "`media_resolution` field. Default vision resolution will be used."
        )

    with st.sidebar.expander("📄 Knowledge Base (RAG)", expanded=True):
        rag_files = st.file_uploader(
            "Upload PDFs or text files",
            type=["pdf", "txt", "md"],
            accept_multiple_files=True,
        )
        if rag_files and client:
            new_chunks = []
            for file in rag_files:
                text = extract_text(file)
                chunks = chunk_text(text)
                new_chunks.extend(embed_chunks(client, chunks))
            st.session_state.rag_chunks.extend(new_chunks)
            st.success(f"Indexed {len(new_chunks)} chunks.")

    st.sidebar.write(
        f"Indexed chunks in memory: {len(st.session_state.rag_chunks)}"
    )

    if st.sidebar.button("Clear knowledge base", use_container_width=True):
        st.session_state.rag_chunks = []
        st.success("Cleared all indexed chunks.")

    if st.sidebar.button("Reset chat history", use_container_width=True):
        st.session_state.chat_history = []
        st.experimental_rerun()

    with st.sidebar.expander("🖼️ Multimodal Uploads", expanded=True):
        uploads = st.file_uploader(
            "Images / audio / video frames",
            type=["png", "jpg", "jpeg", "webp", "gif"],
            accept_multiple_files=True,
            key="media_uploader",
        )
        st.session_state.media_files = []
        if uploads:
            for upload in uploads:
                media_part = make_media_part(upload, image_resolution_level)
                if media_part:
                    st.session_state.media_files.append(media_part)
            st.info(
                "Images use high resolution (1120 tokens). Upload only what's needed."
            )

    st.sidebar.markdown("---")
    st.sidebar.subheader("Usage notes")
    st.sidebar.write(
        "- Thought signatures are handled automatically when using the SDK.\n"
        "- Streaming may include empty text chunks that only carry signatures.\n"
        "- For video, low/medium resolution both consume 70 tokens per frame."
    )

    return client, {
        "thinking_level": thinking_level,
        "image_resolution_level": image_resolution_level,
    }


def main() -> None:
    init_state()
    client, ui_config = sidebar_layout()

    st.title("Gemini 3 Pro Multimodal RAG Chatbot")
    st.caption(
        "Attach domain knowledge, drop images, and let Gemini 3 Pro reason with "
        "dynamic thinking and high-resolution vision."
    )

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

    display_history()

    if prompt := st.chat_input("Ask anything…"):
        if not client:
            st.error("Please provide a valid API key in the sidebar first.")
            return

        with st.chat_message("user"):
            st.markdown(prompt)
        st.session_state.chat_history.append({"role": "user", "content": prompt})

        context = retrieve_context(client, prompt)
        contents = build_contents(
            prompt,
            context,
            thinking_level=ui_config["thinking_level"],
        )

        with st.chat_message("assistant"):
            with st.spinner("Thinking with Gemini 3 Pro…"):
                try:
                    response = client.models.generate_content(
                        model="gemini-3-pro-preview",
                        contents=contents,
                        config={
                            "temperature": 1.0,
                            "max_output_tokens": 2048,
                        },
                    )
                    reply = response.text or "No response text returned."
                    st.markdown(reply)
                except Exception as exc:  # pragma: no cover - runtime errors only
                    reply = f"Error: {exc}"
                    st.error(reply)
        st.session_state.chat_history.append(
            {
                "role": "assistant",
                "content": reply,
            }
        )


if __name__ == "__main__":
    main()

