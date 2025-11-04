# Personal Finance Management System

A comprehensive AI-powered financial assistant built with Agno v2.0 that helps you manage your personal finances through intelligent agents.

## Overview

This application provides two specialized AI agents:
- **Personal Finance Assistant**: Expert financial advisor for budgeting, investments, and financial planning
- **Budget Tracker**: Specialized in expense tracking and budget management

## Features

- 🤖 **Dual AI Agents**: Specialized agents for different financial tasks
- 💾 **Persistent Memory**: SQLite database storage for conversation history
- 🔍 **Web Search**: DuckDuckGo integration for market research
- 📁 **File Management**: File tools for document handling
- 🌐 **Web Interface**: FastAPI-based web application
- 📊 **Personalized Advice**: Context-aware recommendations based on conversation history

## Prerequisites

Before running the application, ensure you have:

1. **Python 3.8+** installed
2. **Agno v2.0** framework
3. **OpenAI API Key** (for GPT-4 access)

## Installation

### Step 1: Clone or Download the Project

```bash
# If using git
git clone <your-repository-url>
cd <project-directory>

# Or simply ensure you have the finance_assistant_app.py file
```

### Step 2: Install Dependencies

```bash
pip install agno
```

### Step 3: Set Up Environment Variables

Create a `.env` file in your project directory or set environment variables:

```bash
# Required for OpenAI integration
export OPENAI_API_KEY="your-openai-api-key-here"
```

## Quick Start

### Step 1: Run the Application

```bash
python finance_assistant_app.py
```

### Step 2: Access the Web Interface

Open your browser and navigate to:
```
http://localhost:8001
```

### Step 3: Start Chatting

You'll see the AgentOS interface where you can:
- Chat with the **Personal Finance Assistant** for general financial advice
- Use the **Budget Tracker** for expense tracking and budget management

## Usage Examples

### Personal Finance Assistant

Ask questions like:
- "Help me create a retirement savings plan"
- "What's the current state of the stock market?"
- "Should I invest in index funds or individual stocks?"
- "How much should I save for an emergency fund?"

### Budget Tracker

Use for tasks like:
- "Track my monthly expenses"
- "Analyze my spending patterns"
- "Create a budget for next month"
- "Show me where I can cut costs"

## File Structure

```
project-directory/
├── finance_assistant_app.py    # Main application file
├── README.md                   # This file
├── finance_assistant.db        # SQLite database (created automatically)
├── budget_tracker.db          # SQLite database (created automatically)
└── .env                       # Environment variables (create this)
```

## Configuration

### Customizing Agents

You can modify the agents in `finance_assistant_app.py`:

1. **Change AI Model**: Replace `OpenAIChat(id="gpt-4.1")` with other models
2. **Add Tools**: Include additional tools from the Agno toolkit
3. **Modify Instructions**: Update the `instructions` list for each agent
4. **Change Database**: Modify database file names or use different database types

### Port Configuration

To run on a different port, modify the last line:
```python
uvicorn.run(app, host="0.0.0.0", port=YOUR_PORT)
```

## Database Storage

The application creates two SQLite databases:
- `finance_assistant.db`: Stores conversations with the Personal Finance Assistant
- `budget_tracker.db`: Stores conversations with the Budget Tracker

These databases enable:
- Conversation history persistence
- Personalized recommendations
- Context-aware responses

## Troubleshooting

### Common Issues

1. **OpenAI API Key Error**
   ```
   Solution: Ensure your OPENAI_API_KEY environment variable is set correctly
   ```

2. **Port Already in Use**
   ```
   Solution: Change the port number in the uvicorn.run() call
   ```

3. **Module Import Errors**
   ```
   Solution: Ensure Agno v2.0 is properly installed: pip install agno
   ```

### Getting Help

If you encounter issues:
1. Check the console output for error messages
2. Verify your OpenAI API key is valid and has sufficient credits
3. Ensure all dependencies are installed correctly

## Security Notes

- Never commit your `.env` file or API keys to version control
- The SQLite databases contain conversation history - handle with care
- Consider using environment-specific configurations for production deployment

## Next Steps

Consider extending the application with:
- Additional financial tools (stock APIs, banking integrations)
- More specialized agents (tax advisor, investment analyst)
- Enhanced UI customization
- Export functionality for financial reports
- Integration with external financial services

## Support

For issues related to:
- **Agno Framework**: Check the official Agno documentation
- **OpenAI API**: Refer to OpenAI's documentation
- **This Application**: Review the code comments and error messages

---

**Disclaimer**: This application provides general financial information and should not be considered as professional financial advice. Always consult with qualified financial advisors for important financial decisions.
