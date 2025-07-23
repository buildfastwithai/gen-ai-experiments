# Import necessary libraries
from langchain_community.chat_models import ChatOllama 
from langchain.schema import AIMessage, HumanMessage  
import gradio as gr 

# Initialize the language model
llm = ChatOllama(model="llama3.2:3b")  # Create an instance of ChatOllama using the Llama 3.2 3B model

# Define the prediction function
def predict(message, history):
    chat_history = []
    # Convert the chat history into LangChain message objects
    for human, ai in history:
        chat_history.append(HumanMessage(content=human))
        chat_history.append(AIMessage(content=ai))
    # Add the new user message to the chat history
    chat_history.append(HumanMessage(content=message))
    
    # Generate a response using the language model
    llm_response = llm(chat_history)
    
    # Return the content of the response
    return llm_response.content

# Create and launch the Gradio interface
gr.ChatInterface(predict).launch()
