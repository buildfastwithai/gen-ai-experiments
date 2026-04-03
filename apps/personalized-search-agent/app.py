import os
import streamlit as st
from mem0 import MemoryClient
from langchain_tavily import TavilySearch
from langchain.agents import create_openai_tools_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage

# ------------------ Streamlit Config ------------------
st.set_page_config(page_title="🧠 Personalized AI Search", page_icon="🤖", layout="wide")
st.title("🧠 Personalized AI Search Assistant")
st.markdown("#### Powered by Mem0, Tavily, and LangChain")

# ------------------ Sidebar: API Keys ------------------
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
    
with st.sidebar:
    st.header("🔑 API Keys")
    openai_api_key = st.text_input("OpenAI API Key", type="password")
    mem0_api_key = st.text_input("Mem0 API Key", type="password")
    tavily_api_key = st.text_input("Tavily API Key", type="password")
    user_id = st.text_input("User ID", value="streamlit_user")

    if openai_api_key:
        os.environ["OPENAI_API_KEY"] = openai_api_key
    if mem0_api_key:
        os.environ["MEM0_API_KEY"] = mem0_api_key
    if tavily_api_key:
        os.environ["TAVILY_API_KEY"] = tavily_api_key


# ------------------ Initialize Components ------------------
@st.cache_resource
def initialize_components(openai_key, mem0_key, tavily_key):
    """Initialize LLM, memory client, Tavily, and agent executor."""
    if not openai_key or not mem0_key or not tavily_key:
        return None, None, None, None

    try:
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
        mem0_client = MemoryClient()
        tavily_search = TavilySearch(max_results=10, search_depth="advanced")

        # Prompt Template
        prompt = ChatPromptTemplate.from_messages([
            ("system", """
                You are a personalized AI search assistant.
                USER CONTEXT: {user_context}
                Tailor results to preferences like dietary needs, family context, and lifestyle.
            """),
            MessagesPlaceholder("messages"),
            MessagesPlaceholder("agent_scratchpad"),
        ])

        agent = create_openai_tools_agent(
            llm=llm,
            tools=[tavily_search],
            prompt=prompt
        )

        executor = AgentExecutor(
            agent=agent,
            tools=[tavily_search],
            return_intermediate_steps=True
        )

        return llm, mem0_client, tavily_search, executor
    except Exception as e:
        st.error(f"⚠️ Initialization failed: {str(e)}")
        return None, None, None, None

if openai_api_key and mem0_api_key and tavily_api_key:
    # ------------------ Load Components ------------------
    llm, mem0_client, tavily_search, executor = initialize_components(
        openai_api_key, mem0_api_key, tavily_api_key
    )

    # ------------------ Memory Management ------------------
    if all([openai_api_key, mem0_api_key, tavily_api_key]):
        st.sidebar.divider()
        st.sidebar.header("🧠 Memory Management")

        if mem0_client is None:
            st.sidebar.error("⚠️ Memory client not initialized. Check your Mem0 API Key.")
        else:
            memory_action = st.sidebar.selectbox("Action", ["Add Memory", "View Memories", "Clear Memories"])

            # Add Memory
            if memory_action == "Add Memory":
                new_memory = st.sidebar.text_input("Enter new memory")
                if st.sidebar.button("Add") and new_memory:
                    try:
                        mem0_client.add([{"role": "user", "content": new_memory}], user_id=user_id)
                        st.sidebar.success("✅ Memory added successfully!")
                    except Exception as e:
                        st.sidebar.error(f"❌ Failed to add memory: {str(e)}")

            # View Memories
            elif memory_action == "View Memories":
                try:
                    filters = {"AND": [{"user_id": user_id}]}
                    memories = mem0_client.get_all(version="v2", filters=filters, page=1, page_size=50)
                    if memories and memories["count"] > 0:
                        st.sidebar.markdown("### Stored Memories:")
                        for memory in memories["results"]:
                            st.sidebar.markdown(f"- {memory['memory']}")
                    else:
                        st.sidebar.info("ℹ️ No memories found.")
                except Exception as e:
                    st.sidebar.error(f"❌ Failed to fetch memories: {str(e)}")

            # Clear Memories
            elif memory_action == "Clear Memories":
                try:
                    mem0_client.delete_all(user_id=user_id)
                    st.sidebar.success("🗑️ All memories cleared!")
                except Exception as e:
                    st.sidebar.error(f"❌ Failed to clear memories: {str(e)}")


    # ------------------ Chat Session State ------------------
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # ------------------ Display Chat Messages ------------------
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # ------------------ User Input ------------------
    if prompt := st.chat_input("Ask me anything..."):
        if not all([openai_api_key, mem0_api_key, tavily_api_key]):
            st.error("⚠️ Please provide all API keys in the sidebar.")
            st.stop()

        # Store user message
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Retrieve relevant context
        try:
            user_context_list = mem0_client.search(query=prompt, user_id=user_id) if mem0_client else []
            user_context = "\n".join([f"- {m['memory']}" for m in user_context_list])
        except Exception:
            user_context = ""

        # Generate response
        with st.chat_message("assistant"):
            with st.spinner("🤖 Thinking..."):
                try:
                    response = executor.invoke({
                        "messages": [HumanMessage(content=prompt)],
                        "user_context": user_context or "No relevant context found"
                    })
                    final_response = response["output"]
                    st.markdown(final_response)
                except Exception as e:
                    final_response = f"⚠️ Oops! Something went wrong: {str(e)}"
                    st.error(final_response)

        # Store assistant response
        st.session_state.messages.append({"role": "assistant", "content": final_response})
else:
    st.info("ℹ️ Please enter your OpenAI, Mem0, and Tavily API keys in the sidebar to get started.")

