# 🚀 Tech Product Comparator & Suggestion Tool

![Python](https://img.shields.io/badge/python-3.13+-blue)
![Streamlit](https://img.shields.io/badge/Streamlit-1.48.1+-FF4B4B)
![Google GenAI](https://img.shields.io/badge/Google_GenAI-1.31.0+-4285F4)
![Status](https://img.shields.io/badge/status-ready%20to%20ship-green)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Contributors](https://img.shields.io/badge/contributors-welcome-orange)

> **Instant, AI-powered comparisons made simple.** Just drop URLs to any tech products – and instantly get a concise comparison table, feature-by-feature insights, and a data-driven buying recommendation tailored to **your** exact needs.

---

## 🌟 What makes this tool special
- **Smart AI Analysis** – Uses Google’s *Gemini 2.5-Flash* for reliable feature extraction & ranking  
- **Zero Code Setup** – 100 % web UI, no CLI required  
- **Fully Open Source** – MIT-licensed for commercial & personal use  
- **Scalable** – Compare 2 – 10 products in one click  
- **Free Forever API key** – works on Google’s free tier  

---

## 🏗️ Tech Stack

| Layer        | Choice                                |
|--------------|---------------------------------------|
| UI Framework | [Streamlit](https://docs.streamlit.io) |
| AI Engine    | `google-genai` (Gemini 2.5-flash)     |
| Language     | Python 3.13+                          |
| Packaging    | `pyproject.toml` / `pip`              |

---

## 🔧 Quick-Start Installation

> **Tip:** use a Python virtualenv to keep things tidy.

### Option A – from PyPI *(soon)*  
```bash
pip install gadgets-comparator
gadgets-comparator   # launches in browser
```

### Option B – from source *(today)*
```bash
# 1. clone the repo
git clone https://github.com/your-org/gadgets-comparator.git
cd gadgets-comparator

# 2. create env
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# 3. install
pip install -r requirements.txt        # standard
# .. or ..
pip install .                        # from pyproject.toml
```


---

## 🏃‍♂️ Usage

1. **Launch**
   ```bash
   streamlit run app.py
   ```
   Your browser should open http://localhost:8501 automatically.

2. **Enter your [Gemini API Key](https://ai.google.dev/tutorials/web_quickstart)**
   > Side panel → 🔐 API Settings  
   > (The first 15 requests/day are free.)

3. **Add URLs**
   - Number of products you want to compare → 2–10  
   - Paste each **direct** product URL (Amazon, Dell, BestBuy, etc.).  
   - No login-/paywall-restricted pages.

4. **Specify Your Needs**  
   > “for gaming , for coding , Long battery life, under 1500 USD, dedicated GPU, under 1.8 kg.”

5. **Hit 📊 Generate Report**  
   Receive:
   - Executive summary  
   - Feature table (✅ / ❌ / 🔸)  
   - Final Recommendation 

---

## 🖥️ Example Walk-Through

| Step | 
|------|
| Launch |
| Add URLs | 
| Output | 


---

## 🤝 Contributing

We welcome **PRs, issues & ideas!**

1. **Fork & clone**
2. **Create branch**  
   `git checkout -b feature/your-idea`
3. **Lint before push**

   ```bash
   pip install ruff black mypy
   ruff check .
   black app.py
   mypy app.py
   ```
4. **Commit & push**, open a PR.




---

## 📜 License

[MIT](./LICENSE) – use it anywhere, any time.

---

💚 Built by [*Build Fast with AI*](https://buildfastwithai.com) – leveling up builders worldwide.