# MCP Agent Chat - Streamlit App

A Streamlit application that allows you to configure and interact with MCP (Model Context Protocol) agents through a chat interface.

## Features

- **Sidebar Configuration**: Paste any MCP configuration JSON in the sidebar
- **Load Example**: Quick load button for the example configuration from `agents.py`
- **Chat Interface**: Interactive chat with your configured MCP agents
- **Real-time Responses**: Get responses from your agents in real-time
- **Session Management**: Maintains chat history and agent state

## Installation

1. Install the required dependencies:
```bash
pip install -r requirements.txt
```

2. Set up your environment variables:
Create a `.env` file in the project root with your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

1. Run the Streamlit app:
```bash
streamlit run app.py
```

2. The app will open in your browser with the following interface:

### Sidebar Configuration
- **MCP Configuration Text Area**: Paste your MCP server configuration JSON here
- **Submit Button**: Creates an agent with the provided configuration
- **Load Example Button**: Loads the example configuration from `agents.py`
- **Available Servers**: Shows which MCP servers are currently configured

### Main Chat Interface
- **Chat Input**: Ask questions to your configured agent
- **Chat History**: View previous conversations
- **Clear Chat**: Reset the conversation history

## Example Configuration

The app includes an example configuration with three MCP servers:
- **Airbnb**: For searching accommodation
- **Playwright**: For web automation
- **Filesystem**: For file system operations

## Configuration Format

Your MCP configuration should follow this format:
```json
{
  "mcpServers": {
    "server_name": {
      "command": "command_to_run",
      "args": ["arg1", "arg2"],
      "env": {"ENV_VAR": "value"}
    }
  }
}
```

## Requirements

- Python 3.8+
- OpenAI API key
- Node.js (for MCP servers that use npx)
- Required Python packages (see requirements.txt)

## Troubleshooting

1. **Import Errors**: Make sure all dependencies are installed correctly
2. **API Key Issues**: Verify your OpenAI API key is set in the `.env` file
3. **MCP Server Errors**: Check that the MCP server commands and arguments are correct
4. **Permission Issues**: Ensure you have the necessary permissions to run the MCP servers

## License

This project is open source and available under the MIT License. 