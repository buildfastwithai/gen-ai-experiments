## 🧭 Architecture Plan Generator (Streamlit + agno)

A simple Streamlit app that uses an agno Agent to generate a pragmatic, structured architecture plan from a short requirement. The app collects API keys from the sidebar and uses OpenAI models for both the main model and the JSON parser model.

### Features
- **OpenAI-only** models (no Anthropic)
- **Sidebar-based configuration** of API key and model IDs
- **Structured output** with sections like executive summary, services, APIs, data model, scaling, security, and delivery plan
- **Raw JSON view** and **download** as `architecture_plan.json`

### Requirements
- Python 3.9+
- OpenAI API key

### Install
```bash
pip install --upgrade pip
pip install "pydantic>=2" agno streamlit
```

### Run
```bash
streamlit run app.py
```

### Usage
1. Open the app in your browser (Streamlit will print a local URL).
2. In the sidebar, enter:
   - **OpenAI API Key**
   - **Main Model ID (OpenAI)** (default: `gpt-5-nano`)
   - **Parser Model ID (OpenAI)** (default: `gpt-5-nano`)
3. In the main area, provide:
   - Feature description (what you want to build)
   - Optional constraints (one per line)
   - Optional non-functionals (one per line)
4. Click "Generate Plan" to produce a structured plan.

### How it Works (at a glance)
- The app builds an `agno` Agent with:
  - `OpenAIChat(id=<Main Model ID>)` as the main model
  - `OpenAIChat(id=<Parser Model ID>)` as the parser model to coerce output to the `ArchitecturePlan` schema
- The Agent runs with your inputs and returns a JSON-like object which the UI renders by section.

### Configuration Notes
- Keys are taken from the sidebar and exported to the environment at runtime: `OPENAI_API_KEY`.
- You can change the model IDs from the sidebar. Keep them to valid OpenAI model IDs available to your account.

### Troubleshooting
- "OpenAI API Key is required" → Enter your key in the sidebar.
- "Model not found" → Use a model ID enabled for your API key.
- Output looks like plain text → The app normalizes the response; if parsing fails, it will at least show the text under Executive Summary, and still expose Raw JSON.

### Project Structure
```
.
├─ app.py           # Streamlit application
└─ README.md        # This file
```

### License
MIT (or your preferred license)


