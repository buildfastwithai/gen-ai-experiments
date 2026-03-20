# app.py
import streamlit as st
import tempfile
from solver import setup_educhain, generate_origami_steps

st.set_page_config(page_title="📐 PaperFold.AI", layout="centered", page_icon="🧻")

st.title("📐 PaperFold.AI")
st.subheader("⭐ Horizon Beta ✂️ Educhain ⭐")
st.markdown("🌸 Make amazing origami just by uploading a picture! 🌸")

# --- API Key ---
with st.sidebar:
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
        "</div></a></div>", unsafe_allow_html=True
    )

    st.header("🔐 API Settings")
    api_key = st.text_input("Enter your OpenRouter API Key", type="password")
    st.markdown("---")
    st.markdown("Model: `Horizon Beta`")
    st.markdown("---")
    st.markdown("""<div class="sidebar-footer">
        <p>❤️ Built by <a href="https://buildfastwithai.com" target="_blank">Build Fast with AI</a></p>
    </div> """, unsafe_allow_html=True)

if not api_key:
    st.warning("Please enter your OpenRouter API key in the sidebar and press enter to continue.")

# --- Image Upload Only ---
uploaded_file = st.file_uploader("📷 Upload an image of your origami object", type=["jpg", "jpeg", "png"])

image_path = None
if uploaded_file:
    st.image(uploaded_file, caption="🖼️ Your Origami", use_container_width=False, width=250)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
        tmp.write(uploaded_file.read())
        image_path = tmp.name


# --- Generate Button ---
if image_path and st.button("✨ Generate Origami Tutorial"):
    with st.spinner("🧠 Thinking..."):
        try:
            educhain_client = setup_educhain(api_key)
            result = generate_origami_steps(image_path, educhain_client)

            # Check if the result is a dictionary or a SolvedDoubt object
            if isinstance(result, dict):
                explanation = result.get("explanation", "")
                steps = result.get("steps", [])
                notes = result.get("additional_notes", "")
            else:
                explanation = getattr(result, "explanation", "")
                steps = getattr(result, "steps", [])
                notes = getattr(result, "additional_notes", "")

            # 📋 Steps
            st.markdown(
                """
                <div style="margin-top:20px; border: 2px solid #e0e0e0; border-radius: 8px; padding: 10px; background-color: #f9f9f9;">
                    <h3 style="color: #2c3e50; font-size: 24px; margin-bottom: 10px;">📋 Step-by-step Folding Guide</h3>
                    <ul style="line-height: 1.8; padding-left: 20px; list-style-type: none;">
                """, unsafe_allow_html=True
            )

            for step in steps:
                cleaned_step = step.strip().replace("\n", "<br>")
                st.markdown(
                    f"""
                    <li style=" font-size: 20px ; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
                        {cleaned_step}
                    </li>
                    """, unsafe_allow_html=True
                )

            st.markdown("</ul></div>", unsafe_allow_html=True)

            # # 📝 Additional Notes
            # if notes:
            #     st.markdown(
            #         f"""
            #         <div style="margin-top:20px; border: 2px solid #e0e0e0; border-radius: 8px; padding: 10px; background-color: #f9f9f9;">
            #             <h3 style="color: #2c3e50; font-size: 24px; margin-bottom: 10px;">📝 Keep in mind:</h3>
            #             <p style="line-height: 1.6; font-size: 16px;">{notes}</p>
            #         </div>
            #         """, unsafe_allow_html=True
            #     )

        except Exception as e:
            st.error(f"❌ Failed to generate tutorial: {str(e)}")