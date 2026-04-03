# Function Gemma Tool Calling Examples

A comprehensive collection of examples demonstrating tool calling capabilities with Google's Function Gemma model using the Ollama Python library.

## Overview

This repository contains 5 different examples showcasing various use cases for function calling with LLMs. Each example demonstrates how to define tools (functions), pass them to the model, and handle multi-turn conversations with tool execution.

## Prerequisites

- **Python**: >= 3.11
- **Ollama**: Installed and running locally
- **Function Gemma Model**: Downloaded via Ollama

### Installation

1. **Install Ollama** (if not already installed):
   ```bash
   # macOS
   brew install ollama
   
   # Or download from https://ollama.ai
   ```

2. **Pull the Function Gemma model**:
   ```bash
   ollama pull functiongemma
   ```

3. **Install Python dependencies**:
   The script uses inline dependency management with PEP 723. Simply run with `uv`:
   ```bash
   uv run tools.py
   ```

   Or install dependencies manually:
   ```bash
   pip install ollama rich
   ```

## Examples

### 1. Calculator Operations 🧮

Demonstrates multi-step mathematical operations with chained tool calls.

**Tools:**
- `add(a, b)` - Addition
- `multiply(a, b)` - Multiplication  
- `power(base, exponent)` - Exponentiation

**Example Query:** *"What is 15 plus 27, then multiply that by 3?"*

**Features:**
- Multi-turn conversation handling
- Sequential tool execution
- Mathematical reasoning

---

### 2. Database Query Simulation 🗄️

Simulates database operations with user management.

**Tools:**
- `get_user_by_id(user_id)` - Retrieve user by ID
- `search_users_by_name(name)` - Partial name matching
- `get_users_by_role(role)` - Filter by role

**Example Query:** *"Find all admin users and show me their emails"*

**Features:**
- Mock database with sample users
- Complex filtering operations
- JSON response formatting

---

### 3. File Operations 📁

Simulates file system interactions.

**Tools:**
- `list_files(directory)` - List directory contents
- `get_file_info(filepath)` - Get file metadata
- `search_files_by_type(file_type)` - Search by extension

**Example Query:** *"Show me all PDF files and their sizes"*

**Features:**
- Mock file system
- File metadata handling
- Type-based filtering

---

### 4. E-commerce Product Search 🛒

Product search and inventory management system.

**Tools:**
- `search_products(query)` - Search by product name
- `get_products_by_category(category)` - Filter by category
- `check_stock(product_id)` - Check inventory levels

**Example Query:** *"What electronics do you have under $50?"*

**Features:**
- Product catalog management
- Price filtering
- Stock tracking

---

### 5. Travel Booking Assistant ✈️

Complex multi-tool scenario for travel planning.

**Tools:**
- `search_flights(origin, destination)` - Find available flights
- `search_hotels(city, max_price)` - Search accommodations
- `calculate_trip_cost(flight_price, hotel_price, nights)` - Cost calculation

**Example Query:** *"I want to fly from New York to London and stay for 3 nights. What are my options under $1200 total?"*

**Features:**
- Multi-criteria search
- Budget calculations
- Complex reasoning across multiple tools

## Usage

### Running Examples

1. **Edit `tools.py`** and uncomment the example you want to run:

```python
if __name__ == '__main__':
  # Uncomment one of these to run:
  example_calculator()
  # example_database()
  # example_file_operations()
  # example_ecommerce()
  # example_travel()
```

2. **Run the script**:

```bash
# Using uv (recommended)
uv run tools.py

# Or with Python directly
python tools.py
```

### Output Format

The examples use the `rich` library for beautiful terminal output with:
- 🟡 **Yellow** - Tool calls being made
- 🟢 **Green** - Tool execution results
- 🔵 **Cyan** - Example headers
- 🟣 **Magenta** - Main title

## How It Works

### 1. Define Tools

Tools are Python functions with proper docstrings that describe their purpose and parameters:

```python
def get_weather(city: str) -> str:
  """
  Get the current weather for a city.
  
  Args:
    city: The name of the city
  
  Returns:
    A string describing the weather
  """
  return json.dumps({'city': city, 'temperature': 22, 'unit': 'celsius'})
```

### 2. Create Messages

Set up the conversation with a user query:

```python
messages = [{'role': 'user', 'content': 'What is the weather in Paris?'}]
```

### 3. Call the Model

Pass tools to the model and get a response:

```python
response = chat(model, messages=messages, tools=[get_weather])
```

### 4. Execute Tools

Check if the model wants to call a tool and execute it:

```python
if response.message.tool_calls:
  tool_call = response.message.tool_calls[0]
  result = get_weather(**tool_call.function.arguments)
  
  # Add results back to conversation
  messages.append(response.message)
  messages.append({'role': 'tool', 'content': result})
  
  # Get final response
  final = chat(model, messages=messages)
```

## Key Concepts

### Multi-Turn Conversations

Some queries require multiple tool calls. The examples use iteration loops to handle this:

```python
max_iterations = 5
for i in range(max_iterations):
  response = chat(model, messages=messages, tools=tools)
  # Handle tool calls...
```

### Tool Selection

The model automatically selects the appropriate tool(s) based on:
- Function names
- Docstring descriptions
- Parameter types and descriptions
- User query context

### JSON Responses

All tools return JSON-formatted strings for structured data exchange:

```python
return json.dumps({'key': 'value', 'data': [1, 2, 3]})
```

## Customization

### Adding Your Own Example

1. Create a new function following the pattern:

```python
def example_my_feature():
  """Description of what this example does."""
  
  def my_tool(param: str) -> str:
    """Tool description."""
    return json.dumps({'result': 'data'})
  
  tools = [my_tool]
  messages = [{'role': 'user', 'content': 'Your query here'}]
  
  response = chat(model, messages=messages, tools=tools)
  # Handle response...
```

2. Add it to the main block:

```python
if __name__ == '__main__':
  # example_my_feature()
```

### Modifying Mock Data

Each example contains mock data at the top of the function. Customize it to test different scenarios:

```python
products = [
  {'id': 101, 'name': 'Custom Product', 'price': 99.99},
  # Add more items...
]
```

## Troubleshooting

### Model Not Found

```bash
Error: model 'functiongemma' not found
```

**Solution:** Pull the model first:
```bash
ollama pull functiongemma
```

### Ollama Not Running

```bash
Error: connection refused
```

**Solution:** Start Ollama:
```bash
ollama serve
```

### Dependencies Missing

```bash
ModuleNotFoundError: No module named 'ollama'
```

**Solution:** Install dependencies:
```bash
pip install ollama rich
# or
uv run tools.py
```

## Best Practices

1. **Clear Docstrings**: Always provide detailed docstrings for tools - the model uses these to understand when to call them

2. **Type Hints**: Use proper type hints for parameters and return values

3. **JSON Returns**: Return structured JSON data for complex results

4. **Error Handling**: Include error cases in your tool responses

5. **Iteration Limits**: Set reasonable `max_iterations` to prevent infinite loops

6. **Descriptive Names**: Use clear, descriptive function and parameter names

## Resources

- [Ollama Documentation](https://ollama.ai/docs)
- [Function Gemma Model Card](https://ollama.ai/library/functiongemma)
- [Ollama Python Library](https://github.com/ollama/ollama-python)
- [Rich Terminal Library](https://rich.readthedocs.io/)

## License

This is example code for educational purposes. Feel free to use and modify as needed.

## Contributing

To add more examples:
1. Follow the existing pattern
2. Include clear documentation
3. Add mock data for testing
4. Test with various queries

---

**Happy coding! 🚀**
