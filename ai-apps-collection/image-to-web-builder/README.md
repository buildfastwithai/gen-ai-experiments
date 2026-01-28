# 🎨 Image to Web Builder

Transform your website screenshots into working HTML code using AI. Upload up to 3 images and get a fully responsive, modern HTML website in seconds.

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Streamlit](https://img.shields.io/badge/Streamlit-1.28+-red.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## ✨ Features

- **Multi-Image Support** - Upload up to 3 website screenshots
- **AI-Powered Generation** - Uses powerful LLMs via OpenRouter
- **Instant Preview** - See your generated website live
- **Responsive Design** - All generated code is mobile-friendly
- **Download Ready** - Export your HTML with one click
- **Multiple AI Models** - Choose from Kimi, Gemini, or GPT-4o

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- OpenRouter API Key ([Get one here](https://openrouter.ai))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Shubhwithai/gen-ai-experiments.git
   cd gen-ai-experiments/ai-apps-collection/image-to-web-builder
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the app**
   ```bash
   streamlit run app.py
   ```

4. **Open your browser** and navigate to `http://localhost:8501`

## 📖 How to Use

1. Enter your OpenRouter API key in the sidebar
2. Select your preferred AI model
3. Upload 1-3 website screenshots
4. Describe what you want to build in the chat
5. Get your generated HTML code instantly
6. Preview the result and download the HTML file

## 🤖 Supported Models

| Model | Provider | Best For |
|-------|----------|----------|
| `moonshotai/kimi-k2.5` | Moonshot AI | Complex layouts |
| `google/gemini-2.0-flash-001` | Google | Fast generation |
| `openai/gpt-4o` | OpenAI | High accuracy |

## 📁 Project Structure

```
image-to-web-builder/
├── app.py              # Main Streamlit application
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

## 🛠️ Technologies Used

- **Streamlit** - Web application framework
- **OpenAI SDK** - API client for OpenRouter
- **OpenRouter** - AI model gateway

## 💡 Tips for Best Results

- Use high-quality, clear screenshots
- Include all sections of the page you want to recreate
- Be specific in your prompts about colors, fonts, and layouts
- Use the chat to iterate and refine the output

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with [Streamlit](https://streamlit.io)
- Powered by [OpenRouter](https://openrouter.ai)
- Created by [Build Fast with AI](https://www.buildfastwithai.com/)
