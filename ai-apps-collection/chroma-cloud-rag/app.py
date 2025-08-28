import streamlit as st
from langchain_community.document_loaders import PyPDFLoader
from openai import OpenAI
from typing import Dict
import chromadb
from chromadb.utils import embedding_functions

# ------------------- Streamlit Page Config -------------------
st.set_page_config(page_title="Chroma Cloud RAG", page_icon="📄", layout="wide")
st.title("📄 Chat with your documents — Chroma Cloud RAG")

with st.sidebar:
    # === BRANDING SECTION ===
    st.markdown(
        "<div style='text-align: center; margin: 2px 0;'>"
        "<a href='https://www.buildfastwithai.com/' target='_blank' style='text-decoration: none;'>"
        "<div style='border: 2px solid #e0e0e0; border-radius: 6px; padding: 4px; "
        "background: linear-gradient(145deg, #ffffff, #f5f5f5); "
        "box-shadow: 0 2px 6px rgba(0,0,0,0.1); "
        "transition: all 0.3s ease; display: inline-block; width: 100%;'>"
        "<img src='https://github.com/Shubhwithai/chat-with-qwen/blob/main/company_logo.png?raw=true' "
        "style='width: 100%; max-width: 100%; height: auto; border-radius: 8px; display: block;' "
        "alt='Build Fast with AI Logo'>"
        "</div>"
        "</a>"
    "</div>",
    unsafe_allow_html=True
)


# ------------------- Sidebar -------------------
with st.sidebar:
    st.header("🔐 Keys & Connection")
    openai_key = st.text_input("OpenAI API Key", type="password", placeholder="sk-...")
    chroma_key = st.text_input("Chroma Cloud API Key", type="password", placeholder="chroma_...")

    st.divider()
    st.header("🗃️ Chroma Cloud Settings")
    tenant = st.text_input("Tenant ID", placeholder="your-tenant-id")
    database = st.text_input("Database", placeholder="your-database")
    collection_name = st.text_input("Collection Name", value="rag-docs", help="Use existing or create a new one")

    st.caption("Host/port preset for Chroma Cloud")
    host = "api.trychroma.com"
    port = 8000
    use_ssl = True


# ------------------- Session State -------------------
if "messages" not in st.session_state:
    st.session_state.messages = []

if "rag_collection" not in st.session_state:
    st.session_state.rag_collection = None

if "client" not in st.session_state:
    st.session_state.client = None

# ------------------- Validate Keys -------------------
def validate_keys() -> bool:
    """Ensure OpenAI & Chroma keys are provided."""
    if not openai_key:
        st.warning("⚠️ Please enter your **OpenAI API Key** in the sidebar.")
        return False
    if not chroma_key:
        st.warning("⚠️ Please enter your **Chroma Cloud API Key** in the sidebar.")
        return False
    if not tenant or not database:
        st.warning("⚠️ Please fill in **Tenant ID** and **Database** in the sidebar.")
        return False
    return True

# ------------------- Initialize Clients Safely -------------------
if validate_keys():
    try:
        # Initialize OpenAI client
        st.session_state.client = OpenAI(api_key=openai_key)

        # Initialize Chroma client
        rag_client = chromadb.HttpClient(
            ssl=True,
            host=host,
            tenant=tenant,
            database=database,
            headers={
                'x-chroma-token': f'{chroma_key}'
            }
        )

        # Set up OpenAI embeddings
        openai_ef = embedding_functions.OpenAIEmbeddingFunction(
            api_key=openai_key,
            model_name="text-embedding-3-small"
        )

        # Create or load the collection
        st.session_state.rag_collection = rag_client.get_or_create_collection(
            name=collection_name,
            embedding_function=openai_ef,
        )

        st.sidebar.success("✅ Connected to Chroma Cloud & OpenAI successfully!")

    except Exception as e:
        st.error(f"❌ Failed to connect to Chroma or OpenAI: {e}")
        st.stop()

# ------------------- File Uploader -------------------
if st.session_state.rag_collection:
    uploaded_file = st.sidebar.file_uploader("📤 Upload a PDF to index", type=["pdf"])
    if uploaded_file:
        with open("temp.pdf", "wb") as f:
            f.write(uploaded_file.read())

        loader = PyPDFLoader("temp.pdf", mode="page")
        docs_loaded = loader.load()

        docs = [d.page_content for d in docs_loaded]
        metas = [d.metadata for d in docs_loaded]
        ids = [f"doc-{i}" for i in range(len(docs))]

        try:
            # Insert into Chroma RAG collection
            st.session_state.rag_collection.upsert(
                documents=docs,
                metadatas=metas,
                ids=ids
            )
            st.sidebar.success(f"✅ Indexed {len(docs)} pages into Chroma RAG.")
            st.sidebar.info("Now you can start chatting with your documents!")
        except Exception as e:
            st.error(f"❌ Failed to index documents: {e}")

# ------------------- Retrieval -------------------
def retrieve(query: str, k: int = 3) -> Dict:
    """Retrieve top-k relevant chunks from Chroma."""
    return st.session_state.rag_collection.query(query_texts=[query], n_results=k)

def build_context(results: Dict) -> str:
    docs = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    parts = []
    for i, (d, m) in enumerate(zip(docs, metadatas), start=1):
        parts.append(f"[Doc {i}] {d}\n(Source: {m})")
    return "\n\n".join(parts)

def answer_query(query: str, k: int = 3, model: str = "gpt-4o-mini") -> Dict[str, str]:
    results = retrieve(query, 3)
    context = build_context(results)
    prompt = (
        "You are a helpful assistant. Use the provided context to answer the question.\n"
        "If the answer isn't in the context, say you don't know.\n\n"
        f"Context:\n{context}\n\nQuestion: {query}\nAnswer:"
    )

    chat = st.session_state.client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "Answer strictly based on the given context."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )

    answer = chat.choices[0].message.content
    return {"answer": answer, "context": context}

# ------------------- Chat Interface -------------------

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])


if query := st.chat_input("Ask something about your documents..."):
    if not st.session_state.client or not st.session_state.rag_collection:
        st.error("⚠️ Please enter your keys & connect before chatting.")
    else:
        st.session_state.messages.append({"role": "user", "content": query})
        with st.chat_message("user"):
            st.markdown(query)

        try:
            qa = answer_query(query, 3)  # ✅ Pass correct top_k value
            answer = qa["answer"]

            st.session_state.messages.append({"role": "assistant", "content": answer})
            with st.chat_message("assistant"):
                st.markdown(answer)

        except Exception as e:
            st.error(f"❌ Error fetching answer: {e}")
