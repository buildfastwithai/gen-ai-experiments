import streamlit as st
import base64
from openai import OpenAI
import re

# Set page configuration
st.set_page_config(page_title="WebBuilderByImages", layout="wide", initial_sidebar_state="expanded")

# Initialize session state for messages if not already present
if "messages" not in st.session_state:
    st.session_state.messages = []
if "generated_code" not in st.session_state:
    st.session_state.generated_code = ""

# Function to encode image to base64
def encode_image(uploaded_file):
    if uploaded_file is not None:
        return base64.b64encode(uploaded_file.getvalue()).decode('utf-8')
    return None

# Sidebar Configuration
with st.sidebar:
    st.title("Configuration")
    
    # API Key Input
    api_key = st.text_input("Enter your OpenRouter API Key", type="password")
    
    # Model Selection
    model_name = st.selectbox(
        "Select Model", 
        ["moonshotai/kimi-k2.5", "google/gemini-2.0-flash-001", "openai/gpt-4o"]
    )
    
    # Branding Section (Strictly copied from requirements)
    st.markdown("---")
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

# Main Application Logic
st.title("WebBuilderByImages")
st.markdown("Upload images and let AI build your website replica.")

# Image Upload
uploaded_files = st.file_uploader("Upload core website images (Max 3)", type=["png", "jpg", "jpeg"], accept_multiple_files=True)

if len(uploaded_files) > 3:
    st.warning("Please upload a maximum of 3 images.")
    uploaded_files = uploaded_files[:3]

# Chat Interface
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Chat Input
if prompt := st.chat_input("Describe the website or ask for changes..."):
    if not api_key:
        st.error("Please enter your OpenRouter API Key in the sidebar.")
    else:
        # Add user message to history
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Prepare payload for OpenRouter
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )

        messages_payload = []
        
        # System prompt
        system_prompt = (
            "You are an expert web developer. Your goal is to recreate a website exactly as shown in the provided images. "
            "Output the result as a SINGLE HTML file containing all necessary HTML, CSS (internal style tag), and JavaScript (internal script tag). "
            "Do not use external CSS or JS files unless they are CDNs (like FontAwesome or Google Fonts). "
            "Make sure the design is responsive and modern. "
            "If the user asks for changes, update the code accordingly. "
            "IMPORTANT: Output ONLY the code enclosed in ```html ... ``` blocks, or just the explanation if no code is needed."
        )
        messages_payload.append({"role": "system", "content": system_prompt})

        # Add existing conversation history
        # We need to handle images specially for the current turn if they are uploaded
        
        # Construct the content for the user's latest message with images
        user_content = [{"type": "text", "text": prompt}]
        
        if uploaded_files:
            for img_file in uploaded_files:
                base64_image = encode_image(img_file)
                if base64_image:
                    user_content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    })
        
        # We need to be careful about history. 
        # API doesn't always support stateful image history in a simple way depending on costs, 
        # but for this app we will append previous text messages. 
        # For simplicity and context window, we'll re-send images only if they are currently uploaded 
        # OR we could rely on the model remembering if we keep the session. 
        # A simple approach for this app: send history as text, send current images if any.
        
        for msg in st.session_state.messages[:-1]: # All except last (which we are building)
             messages_payload.append({"role": msg["role"], "content": msg["content"]})
        
        messages_payload.append({"role": "user", "content": user_content})

        with st.chat_message("assistant"):
            with st.spinner("Generating code..."):
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=messages_payload
                    )
                    
                    full_response = response.choices[0].message.content
                    st.markdown(full_response)
                    st.session_state.messages.append({"role": "assistant", "content": full_response})

                    # Extract HTML code
                    code_match = re.search(r"```html(.*?)```", full_response, re.DOTALL)
                    if code_match:
                        code = code_match.group(1).strip()
                        st.session_state.generated_code = code
                    
                except Exception as e:
                    st.error(f"An error occurred: {e}")

# Render Generated Website
if st.session_state.generated_code:
    st.divider()
    st.subheader("Live Preview")
    st.components.v1.html(st.session_state.generated_code, height=600, scrolling=True)
    
    # Download Button
    st.download_button(
        label="Download Source Code",
        data=st.session_state.generated_code,
        file_name="index.html",
        mime="text/html"
    )
