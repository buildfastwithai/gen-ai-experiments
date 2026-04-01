# Gemini Chat Image Editor

Streamlit app for iterative, chat-driven image editing with Google Gemini `gemini-3-pro-image-preview`.

## Features
- Chat interface that chains edits by feeding the most recent image back to Gemini.
- Sidebar hosts API key input, model selector, edit-strength slider, image uploader, reset buttons, and a persistent “Download Image” action.
- Uploaded image is injected into the chat history so users can visually track the conversation.
- First-upload toast only, plus guardrails for missing API key/image and API failures.

## Requirements
- Python 3.10+
- Dependencies listed in `requirements.txt`.
- Google Gemini API access and key.

## Setup
```bash
python -m venv .venv
.venv\Scripts\activate   # On Windows
# source .venv/bin/activate  # On macOS/Linux
pip install -r requirements.txt
```

## Run
```bash
streamlit run app.py
```

## Usage
1. In the sidebar, paste your Gemini API key, pick the model, tune the edit-strength slider, and upload a base image (`png/jpg/jpeg/webp`).
2. The image immediately appears inside the chat, along with the assistant’s prompt for guidance.
3. Type instructions in the chat input; each request re-edits the latest generated image.
4. Reset chat or the entire session from the sidebar if needed.
5. Download the current result anytime with the `⬇️ Download Image` button (always the newest image).

## Notes
- All state is tracked via `st.session_state` (`chat_history`, `original_image_bytes`, `current_image_bytes`, etc.).
- API key is only kept client-side within the Streamlit session.
- For best results, follow Gemini’s prompting guidelines (descriptive prompts, clear intent, iterative tweaks).

