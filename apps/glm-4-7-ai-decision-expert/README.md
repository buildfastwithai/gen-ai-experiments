# LifePath AI - Decision Architect 🧭

LifePath AI is a decision support system powered by **z-ai/glm-4.7** via OpenRouter. It acts as your personal "Decision Architect," simulating a team of AI agents to help you break down complex life choices, simulate potential outcomes, and provide reasoned advice.

## Features

*   **Multi-Agent Simulation**:
    *   **The Analyst**: Breaks down core factors and emotional vs. logical constraints.
    *   **The Simulator**: Predicts outcomes for different scenarios (e.g., Option A vs. Option B).
    *   **The Advisor**: Synthesizes findings into a final recommendation.
*   **Decision Matrix**: visually compares options based on key factors.
*   **Deep Thinking Mode**: Enables simulated multi-agent reasoning for deeper analysis.
*   **Customizable Context**: Choose from various dilemma types like Career Change, Relocation, Relationship, etc.

## Prerequisites

*   Python 3.8+
*   An [OpenRouter](https://openrouter.ai/) API Key

## Installation

1.  Clone this repository or download the files.
2.  Install the required dependencies:

    ```bash
    pip install -r requirements.txt
    ```

## Usage

1.  Run the Streamlit application:

    ```bash
    streamlit run app.py
    ```

2.  Open your browser (usually at `http://localhost:8501`).
3.  Enter your **OpenRouter API Key** in the sidebar.
4.  Select your **Dilemma Type** and describe your situation in the text area.
5.  Click **Analyze Decision 🚀** to receive your personalized decision analysis.

## Tech Stack

*   **Frontend**: [Streamlit](https://streamlit.io/)
*   **AI Model**: z-ai/glm-4.7 (via OpenRouter)
*   **Client**: OpenAI Python Client

## License

[MIT License](LICENSE)
