# ⚖️ Cerebras vs OpenAI Comparator

A Streamlit-based web application that allows users to compare responses, latency, and cost between Cerebras and OpenAI language models in real-time.

## 🚀 Features

- Side-by-side comparison of model responses
- Real-time latency measurements
- Cost estimation based on token usage
- Support for multiple model variants from both providers
- Concurrent API calls for faster results
- Interactive chat-like interface
- Dark/light theme support

## 🛠️ Models Supported

### Cerebras Models
- llama-4-scout-17b-16e-instruct
- llama-3.3-70b-instruct
- llama-3.1-8b-instruct

### OpenAI Models
- gpt-4o-mini
- gpt-4o
- gpt-4o-mini-translate

## 📋 Requirements

```
asyncio
concurrent-log-handler
openai
cerebras-cloud-sdk
typing-extensions
streamlit
```

## 🚀 Getting Started

1. Clone the repository
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Get your API keys:
   - [Cerebras API Key](https://chat.cerebras.ai/)
   - [OpenAI API Key](https://platform.openai.com/api-keys)

4. Run the application:
   ```bash
   streamlit run app.py
   ```

## 💻 Usage

1. Enter your Cerebras and OpenAI API keys in the sidebar
2. Select the desired models for comparison
3. Type your prompt in the chat input
4. View the side-by-side comparison of:
   - Model responses
   - Latency metrics
   - Cost estimates
   - Performance winner

## 🎨 Features

- **Real-time Comparison**: Get immediate side-by-side comparisons of model outputs
- **Performance Metrics**: Track latency and cost metrics for each response
- **Winner Detection**: Automatic determination of the better performing model based on speed and cost
- **Responsive Design**: Supports both light and dark themes
- **Session History**: Maintains chat history during the session
- **Error Handling**: Graceful handling and display of API errors

## 🔐 Security

- API keys are stored only for the current session
- Keys are never saved to disk
- Used only for direct API calls

## 📝 Note

Cost estimates are approximate and based on token usage. Actual costs may vary depending on the specific API pricing and usage patterns.