# 📐 Paperfold.ai

![Python](https://img.shields.io/badge/python-≥3.13-blue)
![Streamlit](https://img.shields.io/badge/Streamlit-%F0%9F%8E%88-FF4B4B)
![License](https://img.shields.io/badge/License-MIT-green)
[![Powered by OpenRouter](https://img.shields.io/badge/Powered%20By-OpenRouter-4F46E5)](https://openrouter.ai)

> **⭐ Horizon Beta | 🌸 Make amazing origami just by uploading a picture! 🌸**

PaperFold.AI is an intuitive, AI-powered web app that turns any image of an origami object into a **child-friendly, step-by-step folding guide**. Drop a photo, click **“Generate Tutorial”**, and watch as the Horizon Beta AI model explains where every fold should go—perfect for beginners, educators, and crafty learners of all ages.

---

## ✨ Features
*   📷 **Upload-and-Create** – simple drag-and-drop or browse for your photo  
*   🧠 **AI-Powered Steps** – each fold described in beginner language with emojis  
*   🖥️ **Streamlined UI** – built with modern Streamlit for a smooth user experience  
*   🔑 **OpenRouter Integration** – configurable API key and gold-standard Horizon Beta model  

---

## 📦 Quickstart

### 1. Clone the repo
```bash
git clone https://github.com/your-org/paperfold.ai.git
cd paperfold.ai
```

### 2. Set up Python ≥ 3.13
Using **uv**, pipenv, or vanilla venv:
```bash
# uv (blazing-fast)
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt

# or traditional
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

By default, PaperFold.ai will install `educhain`, `langchain-openai`, and `streamlit`.

### 3. Get your OpenRouter API key
1. Register at [openrouter.ai](https://openrouter.ai/settings/keys)  
2. Create a new key and copy it to the sidebar when you launch the app.

### 4. Launch locally
```bash
streamlit run app.py
# Your browser opens at http://localhost:8501
```

---

## 🪧 Usage
1. **Start the App** – `streamlit run app.py`  
2. **Enter API Key** – paste your OpenRouter API key in the left sidebar  
3. **Upload Image** – drag a JPG/PNG/PNG of any origami piece into the uploader  
4. **Generate Guide** – click **“✨ Generate Origami Tutorial”**  
5. **Follow Steps** – easy, emoji-rich instructions appear dynamically

---

## 🏗️ Tech Stack
| Layer | Technology |
|-------|------------|
| LLM & Reasoning | OpenRouter (`horizon-beta`) & Educhain |
| Chat Model | `langchain-openai` ChatOpenAI wrapper |
| UI & Frontend | Streamlit (Python) |
| Requirements | uv/pip  (see `pyproject.toml`) |
| OS | macOS, Linux, Windows (Python ≥3.13 recommended) |

---

## 🧑‍💻 Contributing
We ❤️ contributions! Here’s how to jump in:

1. **Fork & branch**  
   `git checkout -b feature/your-awesome-feature`

2. **Install dev tools**  
   ```
   pip install ruff black pytest
   ```

3. **Run checks**  
   ```
   ruff check .               # lint
   black . --check            # auto-format check
   pytest                     # tests (when added)
   ```

4. **Commit with love**  
   Use [Conventional Commits](https://www.conventionalcommits.org):  
   `feat(sidebar): dark-mode switch`

5. **Open a Pull Request** – describe the problem, the fix, and add screenshots/GIFs for UI changes.

---

## 📜 License
MIT © 2024 Build Fast with AI community  

---

Made with ❤️ by [**Build Fast with AI**](https://buildfastwithai.com)