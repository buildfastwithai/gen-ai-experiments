# Marketing Content Generator

A Streamlit app that uses Baseten's LLM inferencing to generate marketing content such as landing pages, announcement pamphlets, and advertisement banners. The app provides a chat-style interface for iterative design improvements and live HTML/CSS/JS previews.

## Features
- Generate clean HTML/CSS/JS code for landing pages, banners, and announcements
- AI-powered design improvements based on chat history
- Live preview of generated content within the app
- Download generated code with a single click
- Iterative improvements via chat-style prompts

## How It Works
1. **Enter your Baseten API Key** in the sidebar.
2. **Select** the type of content you want to create (Landing Page, Announcement Pamphlet, Advertisement Banner).
3. **Describe your requirements** in the chat input box.
4. The app will generate and display the HTML/CSS/JS code, render a live preview, and allow you to download the result.
5. You can continue to refine your design by sending more prompts.

## Requirements
- Python 3.8+
- [Streamlit](https://streamlit.io/)
- [OpenAI Python SDK](https://github.com/openai/openai-python)
- [Baseten API Key](https://app.baseten.co/overview)

Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the App
```bash
streamlit run app.py
```

## Tips
- Provide clear and detailed descriptions for better results.
- Use iterative prompts to refine designs.
- Select the right type of content from the dropdown.
- Keep your Baseten API key handy.

## About
Built with ❤️ using Streamlit & Baseten Inference.

---

**Links:**
- [Baseten](https://www.baseten.co/)
- [Build Fast with AI](https://www.buildfastwithai.com/)
