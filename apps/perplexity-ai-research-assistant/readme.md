# Perplexity AI Research Assistant

This Streamlit app serves as a research assistant powered by the **Sonar Deep Research** model through the **Perplexity AI** API. It helps you get detailed, citation-backed answers to complex research questions in real-time.

## 🚀 Features
- **Interactive Chat Interface**: Ask research questions and get detailed responses.
- **Chat History Management**: View past interactions and preserve them across sessions.
- **Response Metadata**: See response time and model information.
- **Customizable UI**: Dark-themed chat bubbles and responsive layout.
- **API Key Management**: Securely enter and store your Perplexity AI API key.

## 🛠️ Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/gen-ai-experiments/perplexity-ai-research-assistant.git
cd perplexity-ai-research-assistant
```

### 2. Create a virtual environment (optional but recommended)
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Get a Perplexity AI API Key
1. Create an account on [Perplexity AI](https://www.perplexity.ai/)
2. Navigate to your account settings
3. Generate a new API key

### 5. Run the app
```bash
streamlit run app.py
```

## ⚙️ Configuration

In the Streamlit sidebar:
1. **Enter your API key** to enable the chat functionality.
2. **Start a new chat** to reset the conversation history.

## 📝 Usage
1. Launch the app in your browser.
2. Enter your Perplexity AI API key.
3. Type your research question in the chat input box.
4. View responses with citations and metadata.

## 📂 File Structure
```
├── app.py                    # Main Streamlit app
├── chat_history.json         # Chat history (saved locally)
├── requirements.txt          # Python dependencies
└── README.md                 # Project documentation
```

## 📘 Tech Stack
- **Frontend**: Streamlit
- **LLM**: Perplexity AI (Sonar Deep Research Model)
- **Python Libraries**: `langchain`, `streamlit`, `datetime`, `json`

## 🤖 Future Improvements
- Add support for multiple research models.
- Implement automatic citation extraction.
- Enhance error handling and UI feedback.

## 👩‍💻 Contributing
Pull requests are welcome! If you have suggestions or want to improve the app, feel free to fork the repo and create a PR.

## 📄 License
This project is licensed under the MIT License.

---

Built with ❤️ by [Build Fast with AI](https://buildfastwithai.com/genai-course)

