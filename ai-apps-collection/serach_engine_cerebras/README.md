# Conversational Search (Streamlit + Serper + Cerebras)

## Quickstart

1. Create and activate a virtual environment.
2. Install deps:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the app:
   ```bash
   streamlit run app.py
   ```
4. In the sidebar, paste your keys:
   - `Serper API Key` (from https://serper.dev)
   - `Cerebras API Key` (optional, for LLM summarization)
   - `Cerebras Model ID` (defaults to `llama-4-scout-17b-16e-instruct`)

## Features
- Chat UI with history using Streamlit chat elements
- Serper web search (top 5–10 results)
- LLM summary card powered by Cerebras via Agno (fallback summary if not available)
- Related links list with title, snippet, and clickable URLs

## Notes
- If Agno/Cerebras packages or API key are not configured, the app falls back to a lightweight non-LLM summary.
- You can set environment variables `SERPER_API_KEY`, `CEREBRAS_API_KEY`, and `CEREBRAS_MODEL_ID` before launch to pre-fill the sidebar.

