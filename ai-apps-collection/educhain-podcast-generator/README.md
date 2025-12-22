## 🎙️ AI Podcast Generator (Educhain + Streamlit)

Generate high‑quality AI podcasts from a topic or your own script using **Educhain**, with a clean **Streamlit** UI and an advanced waveform audio player.

### 🔧 Features

- **Topic → Script → Audio** in one click (via `generate_complete_podcast`)
- **Custom script → Audio** (via `generate_podcast_from_script`)
- Multiple **TTS providers**: OpenAI, Google/Gemini (configurable in sidebar)
- **Waveform audio player** with `streamlit-advanced-audio` (seek, regions, playback time)
- Download generated podcast as **MP3**

### 📦 Installation

1. Create and activate a virtual environment (optional but recommended).
2. Install dependencies:

```bash
pip install -r requirements.txt
```

### 🔑 API Keys

- **OpenAI**: Required if you choose `openai` as TTS provider.
- **Google / Gemini**: Required if you choose `google` or `gemini` as TTS provider.

Keys are entered in the **sidebar**; they are set to environment variables (`OPENAI_API_KEY`, `GOOGLE_API_KEY`) for Educhain to use.

### 🚀 Run the App

From the project root:

```bash
streamlit run streamlit_app.py
```

Then open the URL shown in the terminal (usually `http://localhost:8501`).

### 💡 Usage

1. In the **sidebar**:
   - Paste your **API keys**.
   - Choose **Podcast Mode**:  
     - *From Topic (auto script)*, or  
     - *From Custom Script*.
   - Select **TTS provider**, **voice/model** (when applicable), and **language**.
2. In the **main area**:
   - Enter a **topic** or paste your **script** (depending on mode).
   - Click **“🚀 Generate Podcast”**.
3. After generation:
   - Use the **waveform player** to play/seek the audio.
   - Optionally review current time / selected region.
   - Click **Download MP3** to save the file locally.

### 🧱 Tech Stack

- `Streamlit` – UI framework
- `Educhain` – podcast/script and audio generation
- `streamlit-advanced-audio` – waveform audio playback


