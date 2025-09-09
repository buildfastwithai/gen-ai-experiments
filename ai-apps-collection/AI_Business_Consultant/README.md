# 🤖 AI Business Consultant – Multi-Agent Insights at the Speed of Thought

![Python 3.13+](https://img.shields.io/badge/Python-3.13+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-1.49.1-red?style=for-the-badge&logo=streamlit&logoColor=white)
![CrewAI](https://img.shields.io/badge/CrewAI-0.177.0-000?style=for-the-badge&logo=crewai&logoColor=white)
![Cohere](https://img.shields.io/badge/Cohere-API-6624EB?style=for-the-badge&logo=cohere&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge&logo=mit&logoColor=white)

---

AI Business Consultant is **your on-demand research squad**.
Feed any business question—*industry trends, competitive analysis, market sizing, growth strategies*—and three autonomous agents (Consultant, Writer, Analyst) team up to deliver **action-ready, data-driven insights** in plain English.

Features

- 🔍 Defining the exact business topic & stakeholder audience
- 🧠 Planning→Writing→Analyzing workflow powered by CrewAI
- 📊 Real-time statistical analysis with AI-generated numbers
- 🖥️ Streamlit UI: configure your API key, hit **Run**, and read the concise report

---

## ⚙️ Tech Stack


| Layer                 | Tech            | Why                                              |
| --------------------- | --------------- | ------------------------------------------------ |
| LLM                   | Cohere`command` | Fast, reasoning-optimized, available via API key |
| Multi-agent framework | CrewAI          | Native role delegation & async execution         |
| Front-end             | Streamlit       | Zero-code, interactive data apps                 |
| Package manager       | uv / pip        | `pyproject.toml` first                           |

---

## 📦 Installation

> 💡 **Python 3.13+ required**

1. **Clone & cd**
2. **Install via `pip` (or `uv`)**

   ```bash
   pip install -r requirements.txt
   ```

   _or_

   ```bash
   uv sync --frozen
   ```
3. **Grab a Cohere API key**
   [dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys)

---

## 🚀 Usage

```bash
streamlit run main.py
```

1. Paste your **Cohere API key** in the sidebar.
2. Enter a **business question** (e.g., _“subscription pricing in SaaS for SMBs”_).
3. Enter the **stakeholder team** (e.g., _“Product Marketing”_).
4. Click **Generate Insights**.

The agents run in sequence (~1-2 min with good latency) and render a concise **executive brief** plus **statistical appendix**.

---

## 🧬 Crew Breakdown


| Agent                 | Role    | Responsibilities                                       |
| --------------------- | ------- | ------------------------------------------------------ |
| `Business Consultant` | Planner | Defines scope, outlines deliverable, sources context   |
| `Business Writer`     | Author  | Converts outline into human-friendly narrative         |
| `Data Analyst`        | Analyst | Runs quantitative deep-dive, adds charts & data tables |

---

## 📝 Example Output

> **Executive Summary**
> SaaS subscription pricing for SMBs has migrated toward **per-seat plus usage tiers** (avg 14% YoY increase); Freemium-to-Paid conversion sits at **4.3%** vs global B2B median **2.1%**. Key benchmarks…

---

## 🤝 Contributing

We 💖 PRs! Help us make insights even smarter.

### Workflow

1. **Fork** the repo
2. `git checkout -b feat/short-description`
3. Code & run
   ```bash
   pytest           # no unit tests yet – add yours!
   ```
4. Push & open a **Pull Request**

Guidelines

- Follow `black` & `ruff` standards (enforced via pre-commit)
- Write clear docstrings for new agents or tools
- Update `README.md` if you change user-facing behavior
- Open a [GitHub issue](https://github.com/your-org/crewai-business-consultant/issues) for bigger features first

---

## 📄 License

MIT © [Build Fast with AI](https://buildfastwithai.com)

---

Made with ❤️ by the **Build Fast with AI** community
[Website](https://buildfastwithai.com)
