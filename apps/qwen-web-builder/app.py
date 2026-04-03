import streamlit as st
from openai import OpenAI
import streamlit.components.v1 as components

# Page Layout
st.set_page_config(layout="wide", page_title="WebBuilder with Qwen3-Coder")

# Sidebar
with st.sidebar:
    st.title("Settings")
    
    # 1. Sidebar Input Collection
    api_key = st.text_input("OpenRouter API Key", type="password")
    model_name = st.selectbox("Select Model", ["qwen/qwen3-coder-next"])
    temperature = st.slider("Temperature", min_value=0.0, max_value=1.0, value=0.7)
    
    st.markdown("---")
    
    # 2. Branding Section (Strictly copied)
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

st.title("🌐 WebBuilder AI")
st.caption("Generate instant websites using Qwen3-Coder-Next")

if "generated_html" not in st.session_state:
    st.session_state.generated_html = ""

if "messages" not in st.session_state:
    st.session_state.messages = []

# Chat Interface
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

prompt = st.chat_input("Describe the website you want to build...")

if prompt:
    if not api_key:
        st.error("Please enter your OpenRouter API Key in the sidebar.")
    else:
        # Add user message
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Generate Logic
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        
        system_prompt = """
        You are an expert web developer built by 'Build Fast with AI'.
        Your task is to generate a SINGLE HTML file containing HTML, CSS, and JavaScript based on the user's request.
        
        Rules:
        1. Return ONLY the code. Do not wrap it in markdown code blocks (like ```html ... ```). Return raw HTML.
        2. Include beautiful, modern CSS (using internal <style>).
        3. Include any necessary JS (using internal <script>).
        4. If the user asks for changes, modify the previous code to reflect them.
        5. Make it responsive and professional.
        """
        
        # Prepare context
        messages = [{"role": "system", "content": system_prompt}]
        
        # Include a bit of history (last 2-3 turns) so it can iterate
        # But be careful of context length if code is huge. Qwen3-Coder has 256k so it's fine.
        for msg in st.session_state.messages[-6:]: 
             messages.append(msg)
             
        with st.chat_message("assistant"):
            with st.spinner("Generating website..."):
                try:
                    completion = client.chat.completions.create(
                        model=model_name,
                        messages=messages,
                        temperature=temperature
                    )
                    response_content = completion.choices[0].message.content
                    
                    # Clean up if model still outputted code blocks
                    clean_html = response_content.replace("```html", "").replace("```", "").strip()
                    
                    st.session_state.generated_html = clean_html
                    st.session_state.messages.append({"role": "assistant", "content": "Website generated! See the preview below."})
                    st.markdown("Website generated! See the preview below.")
                    
                except Exception as e:
                    st.error(f"Error: {e}")

# Display Section
if st.session_state.generated_html:
    st.subheader("Live Preview")
    components.html(st.session_state.generated_html, height=600, scrolling=True)
    
    st.download_button(
        label="Download Source Code",
        data=st.session_state.generated_html,
        file_name="index.html",
        mime="text/html"
    )
