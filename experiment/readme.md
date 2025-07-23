# Experiment Notebooks

This directory contains a curated collection of Jupyter notebooks and experiments exploring a wide range of GenAI, LLM, and agentic workflows, including question generation, web scraping, vision models, safety guardrails, and more. Each subfolder focuses on a specific tool, framework, or use case, providing hands-on examples and integration recipes.

---

## 📁 Directory Overview

### 1. `educhain-experiments/`
- **Purpose:** Automated question generation and management using the Educhain library.
- **Key Notebook:** `Question_generation_using_educhain.ipynb` – Shows how to generate, display, and manage MCQs with custom schemas and Supabase integration.
- **Features:** Custom Pydantic models, prompt templates, MCQ generation, option shuffling, database push.
- **See:** `README`

### 2. `Guardrails/`
- **Purpose:** Experiments with LLM safety, policy enforcement, and discriminator guardrails using NemoGuardrails and LangChain.
- **Key Notebooks:**
  - `Introduction_to_Guardrails.ipynb` – Intro to NemoGuardrails for LLM safety.
  - `Using_discriminator_guardrails_v2.ipynb` – Advanced guardrails and discriminator flows.
- **Features:** YAML/colang config, self-check flows, OpenAI integration.
- **See:** `README`

### 3. `web-based/`
- **Purpose:** Web automation, scraping, and search using LLMs and agentic tools.
- **Key Notebooks:**
  - `ScrapeGraphAI_demo.ipynb` – Demo of ScrapeGraphAI for structured web scraping with LLMs.
  - `browser-use.ipynb` – Using the browser-use agent for web navigation and automation.
  - `google_search_results_Demo.ipynb` – Integrating Google Search with LangChain agents.
  - `WebScraping_with_GenAI.ipynb` – Comparing traditional and AI-powered web scraping.
- **Features:** LLM-driven scraping, agentic browsing, search result integration.

### 4. `image_processing/`
- **Purpose:** Experiments with vision models and image processing using LLMs.
- **Key Notebook:** `Image_processing_using_Vision-Models.ipynb` – Compares GPT-4o, Claude-3-Opus, and Gemini-Pro on image-based tasks.

### 5. `instructor/`
- **Purpose:** Structured output from LLMs using the Instructor library.
- **Key Notebook:** `instructor.ipynb` – Shows structured MCQ creation, resume parsing, and integration with Educhain.

### 6. `medical-bot/`
- **Purpose:** Building a medical chatbot using Mistral7 and LlamaIndex.
- **Key Notebook:** `Medical_Bot_using_Mistral7_and_llamaindex.ipynb` – End-to-end example of a medical Q&A bot.

### 7. `sutra/`
- **Purpose:** Getting started with SUTRA, a multilingual LLM.
- **Key Notebook:** `Getting_Started_with_Sutra.ipynb` – Demos SUTRA’s multilingual capabilities and API usage.

### 8. `ollama-chat/`
- **Purpose:** Chatbot experiments using Ollama.
- **Key File:** `ollama_chat.py` – Python script for running a chat interface with Ollama.

### 9. `gardio/`
- A folder for experiments and demos using Gradio and Ollama for chat-based AI interfaces.


---

## 🛠️ Technologies Used
- Python, Jupyter Notebook
- GenAI libraries: Educhain, Instructor, SUTRA, ScrapeGraphAI, browser-use, LlamaIndex, LangChain, NemoGuardrails, etc.
- OpenAI, Anthropic, Gemini, and other LLM APIs
- Supabase (for database integration)
- Vision models and web scraping tools

---

## ▶️ How to Use
1. Browse to the subdirectory of interest.
2. Open the relevant notebook(s) in Jupyter or Google Colab.
3. Follow the instructions in each notebook to install dependencies and run experiments.
4. Refer to subdirectory READMEs (where available) for more details.

---

## 📄 License
This directory follows the main repository's MIT License. See the root `LICENSE` file for details.

---

*Let me know if you want to add, remove, or expand on any section! If you’d like this written to a file, just say so.*