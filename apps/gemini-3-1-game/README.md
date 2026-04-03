# 🎮 AI Web Game Builder

A powerful, interactive Streamlit application that uses **Google Gemini 3.1 Pro Preview** (via Agno agents) to act as your personal game developer. Simply chat to define your game ideas, and the app will generate, iterate, and instantly render playable HTML/CSS/JS web games directly in the UI!

## Features

- **Chat Interface:** Describe the game you want to build (e.g., "Build a retro Snake game" or "Make a Pong game with neon colors").
- **Live Rendering:** The generated game is rendered instantly in a playable iframe right next to the chat.
- **Iterative Improvement:** Ask the AI to make changes (e.g., "make the ball faster", "add a score counter"), and it will update the code and re-render the game.
- **Native Gemini Integration:** Uses `agno.models.google.Gemini` for high-quality, agentic code generation.

## Installation

1. Clone or download this repository.
2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

1. Run the Streamlit application:
   ```bash
   streamlit run app.py
   ```
2. Open your browser to the URL provided in the terminal (usually `http://localhost:8501`).
3. Enter your **Google Gemini API Key** in the sidebar configuration panel.
4. Type a prompt like "Create a simple pong game" in the chat to start building!
