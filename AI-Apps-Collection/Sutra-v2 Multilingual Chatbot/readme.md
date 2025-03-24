# Sutra-v2 Multilingual Chatbot

Sutra-v2 is a multilingual chatbot powered by Sutra AI, designed to support conversations in multiple Indian and international languages. This chatbot is built using Streamlit and LangChain.

## Features
- 🌍 Supports multiple languages, including English, Hindi, Marathi, Telugu, Tamil, Bengali, Gujarati, Kannada, Malayalam, Punjabi, French, and Spanish.
- ⚡ Powered by Sutra AI (`sutra-v2` model).
- 🔐 Secure API key input for authentication.
- 🗣️ Interactive chat experience with chat history.
- 🔄 Option to start a new chat session.

## Installation

1. Clone this repository:
   ```sh
   git clone https://github.com/gen-ai-experiment/AI-Apps-Collection/sutra-v2-chatbot.git
   cd sutra-v2-chatbot
   ```

2. Install dependencies:
   ```sh
   pip install streamlit langchain_openai
   ```

3. Run the application:
   ```sh
   streamlit run app.py
   ```

## Usage

1. Enter your Sutra API Key in the sidebar.
2. Select your preferred conversation language.
3. Start chatting by typing your message in the input box.
4. Click on "🔄 Start New Chat" to reset the conversation.

## Configuration

- **Sutra API Key**: Required to authenticate requests to the Sutra AI API.
- **Language Selection**: Choose from multiple supported languages.
- **Chat History**: Messages persist during the session.

## Dependencies

- `streamlit`
- `langchain_openai`

## License

This project is licensed under the MIT License. See `LICENSE` for more details.



