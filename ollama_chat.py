import streamlit as st
from streamlit_chat import message
from langchain_community.chat_models import ChatOllama
from langchain.chains import ConversationChain
from langchain.chains.conversation.memory import ConversationBufferWindowMemory
from streamlit_extras.add_vertical_space import add_vertical_space

# Set up the main page title and description
st.subheader("Gemma 2B Chatbot")
st.markdown("❤️ Built with Ollama + Streamlit ")

# Create the sidebar with additional information
with st.sidebar:
    st.title("Gemma 2B Chatbot")
    st.subheader("This app lets you chat with Gemma 2B! [👉]")
    add_vertical_space(2)
    st.markdown("""
    Want to learn how to build this? 
   
    Join [GenAI Course](https://www.buildfastwithai.com/genai-course) by Build Fast with AI!
    """)
    add_vertical_space(3)
    st.write("Reach out to me on [LinkedIn](https://www.linkedin.com/in/satvik-paramkusham)")

# Initialize session state variables
if 'buffer_memory' not in st.session_state:
    # Create a conversation memory buffer
    st.session_state.buffer_memory = ConversationBufferWindowMemory(k=3, return_messages=True)

if "messages" not in st.session_state:
    # Initialize the chat messages
    st.session_state.messages = [
        {"role": "assistant", "content": "How can I help you today?"}
    ]

if "conversation" not in st.session_state:
    # Initialize the language model and conversation chain
    llm = ChatOllama(model="gemma2:2b")
    st.session_state.conversation = ConversationChain(
        memory=st.session_state.buffer_memory, 
        llm=llm
    )

# Chat interface
if prompt := st.chat_input("Your question"):
    # Add user's question to the chat history
    st.session_state.messages.append({"role": "user", "content": prompt})

# Display chat messages
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.write(message["content"])

# Generate and display assistant's response
if st.session_state.messages[-1]["role"] != "assistant":
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            # Get response from the conversation chain
            response = st.session_state.conversation.predict(input=prompt)
            st.write(response)
            # Add assistant's response to the chat history
            message = {"role": "assistant", "content": response}
            st.session_state.messages.append(message)
