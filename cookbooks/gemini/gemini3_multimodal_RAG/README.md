# Gemini 3 Pro Multimodal RAG Chatbot ✨

This project is a Streamlit-based chatbot that uses **Google Gemini 3 Pro** with:

- 🔍 **RAG (Retrieval-Augmented Generation)** over your own PDFs / text files  
- 🖼️ **Multimodal reasoning** over uploaded images  
- 🧠 **Dynamic / low-latency thinking modes**  
- 💬 **Chat-style UI with history** stored in the Streamlit session  

---

## Features

- **Google Gemini 3 Pro integration**
  - Uses `google-genai` SDK and the `gemini-3-pro-preview` model.
  - Thought signatures / safety are handled automatically by the SDK.

- **RAG over your documents**
  - Upload `.pdf`, `.txt`, or `.md` files in the sidebar.
  - Text is chunked and embedded with `text-embedding-004`.
  - User queries are embedded, and the top‑k most relevant chunks are retrieved with cosine similarity.
  - Retrieved snippets are injected into the prompt as **context**.

- **Multimodal uploads**
  - Upload multiple images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`).
  - Each image is wrapped as a `types.Part` with optional `media_resolution` level.
  - Configurable resolution:
    - High · images / OCR (1120 tokens)
    - Medium · docs / PDFs (560 tokens)
    - Low · fast preview (280 tokens)

- **Chat history**
  - Every user / assistant turn is stored in `st.session_state.chat_history`.
  - Conversation history is replayed into the Gemini request for context-aware responses.

- **Knowledge base controls**
  - See how many RAG chunks are indexed.
  - Button to **clear knowledge base**.
  - Button to **reset chat history** (forces rerun).

---

## Requirements

Python **3.9+** is recommended.

### Python dependencies

Install the following packages:

- `streamlit`
- `google-genai` (Google AI Studio client)
- `pypdf` (optional, only required for PDF text extraction)
- `typing-extensions` / standard library types if needed (depending on Python version)

You can install everything with:

```bash
pip install streamlit google-genai pypdf
```

> If you don't need PDF support, you can skip `pypdf`. The app will show a runtime error if you try to upload a PDF without it.

---

## Getting a Google AI Studio API Key

1. Go to **Google AI Studio**.
2. Create / log in to your Google account.
3. Generate an **API key**.
4. Copy the key (keep it secret, do not commit it to Git).

You will paste this key into the Streamlit sidebar at runtime.

---

## Project Structure

Typical minimal layout:

```text
project/
├─ app.py              # The Streamlit app (this file)
└─ README.md           # This documentation
```

Rename `app.py` as needed, but remember to update the `streamlit run` command.

---

## How It Works (High-level)

1. **Initialization**
   - `init_state()` sets up `chat_history`, `rag_chunks`, `client`, and `media_files` in `st.session_state`.
   - `init_client(api_key)` creates / caches a `genai.Client` instance.

2. **RAG pipeline**
   - `extract_text(file)` reads text from `.txt`, `.md`, or PDFs (via `pypdf.PdfReader`).
   - `chunk_text(text, chunk_size=800, overlap=200)` splits text into overlapping chunks.
   - `embed_chunks(client, chunks)` calls `client.models.embed_content` with `text-embedding-004`, storing `{chunk, embedding}`.
   - `retrieve_context(client, query, top_k=3)` embeds the query and computes cosine similarity against stored chunk embeddings.

3. **Multimodal input**
   - `make_media_part(upload, level)` wraps each uploaded image in a `types.Part` with `inline_data` and optional `media_resolution`.

4. **Prompt construction**
   - `build_contents(user_prompt, context_blurbs, thinking_level)`:
     - Replays chat history (`role`, `content`) as `types.Content`.
     - Adds a **thinking directive**:
       - `dynamic`: “Use dynamic thinking for maximum reasoning quality.”
       - `low`: “Use low-level thinking to prioritize speed over depth…”
     - If RAG context is present, prepends it as `[Context i]` blocks and states that context should override general knowledge.
     - Appends all multimodal `media_files` as additional parts.

5. **Generation**
   - Calls `client.models.generate_content` with:
     - `model="gemini-3-pro-preview"`
     - `contents` from `build_contents`
     - `config={"temperature": 1.0, "max_output_tokens": 2048}`
   - Displays `response.text` in the chat and appends it to `chat_history`.

---

## Running the App

1. Save the code as `app.py` in a folder.

2. Create and activate a virtual environment (optional but recommended):

```bash
python -m venv .venv
source .venv/bin/activate  # macOS / Linux
# or
.venv\Scripts\activate     # Windows
```

3. Install dependencies:

```bash
pip install streamlit google-genai pypdf
```

4. Run Streamlit:

```bash
streamlit run app.py
```

5. Open the local URL that Streamlit prints (usually `http://localhost:8501`).

---

## Using the App

1. **Enter API key**
   - In the left sidebar, paste your **Google AI Studio API key** into the “Google AI Studio API Key” field.

2. **Configure thinking & vision**
   - Select a **Thinking level**:
     - `Dynamic (recommended)` for best reasoning.
     - `Low latency` for faster, shallower responses.
   - Choose an image resolution: High / Medium / Low depending on cost vs quality.

3. **Upload RAG documents (optional)**
   - In **📄 Knowledge Base (RAG)** section:
     - Upload PDFs / text files.
     - The app will index chunks and show `Indexed chunks in memory: N`.

4. **Upload images (optional)**
   - In **🖼️ Multimodal Uploads**:
     - Add images relevant to your question.
     - The images are added as parts to the next user query.

5. **Chat**
   - Use the chat input at the bottom (**“Ask anything…”**).
   - Messages appear as **user** and **assistant** bubbles.
   - The assistant:
     - Uses conversation history.
     - Uses RAG context if available.
     - Uses attached images (vision).

6. **Maintenance**
   - Use **“Clear knowledge base”** to drop all indexed chunks.
   - Use **“Reset chat history”** to fully reset the conversation and rerun the app.

---

## Environment Variables (Optional)

Instead of manually pasting the API key each time, you could wire it to an environment variable in your own fork:

```bash
export GOOGLE_API_KEY="your-key-here"
```

Then adjust `init_client` to read from `os.environ` when the sidebar field is empty.  
This project currently expects the key from the **sidebar input**.

---

## Notes & Limitations

- This app stores **chat history and embeddings in memory only** (via `st.session_state`).
  - Restarting the app clears everything.
- Embedding and generation calls may incur **costs** on your Google AI account.
- For very large PDFs:
  - Chunking is naive (by character length) and may need tuning for production use.
  - Consider adding rate limiting, caching, or persistent vector storage if scaling up.

---

## License

Use, modify, and integrate this code in your own projects as you like.  
Remember to keep your API keys secret and comply with the terms of use of Google AI and any other services you integrate.
