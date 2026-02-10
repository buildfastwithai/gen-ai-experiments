# AI vs AI Tic-Tac-Toe: Battle of the Claudes

This application is an **AI vs AI Game Simulation** where different versions of **Anthropic's Claude** models compete against the powerful **Claude Opus 4.6** champion. The system is orchestrated by a **Team of Agents** using the **Agno** framework.

## Features

- **AI vs AI Gameplay**: Watch two LLMs play Tic-Tac-Toe against each other.
- **Team of Agents Architecture**:
  - **Player Agents**: Dedicated Agno agents for Player X (Challenger) and Player O (Champion).
  - **Game Supervisor**: A central controller that validates moves using **Pydantic** and provides feedback to agents to correct invalid moves.
- **Model Selection**: Choose from a variety of previous Claude models (Sonnet, Haiku, Instant, etc.) to challenge the Opus 4.6 champion.
- **Continuous Play**: "Start Match" button initiates an auto-play loop with a 1-second delay between moves.
- **Theme-Aware UI**: Custom-styled board with vibrant colors (Blue for X, Orange for O) that look great in both Light and Dark modes.

## Setup Instructions

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
   *Dependencies include `streamlit`, `agno`, and `openai`.*

2. **Run the app**:
   ```bash
   streamlit run app.py
   ```

## Usage

1. **Enter API Key**: Input your **OpenRouter API Key** in the sidebar.
2. **Select Challenger**: Choose a model for **Player X** from the dropdown list.
   - **Player O** is fixed as `anthropic/claude-opus-4.6`.
3. **Start Match**: Click "Start Match" to begin the automated battle.
4. **Watch**: The agents will play turn-by-turn. The **Game Supervisor** ensures fair play and valid moves.
5. **Continuous Action**: The game runs automatically until a win or draw. You can stop it at any time with "Stop Match".

---
*Powered by Agno Agents, OpenRouter, and Streamlit.*
