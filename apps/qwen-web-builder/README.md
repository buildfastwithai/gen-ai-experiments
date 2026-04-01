# WebBuilder AI with Qwen3-Coder

A Streamlit application that uses **Qwen3-Coder-Next** via OpenRouter to generate and render websites instantly from text prompts.

## Features
- **Instant Website Generation**: Describe what you want, and get full HTML/CSS/JS code.
- **Live Preview**: See your website rendered immediately in the app.
- **Iterative Refinement**: Chat with the AI to tweak colors, layout, or content.
- **Code Download**: Export your creation as an `index.html` file.

## Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the App**:
   ```bash
   streamlit run app.py
   ```

3. **Usage**:
   - Enter your OpenRouter API Key in the sidebar.
   - Type a prompt like "Create a modern landing page for a sushi restaurant with a dark theme".
   - Watch the magic happen!

## Model
This app uses `qwen/qwen3-coder-next`, an 80B parameter MoE model optimized for coding tasks.
