# Simple RAG Application with Chroma Cloud

A simple Retrieval Augmented Generation (RAG) application built with Chroma Cloud and OpenAI.

## Features

- ✅ Document ingestion and storage in Chroma Cloud
- ✅ Semantic search using OpenAI embeddings
- ✅ Question answering using retrieved context
- ✅ Simple and clean API
- ✅ Metadata support for documents

## Prerequisites

1. **Chroma Cloud Account**: Sign up at [trychroma.com](https://www.trychroma.com/)
2. **OpenAI API Key**: Get your API key from [OpenAI Platform](https://platform.openai.com/)
3. **Python 3.8+**: Make sure you have Python installed

## Installation

1. **Clone or download the files** to your local machine

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables**:
   
   Create a `.env` file in the same directory:
   ```bash
   # Chroma Cloud credentials
   CHROMA_TOKEN=your_chroma_cloud_token
   CHROMA_TENANT=your_tenant_id
   CHROMA_DATABASE=your_database_name
   
   # OpenAI API key
   OPENAI_API_KEY=your_openai_api_key
   ```
   
   Or set them directly in your terminal:
   ```bash
   export CHROMA_TOKEN="your_chroma_cloud_token"
   export CHROMA_TENANT="your_tenant_id"
   export CHROMA_DATABASE="your_database_name"
   export OPENAI_API_KEY="your_openai_api_key"
   ```

## Usage

### Basic Usage

Run the example application:
```bash
python simple_rag_app.py
```

### Using the RAG Class

```python
from simple_rag_app import SimpleRAGApp

# Initialize the app
rag_app = SimpleRAGApp(
    chroma_token="your_token",
    openai_api_key="your_key",
    tenant="your_tenant",
    database="your_database"
)

# Add documents
documents = [
    "Machine learning is a subset of AI that learns from data.",
    "Python is a popular programming language for data science."
]

rag_app.add_documents(documents)

# Ask questions
answer = rag_app.answer_question("What is machine learning?")
print(answer)
```

### API Methods

- **`add_documents(documents, metadatas=None, ids=None)`**: Add documents to the collection
- **`query_documents(query, n_results=3)`**: Search for similar documents
- **`answer_question(question, n_results=3)`**: Get an AI-generated answer using RAG
- **`get_collection_info()`**: Get information about the current collection

## How It Works

1. **Document Ingestion**: Documents are embedded using OpenAI's text-embedding-3-small model and stored in Chroma Cloud
2. **Retrieval**: When you ask a question, the system finds the most relevant documents using semantic search
3. **Generation**: The retrieved context is used to generate an accurate answer using GPT-4o-mini

## Example Output

```
✅ RAG application initialized successfully!
✅ Added 6 documents to collection

📊 Collection Info: {'collection_name': 'simple_rag_collection', 'document_count': 6, 'tenant': 'your-tenant-id', 'database': 'your-database'}

🤔 Testing RAG with sample questions:
==================================================

❓ Question: Where are oranges commonly grown?
💡 Answer: Oranges are commonly grown in warm regions, particularly in Florida, which is one of the largest producers of citrus fruits in the United States.
------------------------------

❓ Question: What is machine learning?
💡 Answer: Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed.
------------------------------
```

## Customization

- **Change embedding model**: Modify `EMBEDDING_MODEL` in `config.py`
- **Change chat model**: Modify `CHAT_MODEL` in `config.py`
- **Adjust retrieval**: Change `DEFAULT_N_RESULTS` in `config.py`
- **Modify prompts**: Edit the system and user prompts in the `answer_question` method

## Troubleshooting

- **Import errors**: Make sure you've installed all requirements with `pip install -r requirements.txt`
- **Authentication errors**: Verify your Chroma Cloud token and OpenAI API key
- **Collection errors**: Check that your tenant ID and database name are correct

## Next Steps

- Add document chunking for longer documents
- Implement document deletion and updates
- Add support for different file formats (PDF, DOCX, TXT)
- Create a web interface using Streamlit or Flask
- Add document similarity scoring and filtering

## License

This project is open source and available under the MIT License.