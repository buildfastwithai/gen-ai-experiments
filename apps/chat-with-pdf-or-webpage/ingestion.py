# ingestion.py
import asyncio
import tempfile
import os
from typing import Union
from langchain_community.document_loaders import PyPDFLoader, WebBaseLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from llm_setup import get_embedding

def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

async def _ingest_documents_async(source_type: str,
                                  source: Union[str, any],
                                  gemini_api_key: str):
    documents = []

    # 1. Load
    if source_type == "PDF file":
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(source.read())
            tmp_path = tmp.name
        loader = PyPDFLoader(tmp_path)
        documents = loader.load()
        os.remove(tmp_path)
    else:
        loader = WebBaseLoader(source)
        documents = loader.load()

    # 2. Split
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents(documents)

    # 3. Embed & store
    embedding = get_embedding(gemini_api_key)
    await Chroma.afrom_documents(
        chunks,
        embedding=embedding,
        collection_name="kbase",
        persist_directory="./chroma_db",
    )

def ingest_documents(source_type: str, source: Union[str, any], gemini_api_key: str):
    _run_async(_ingest_documents_async(source_type, source, gemini_api_key))