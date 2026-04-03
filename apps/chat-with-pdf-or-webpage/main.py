import streamlit as st
from ingestion import ingest_documents
from rag_pipeline import RAGChatBot
import os
import shutil
import time , sys , subprocess

st.set_page_config(page_title="PDF and Web Chat", layout="wide")


st.title("🤖 Chat with documents / web pages ")
st.subheader("💫 Just add your content and start chatting with it! 💫")

# ---------------- Sidebar ----------------
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
    st.title("⚙️ Configuration")
    gemini_api_key = st.text_input(
        "Enter your Gemini API key:",
        type="password",
        )
    st.session_state["gemini_api_key"] = gemini_api_key

    st.markdown(f"Model: `gemini-2.5-pro`")
    st.markdown(f"Embedding:`gemini-embedding-001`")
    st.markdown("---")
    source_type = st.radio("Choose source type:", ("PDF file", "Website URL"))
    source_value = None
    if source_type == "PDF file":
        source_value = st.file_uploader("Upload PDF", type=["pdf"])
    else:
        source_value = st.text_input("Enter website URL:")

    if st.button("Ingest"):
        if not st.session_state.get("gemini_api_key"):
            st.error("Please enter your Gemini API key first!")
        else:
            with st.spinner("Ingesting documents …"):
                try:
                    # Close any existing bot so DB handles are released
                    if "rag_bot" in st.session_state:
                        try:
                            st.session_state["rag_bot"]
                        except Exception:
                            pass
                        del st.session_state["rag_bot"]


                    # Clear chat history and flags
                    st.session_state.pop("messages", None)
                    st.session_state.pop("kb_ready", None)

                    # Ingest new documents
                    ingest_documents(source_type, source_value, gemini_api_key)
                    st.success("Knowledge base created ✔️")
                    st.session_state["kb_ready"] = True

                    # Restart the app to ensure a clean state
                    st.rerun()
                except Exception as e:
                    st.error(f"Ingestion failed: {e}")
    st.markdown("""
            <div class="sidebar-footer">
            <p>❤️ Built by <a href="https://buildfastwithai.com" target="_blank">Build Fast with AI</a></p>
           
            <p>👨‍💻 <a href="https://github.com/MissLostCodes/Chat_with_pdf_or_webpage" target="_blank">Github</a></p>
            </div>
        
        """, unsafe_allow_html=True)

# ---------------- Main Chat UI ----------------
if st.session_state.get("chat_ended"):
    st.session_state.clear()
    st.rerun()

if st.session_state.get("kb_ready"):

    if "rag_bot" not in st.session_state:
        st.session_state["rag_bot"] = RAGChatBot(st.session_state["gemini_api_key"])


    rag_bot = st.session_state["rag_bot"]

    # Show previous messages
    for msg in st.session_state.get("messages", []):
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # New user input
    if prompt := st.chat_input("Ask anything …"):
        st.session_state.setdefault("messages", []).append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("Thinking …"):
                response = rag_bot.chat(prompt)
            st.markdown(response)
        st.session_state["messages"].append({"role": "assistant", "content": response})

    st.markdown("---")
    st.markdown ("🤩 You can now chat with your content. Ask anything related to it!")

    # Add End Chat button in the chat interface
    if st.button("End Chat", key="end_chat_button"):
        # Clear the session state
        st.session_state.clear()
        st.info("Restarting app from scratch…")
        st.markdown("""
                <meta http-equiv="refresh" content="0">
            """, unsafe_allow_html=True)
        

else:
    st.info("Please configure the knowledge base from the sidebar ⬅️")
