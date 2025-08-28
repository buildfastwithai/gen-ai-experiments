# Personalized AI Search Assistant

A Streamlit application that demonstrates a personalized search assistant using Mem0, Tavily, and LangChain.

## Features

- Personalized search results based on user context
- Chat interface for natural interaction
- Memory management (add, view, clear user memories)
- Integration with OpenAI's GPT models

## Prerequisites

1. Python 3.8 or higher
2. API keys for:
   - OpenAI
   - Mem0
   - Tavily

## Installation

1. Clone this repository or download the files
2. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

1. Run the Streamlit app:
   ```bash
   streamlit run streamlit_app.py
   ```

2. Enter your API keys in the sidebar:
   - OpenAI API Key
   - Mem0 API Key
   - Tavily API Key

3. Add some memories about yourself using the "Add Memory" section in the sidebar

4. Start chatting with the assistant in the main chat interface

## How It Works

1. The app stores user context and preferences in Mem0
2. When you ask a question, it retrieves relevant context from Mem0
3. It uses Tavily to perform web searches optimized for LLMs
4. The LangChain agent synthesizes personalized responses based on both the search results and user context

## Example Memories

To get started, you might add memories like:
- "I live in New York City"
- "I'm a vegetarian"
- "I'm interested in technology and AI"
- "I prefer concise answers"