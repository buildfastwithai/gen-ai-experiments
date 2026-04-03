# WebBuilderByImages

A Streamlit application that allows users to upload images of websites and generates an exact replica using the **Moonshot AI (Kimi-k2.5)** model via OpenRouter.

## 🚀 Features

- **Image-to-Code**: Upload up to 3 screenshots of a website.
- **AI-Powered**: Uses `moonshotai/kimi-k2.5` (or other OpenRouter models) to analyze images and generate code.
- **Interactive Chat**: Refine the design by chatting with the AI.
- **Live Preview**: Instantly view the generated website rendered within the app.
- **Downloadable**: Download the final `index.html` file directly.

## 🛠️ Installation

1.  **Clone the repository** (or download the files):
    - `app.py`
    - `requirements.txt`

2.  **Install Dependencies**:
    Recommended to use a virtual environment.
    ```bash
    pip install -r requirements.txt
    ```

3.  **Run the App**:
    ```bash
    streamlit run app.py
    ```

## ⚙️ Usage

1.  Open the app in your browser (usually `http://localhost:8501`).
2.  **Sidebar Setup**:
    - Enter your **OpenRouter API Key**.
    - Select the desired model.
3.  **Generate Website**:
    - Upload images of the design you want to replicate.
    - Type a prompt in the chat (e.g., "Build this website").
4.  **Refine & Download**:
    - Ask for changes if needed.
    - Click "Download Source Code" to save the result.

## 📦 Requirements

- Python 3.8+
- Streamlit
- OpenAI (client for OpenRouter)
- Pillow
