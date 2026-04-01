
from langchain_chroma import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from llm_setup import get_embedding, get_llm
import gc
import time

class RAGChatBot:
    def __init__(self, api_key: str):
        self.embedding = get_embedding(api_key)
        self.vectorstore = Chroma(
            collection_name="kbase",
            embedding_function=self.embedding,
            persist_directory="./chroma_db",
        )
        self.retriever = self.vectorstore.as_retriever(search_kwargs={"k": 4})
        self.llm = get_llm(api_key)

        system_prompt = (
            "You are a helpful assistant that answers questions strictly using the provided context. "
            "If the context does not contain the answer, say you don't know.\n\n"
            "{context}"
            "dont use phrases like 'I don't know' or 'According to the context' or 'Based on the context' "
        )
        prompt = ChatPromptTemplate.from_messages(
            [("system", system_prompt), ("human", "{input}")]
        )
        combine_chain = create_stuff_documents_chain(self.llm, prompt)
        self.chain = create_retrieval_chain(self.retriever, combine_chain)

        self.history = []

    def chat(self, question: str) -> str:
        response = self.chain.invoke({"input": question, "chat_history": self.history})
        self.history.append(("human", question))
        self.history.append(("assistant", response["answer"]))
        return response["answer"]


    def close(self):
        try:
            if hasattr(self.vectorstore, "persist"):
                self.vectorstore.persist()
            if hasattr(self.vectorstore, "client") and hasattr(self.vectorstore.client, "close"):
                self.vectorstore.client.close()
            time.sleep(1.5)  # Let OS settle
            del self.vectorstore  # Explicitly delete object
            gc.collect()  # Force garbage collection to release file locks
        except Exception as e:
            print(f"[WARN] Could not close vectorstore: {e}")

