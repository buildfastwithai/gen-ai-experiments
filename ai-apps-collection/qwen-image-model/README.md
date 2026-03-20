# AI Presentation Generator

AI-powered tool that converts a topic into presentation slide images using **Gemini** for prompt generation and **Qwen Image (fal.ai)** for image generation.

The project supports both:
- Command Line Interface (CLI)
- Web UI using Streamlit

---

## Features

- Generate slide prompts using Google Gemini
- Convert prompts into images using Qwen Image (fal.ai)
- Automatically download slide images
- Optional PDF assembly
- Two interfaces:
  - CLI (`cli.py`)
  - Streamlit web app (`app.py`)
- Modular architecture with shared core logic

---

## Project Structure

```
ai-presentation-generator/
│
├── app.py          # Streamlit web interface
├── cli.py          # Command-line interface
├── logic.py        # Core generation logic
├── slides/         # Generated slide images
├── requirements.txt
├── .env.example
└── README.md
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/ai-presentation-generator.git
cd ai-presentation-generator
```

### 2. Create virtual environment

```bash
python -m venv venv
```

Activate it:

**Windows**

```bash
venv\Scripts\activate
```

**Mac/Linux**

```bash
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

---

## Environment Variables

Create a `.env` file:

```
GEMINI_API_KEY=your_gemini_api_key
FAL_KEY=your_fal_ai_key
```

---

## Usage

### Run CLI version

```bash
python cli.py
```

Example:

```bash
python cli.py --title "AI in Healthcare" --context "Applications of AI in diagnosis"
```

---

### Run Streamlit App

```bash
streamlit run app.py
```

This launches a web interface where you can generate slides interactively.

---

## Output

Generated slides are saved in the `slides/` folder.

Example output:

```
slides/
slide_1.png
slide_2.png
slide_3.png
...
```

---

## Tech Stack

- Python
- Gemini API
- Qwen Image (fal.ai)
- Streamlit

---
