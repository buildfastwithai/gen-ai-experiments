import io
from typing import Optional

import streamlit as st
from google import genai
from google.genai import types
from PIL import Image


def init_session_state() -> None:
    defaults = {
        "chat_history": [],
        "original_image_bytes": None,
        "current_image_bytes": None,
        "last_uploaded_file_id": None,
        "upload_toast_shown": False,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def reset_chat() -> None:
    st.session_state["chat_history"] = []


def reset_all() -> None:
    reset_chat()
    st.session_state["original_image_bytes"] = None
    st.session_state["current_image_bytes"] = None
    st.session_state["last_uploaded_file_id"] = None
    st.session_state["upload_toast_shown"] = False


def make_client(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key)


def image_from_bytes(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data))


def store_uploaded_image(uploaded, file_id: str) -> None:
    bytes_data = uploaded.getvalue()
    st.session_state["original_image_bytes"] = bytes_data
    st.session_state["current_image_bytes"] = bytes_data
    st.session_state["last_uploaded_file_id"] = file_id

    append_message("user", "Uploaded a new base image.", image_bytes=bytes_data)
    append_message(
        "assistant",
        "Great! I have the image. Describe the edit you want, and I'll iterate on it.",
    )

    if not st.session_state.get("upload_toast_shown", False):
        st.toast("Base image stored. Ready for edits!", icon="✅")
        st.session_state["upload_toast_shown"] = True


def describe_strength(level: float) -> str:
    if level < 0.34:
        return "subtle, gentle adjustments"
    if level < 0.67:
        return "balanced, medium-intensity edits"
    return "bold, high-intensity transformations"


def append_message(role: str, content: str, image_bytes: Optional[bytes] = None) -> None:
    st.session_state["chat_history"].append(
        {"role": role, "content": content, "image_bytes": image_bytes}
    )


def call_gemini_edit(
    api_key: str,
    model: str,
    prompt: str,
    image_bytes: bytes,
    strength_hint: str,
) -> bytes:
    client = make_client(api_key)
    enriched_prompt = (
        f"{prompt.strip()}\n\n"
        f"Apply {strength_hint}. Keep overall image coherence and only change what the user requested."
    )
    base_image = image_from_bytes(image_bytes)
    response = client.models.generate_content(
        model=model,
        contents=[enriched_prompt, base_image],
        config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
    )

    for part in response.parts:
        if part.inline_data is not None:
            return part.inline_data.data
        if getattr(part, "as_image", None):
            generated = part.as_image()
            buffer = io.BytesIO()
            generated.save(buffer, format="PNG")
            return buffer.getvalue()
    raise ValueError("No image data returned from Gemini.")


def render_chat_panel(api_key: str, model: str, strength_value: float) -> None:
    st.subheader("Edit Chat")
    for message in st.session_state["chat_history"]:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
            if message.get("image_bytes"):
                st.image(message["image_bytes"], width=512)

    prompt = st.chat_input("Describe your next edit…")
    if not prompt:
        return

    if not api_key:
        st.warning("Enter your Gemini API key first.")
        return
    if st.session_state["current_image_bytes"] is None:
        st.warning("Upload a base image before sending prompts.")
        return

    append_message("user", prompt)
    strength_hint = describe_strength(strength_value)
    with st.spinner("Contacting Gemini…"):
        try:
            new_image_bytes = call_gemini_edit(
                api_key=api_key,
                model=model,
                prompt=prompt,
                image_bytes=st.session_state["current_image_bytes"],
                strength_hint=strength_hint,
            )
        except Exception as exc:
            st.error(f"Gemini request failed: {exc}")
            append_message("assistant", "Sorry, I couldn't process that edit. Please try again.")
            return

    st.session_state["current_image_bytes"] = new_image_bytes
    append_message("assistant", "Here is the updated image:", image_bytes=new_image_bytes)
    st.rerun()


def main() -> None:
    st.set_page_config(page_title="Gemini Image Editor", layout="wide")
    st.title("Gemini Chat-based Image Editor")
    st.caption("Iterative edits with Gemini `gemini-3-pro-image-preview`.")

    init_session_state()

    with st.expander("How to use this editor"):
        st.markdown(
            """
1. Add your Gemini API key and upload a base image in the sidebar.
2. Every prompt in the chat describes an edit on **the latest image**.
3. Use the strength slider to choose subtle vs. bold edits.
4. Download the current result anytime from the sidebar button.
"""
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

    
        st.header("Session Controls")
        api_key = st.text_input("Gemini API Key", type="password")
        model = st.selectbox(
            "Model",
            options=["gemini-3-pro-image-preview", "gemini-2.5-flash-image"],
            index=0,
            help="Default per requirements, but you can explore others if enabled.",
        )
        strength = st.slider(
            "Edit strength",
            0.0,
            1.0,
            0.5,
            help="Lower = subtle tweaks, Higher = bold transformations.",
        )
        uploaded_image = st.file_uploader(
            "Upload base image",
            type=["png", "jpg", "jpeg", "webp"],
            accept_multiple_files=False,
        )
        if uploaded_image is not None:
            file_signature = f"{uploaded_image.name}:{uploaded_image.size}"
            if st.session_state.get("last_uploaded_file_id") != file_signature:
                store_uploaded_image(uploaded_image, file_signature)

        st.divider()
        st.button("Reset Chat", on_click=reset_chat)
        st.button("Reset Everything", on_click=reset_all)
        latest_image = st.session_state.get("current_image_bytes")
        st.download_button(
            "⬇️ Download Image",
            data=latest_image if latest_image else b"",
            file_name="gemini_edit.png",
            mime="image/png",
            disabled=latest_image is None,
            use_container_width=True,
        )

    render_chat_panel(api_key=api_key, model=model, strength_value=strength)


if __name__ == "__main__":
    main()
