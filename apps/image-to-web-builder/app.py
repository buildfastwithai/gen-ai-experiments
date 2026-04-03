import streamlit as st
import base64
from openai import OpenAI
import re

# Set page configuration
st.set_page_config(
    page_title="Image to Web Builder",
    page_icon="🎨",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better UI
st.markdown("""
<style>
    /* Main container styling */
    .main .block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
    }
    
    /* Header styling */
    .main-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 2rem;
        border-radius: 16px;
        margin-bottom: 2rem;
        text-align: center;
        box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
    }
    
    .main-header h1 {
        color: white;
        font-size: 2.5rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
    }
    
    .main-header p {
        color: rgba(255, 255, 255, 0.9);
        font-size: 1.1rem;
    }
    
    /* Sidebar styling - Dark theme */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
    }
    
    [data-testid="stSidebar"] .stMarkdown {
        color: #e0e0e0;
    }
    
    /* File uploader styling */
    .stFileUploader > div {
        border: 2px dashed #667eea;
        border-radius: 12px;
        padding: 1rem;
        background: rgba(102, 126, 234, 0.05);
    }
    
    /* Chat message styling */
    .stChatMessage {
        border-radius: 12px;
        margin-bottom: 1rem;
        padding: 1rem;
    }
    
    /* Button styling */
    .stDownloadButton > button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0.75rem 2rem;
        font-weight: 600;
        transition: all 0.3s ease;
    }
    
    .stDownloadButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
    }
    
    /* Preview container */
    .preview-container {
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }
    
    /* Image preview grid */
    .image-grid {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        margin: 1rem 0;
    }
    
    /* Feature badges */
    .feature-badge {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        background: rgba(102, 126, 234, 0.1);
        border-radius: 20px;
        font-size: 0.85rem;
        color: #667eea;
        margin: 0.25rem;
    }
    
    /* Divider styling */
    hr {
        border: none;
        height: 1px;
        background: linear-gradient(90deg, transparent, #667eea, transparent);
        margin: 2rem 0;
    }
</style>
""", unsafe_allow_html=True)

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
    st.markdown("## ⚙️ Configuration")
    st.markdown("---")
    
    # API Key Input
    api_key = st.text_input(
        "🔑 OpenRouter API Key",
        type="password",
        placeholder="Enter your API key...",
        help="Get your API key from https://openrouter.ai"
    )
    
    st.markdown("")
    
    # Model Selection
    model_name = st.selectbox(
        "🤖 Select AI Model",
        ["moonshotai/kimi-k2.5"],
        help="Choose the AI model for code generation"
    )
    
    st.markdown("---")
    
    # Instructions
    st.markdown("### 📖 How to Use")
    st.markdown("""
    1. Enter your OpenRouter API key
    2. Upload up to 3 website images
    3. Describe what you want to build
    4. Get your HTML code instantly!
    """)
    
    st.markdown("---")
    
    # Clear conversation button
    if st.button("🗑️ Clear Conversation", use_container_width=True):
        st.session_state.messages = []
        st.session_state.generated_code = ""
        st.rerun()
    


# Main Application
st.markdown("""
<div class="main-header">
    <h1>🎨 Image to Web Builder</h1>
    <p>Transform your website screenshots into working HTML code with AI</p>
</div>
""", unsafe_allow_html=True)

# Feature badges
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.markdown("🖼️ **Multi-Image Support**")
with col2:
    st.markdown("⚡ **Instant Generation**")
with col3:
    st.markdown("📱 **Responsive Design**")
with col4:
    st.markdown("💾 **Download Ready**")

st.markdown("---")

# Image Upload Section
st.markdown("### 📤 Upload Your Website Images")
uploaded_files = st.file_uploader(
    "Drop your website screenshots here (Max 3 images)",
    type=["png", "jpg", "jpeg"],
    accept_multiple_files=True,
    help="Upload screenshots of the website you want to recreate"
)

if len(uploaded_files) > 3:
    st.warning("⚠️ Maximum 3 images allowed. Only the first 3 will be processed.")
    uploaded_files = uploaded_files[:3]

# Display uploaded images in a nice grid
if uploaded_files:
    st.markdown("#### 🖼️ Uploaded Images")
    cols = st.columns(min(len(uploaded_files), 3))
    for idx, (col, img_file) in enumerate(zip(cols, uploaded_files)):
        with col:
            st.image(img_file, caption=f"Image {idx + 1}", use_container_width=True)

st.markdown("---")

# Chat Interface
st.markdown("### 💬 Chat with AI")

# Display chat messages
for message in st.session_state.messages:
    with st.chat_message(message["role"], avatar="🧑‍💻" if message["role"] == "user" else "🤖"):
        st.markdown(message["content"])

# Chat Input
if prompt := st.chat_input("Describe the website you want to build or ask for changes..."):
    if not api_key:
        st.error("🔑 Please enter your OpenRouter API Key in the sidebar.")
    else:
        # Add user message to history
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user", avatar="🧑‍💻"):
            st.markdown(prompt)

        # Prepare payload for OpenRouter
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )

        messages_payload = []
        
        # System prompt
        system_prompt = """You are an expert web developer specializing in creating pixel-perfect website replicas. 

Your task is to recreate websites exactly as shown in the provided images.

**Output Requirements:**
- Generate a SINGLE HTML file with embedded CSS (in <style> tag) and JavaScript (in <script> tag)
- Use modern, semantic HTML5 elements
- Ensure the design is fully responsive (mobile-first approach)
- Include smooth animations and transitions where appropriate
- Use external CDNs only for icons (FontAwesome) and fonts (Google Fonts)
- Add hover effects and interactive elements to enhance UX

**Code Quality:**
- Write clean, well-commented code
- Use CSS custom properties (variables) for consistent theming
- Implement proper accessibility attributes (aria labels, alt text)
- Optimize for performance

**IMPORTANT:** Output ONLY the code enclosed in ```html ... ``` blocks. If explaining something, be concise."""
        
        messages_payload.append({"role": "system", "content": system_prompt})

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
        
        # Add previous messages to context
        for msg in st.session_state.messages[:-1]:
            messages_payload.append({"role": msg["role"], "content": msg["content"]})
        
        messages_payload.append({"role": "user", "content": user_content})

        with st.chat_message("assistant", avatar="🤖"):
            with st.spinner("✨ Generating your website code..."):
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
                    st.error(f"❌ An error occurred: {e}")

# Render Generated Website
if st.session_state.generated_code:
    st.markdown("---")
    
    st.markdown("### 🌐 Live Preview")
    
    # Preview in a nice container
    with st.container():
        st.components.v1.html(st.session_state.generated_code, height=600, scrolling=True)
    
    # Action buttons
    col1, col2 = st.columns([1, 4])
    with col1:
        st.download_button(
            label="📥 Download HTML",
            data=st.session_state.generated_code,
            file_name="website.html",
            mime="text/html",
            use_container_width=True
        )

# Footer
st.markdown("---")
st.markdown(
    "<div style='text-align: center; color: #888; padding: 1rem;'>"
    "Built with ❤️ using Streamlit & OpenRouter AI"
    "</div>",
    unsafe_allow_html=True
)