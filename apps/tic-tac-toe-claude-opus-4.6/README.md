# 🤖 AI Battle: Tic-Tac-Toe Arena

**Claude Opus 4.6 vs. Kimi 2.5**

Welcome to the ultimate AI showdown! This application simulates a Tic-Tac-Toe battle between two advanced Large Language Models (LLMs), orchestrated by a robust multi-agent system using the **Agno** framework.

## 🌟 Features

*   **Battle of Giants**: Watch **Claude Opus 4.6** take on the thinking powerhouse **Kimi 2.5**.
*   **"Battle Vibes" UI**: Experience a custom-styled interface with neon gradients, bold typography, and a dynamic "Verified" vs. "Challenger" aesthetic.
*   **Intelligent Agent Team**:
    *   **Player Agents**: Distinct agents for Player X and Player O, each with specific instructions and personas.
    *   **Visual Board Perception**: Agents "see" the board as a 3x3 visual grid, ensuring accurate move selection.
    *   **Game Supervisor**: A strict referee that validates every move, providing specific feedback to agents if they attempt invalid plays (e.g., picking an occupied cell).
*   **Auto-Play Mode**: Sit back and watch the AI logic unfold turn-by-turn with a cinematic delay.

## 🚀 Setup & Installation

1.  **Clone dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
    *(Requires `streamlit`, `agno`, `pydantic`, etc.)*

2.  **Launch the Arena**:
    ```bash
    streamlit run app.py
    ```

## 🎮 How to Play

1.  **Enter API Key**: Provide your **OpenRouter API Key** in the sidebar to unlock the models.
2.  **Choose Your Fighter**: Select **Player X** (e.g., *Claude Opus 4.6*).
    *   **Player O** awaits as the defending champion (*Kimi 2.5*).
3.  **Start Match**: Click the button to ignite the battle.
4.  **Spectate**: Watch the board update in real-time as the agents reason and react.

## 🛠️ Tech Stack

*   **Frontend**: Streamlit with custom HTML/CSS injection.
*   **Agent Framework**: Agno (formerly Phidata).
*   **Model Provider**: OpenRouter.
*   **Logic**: Python + Pydantic for structured data validation.

---
*Built with ❤️ for the GenAI community.*
