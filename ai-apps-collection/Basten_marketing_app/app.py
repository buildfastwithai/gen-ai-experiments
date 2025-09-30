import streamlit as st
from openai import OpenAI
import base64

st.set_page_config(page_title="Marketing Builder", layout="wide")

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


# Sidebar
st.sidebar.title("⚡ Marketing Builder")
api_key = st.sidebar.text_input("Enter your Baseten API Key", type="password")
choice = st.sidebar.selectbox("What do you want to create?", ["Landing Page", "Announcement Pamphlet", "Advertisement Banner"])

with st.sidebar :
    st.markdown("---")
    st.markdown("## 💡 Features")
    st.markdown(
        """
        - Generate clean HTML/CSS/JS code for landing pages, banners, and announcements.
        - Uses AI to improve design based on your previous inputs (history-aware).
        - Live preview of generated content within the app.
        - Download generated code with a single click.
        - Supports iterative improvements via chat-style prompts.
        """
    )

    st.markdown("---")
    st.markdown("## ⚡ Tips")
    st.markdown(
        """
        - Provide clear and detailed descriptions for better results.
        - Use iterative prompts to refine designs.
        - Select the right type of content from the dropdown above.
        - Keep your Baseten API key handy.
        """
    )

# Initialize session state for chat
if "messages" not in st.session_state:
    st.session_state.messages = []
if "html_code" not in st.session_state:
    st.session_state.html_code = None

st.title("📢 Marketing Content Generator")
st.markdown('This streamlit app is made using [Baseten](https://www.baseten.co/) which provides secure, scalable, fast LLM inferencing, Try for free [here](https://app.baseten.co/overview):')

# Display chat history
for msg in st.session_state.messages:
    if msg["role"] in "assistant":
        with st.chat_message(msg["assistant"]):
            st.markdown("Code as per requiremnet below HTML/CSS/JS below:")
    else: 
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

# User input box (chat style)
if prompt := st.chat_input("💬 Enter your description, suggestion, or improvements..."):
    if not api_key:
        st.error("Please enter your Baseten API key in the sidebar.")
    else:
        # Add user message to session state
        st.session_state.messages.append({"role": "user", "content": prompt})

        with st.chat_message("user"):
            st.markdown(prompt)

        try:
            # Initialize Baseten client via OpenAI API
            client = OpenAI(api_key=api_key, base_url="https://inference.baseten.co/v1")
            messages = [
                {"role": "system", "content": "You are a creative web designer. Output only clean HTML/CSS/JS."},
                {"role": "user", "content": f"Create a {choice} with the following details: {prompt}"},
                {"role": "system", "content": "If history is not provided just make desgn as per prompt but if history is provided then use that to improve the design."}
            ] + st.session_state.messages

            # Generate HTML content
            response = client.chat.completions.create(
                model="moonshotai/Kimi-K2-Instruct",
                messages=messages,
                max_tokens=1500,
                temperature=0.8
            )

            reply = response.choices[0].message.content.strip()
            st.session_state.messages.append({"role": "assistant", "content": reply})

            with st.chat_message("assistant"):
                st.markdown("✅ Code as per requiremnet below HTML/CSS/JS below:")
                # st.code(reply, language="html")

            # Store & render HTML live
            st.session_state.html_code = reply
            st.subheader(f"Generated {choice}")
            st.components.v1.html(reply, height=600, scrolling=True)

            # Optional: Download link
            html_bytes = reply.encode()

            # Create download button
            st.sidebar.download_button(
                label="📥 Download",
                data=html_bytes,
                file_name=f"{choice.replace(' ', '_')}.html",
                mime="text/html"
            )

        except Exception as e:
            st.error(f"Error: {e}")

st.sidebar.markdown("---")
st.sidebar.caption("Built with ❤️ using Streamlit & Baseten Inference")
