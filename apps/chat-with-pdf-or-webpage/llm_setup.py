# llm_setup.py
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

def get_llm(api_key: str):
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-pro",
        google_api_key=api_key,
        temperature=0.3,

    )

def get_embedding(api_key: str):
    return GoogleGenerativeAIEmbeddings(
        model="gemini-embedding-001",
        google_api_key=api_key,
    )