import streamlit as st
import os
import asyncio
from browser_use import Agent, Browser, BrowserConfig
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from PIL import Image
import io
import base64
import subprocess

async def setup_playwright():
    subprocess.run(["playwright", "install", "chromium"], check=True)



# Streamlit UI setup
st.title("🔎 Browser Use Agent")  # Updated title with emoji

# Sidebar for API key input
with st.sidebar:
    openai_api_key = st.text_input("OpenAI API Key", type="password")
    google_api_key = st.text_input("Google API Key", type="password")

# Main content
task = st.text_input("Enter your task:")  # Moved task input to main content


# Function to run the agent
async def run_agent(llm, task):
    config = BrowserConfig(headless=True)
    browser = Browser(config=config)
    agent = Agent(task=task, llm=llm, browser=browser, generate_gif=False)

    try:
        result = await agent.run()

        st.subheader("Agent Steps:")

        for i, action in enumerate(result.history):
            st.write(f"**Step {i+1}:**")
            step = action.model_output.current_state
            if step.next_goal is not None:
                st.write(f"  - **Next Goal:** {step.next_goal}")
            if action.result[0].extracted_content is not None:
                st.write(f"  - **Extracted Content:** {action.result[0].extracted_content}")

            try:
                # Display Screenshot
                if result.history[i].state.screenshot:  # Check if screenshot is available
                    img_data = result.history[i].state.screenshot
                    img_bytes = base64.b64decode(img_data)  # decode base64
                    img = Image.open(io.BytesIO(img_bytes))  # open PIL image
                    st.image(img, caption=f"Screenshot {i+1}", use_container_width=True)  # Updated to use_container_width
                else:
                    st.write("  - **Screenshot: Not Available**")  # If no screenshot
            except Exception as e:
                st.write(f"Could not display screenshot due to error: {e}")  # Show exception message
                pass

    except Exception as e:
        st.error(f"An error occurred: {e}")
    finally:
        await browser.close()


# Main execution block
if openai_api_key or google_api_key:
    if task:  # Only run if a task is entered
        if openai_api_key:
            os.environ['OPENAI_API_KEY'] = openai_api_key
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=openai_api_key)  # gpt-4o
            st.subheader("Using OpenAI Agent")
            asyncio.run(run_agent(llm, task))
        elif google_api_key:
            os.environ['GOOGLE_API_KEY'] = google_api_key
            llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0, google_api_key=google_api_key)  # gemini-2.0-flash
            st.subheader("Using Google Gemini Agent")
            asyncio.run(run_agent(llm, task))
    else:
        st.warning("Please enter a task.")  # Prompt user to enter a task
else:
    st.warning("Please enter either an OpenAI or Google API key in the sidebar.")
