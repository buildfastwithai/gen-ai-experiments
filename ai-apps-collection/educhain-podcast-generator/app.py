import os
import tempfile
from datetime import datetime

import streamlit as st
from educhain import Educhain
from streamlit_advanced_audio import audix, WaveSurferOptions

st.write(sys.version)


def init_client(openai_key: str | None, google_key: str | None) -> Educhain:
    """
    Initialize Educhain client using provided API keys.
    Keys are set on the environment so Educhain can pick them up.
    """
    if openai_key:
        os.environ["OPENAI_API_KEY"] = openai_key.strip()
    if google_key:
        os.environ["GOOGLE_API_KEY"] = google_key.strip()

    return Educhain()


def build_sidebar():
    with st.sidebar:
        st.image(
            "https://github.com/Shubhwithai/GRE_Geometry_quiz/blob/main/Group%2042.png?raw=true",
            width=60,
        )

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

        st.title("🔧 Configuration")
        st.markdown(
            "Enter your API keys and podcast settings here. "
            "Keys are used only in this session and are **not** stored."
        )

        # API keys
        st.markdown("### 🔑 API Keys")
        openai_key = st.text_input(
            "OpenAI API Key",
            type="password",
            help="Required if you choose OpenAI as the TTS provider.",
        )
        google_key = st.text_input(
            "Google API Key",
            type="password",
            help="Required if you choose Gemini or Google as the TTS provider.",
        )

        st.markdown("---")

        # Mode selection
        mode = st.radio(
            "Podcast Mode",
            ["From Topic (auto script)", "From Custom Script"],
            help=(
                "• From Topic: Educhain will first create a script, then generate audio.\n"
                "• From Custom Script: You provide the full script that will be narrated."
            ),
        )

        # TTS provider
        tts_provider = st.selectbox(
            "TTS Provider",
            ["openai", "google", "gemini"],
            index=0,
            help="Choose which text-to-speech engine to use.",
        )

        # Provider-specific options
        tts_model = None
        tts_voice = None

        if tts_provider == "openai":
            tts_model = st.text_input("OpenAI TTS Model", value="tts-1")
            tts_voice = st.selectbox(
                "OpenAI Voice",
                ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
                index=0,
            )
        elif tts_provider == "gemini":
            tts_model = st.text_input(
                "Gemini TTS Model", value="gemini-2.5-pro-preview-tts"
            )
            tts_voice = st.selectbox(
                "Gemini Voice",
                ["Kore", "Puck", "Charon-en-GB"],
                index=0,
            )

        enhance_audio = st.checkbox(
            "Enhance audio quality",
            value=True,
            help="Enable any post-processing / enhancement offered by the provider.",
        )

        language = st.selectbox(
            "Language (ISO code)",
            ["en", "es", "fr", "de", "hi", "pt", "it"],
            index=0,
            help="Language code for the generated podcast.",
        )

        st.markdown("### 📝 Quick Instructions")
        st.info(
            """
            1. **Add API keys** in this sidebar.  
            2. **Choose mode** (topic or custom script).  
            3. **Tune voice, language, and options**.  
            4. Click **Generate Podcast** in the main area.  
            """
        )

        st.markdown("---")
        st.caption("Built with Educhain & Streamlit")

    return {
        "openai_key": openai_key,
        "google_key": google_key,
        "mode": mode,
        "tts_provider": tts_provider,
        "tts_model": tts_model,
        "tts_voice": tts_voice,
        "enhance_audio": enhance_audio,
        "language": language,
    }


def get_output_path(base_name: str = "podcast") -> str:
    """Create a temporary MP3 path for the generated podcast."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{base_name}_{ts}.mp3"
    tmp_dir = tempfile.gettempdir()
    return os.path.join(tmp_dir, filename)


def main():
    st.set_page_config(
        page_title="AI Podcast Generator",
        page_icon="🎙️",
        layout="centered",
        initial_sidebar_state="expanded",
    )

    # Custom styling inspired by a clean, centered layout
    st.markdown(
        """
        <style>
            .main-header {
                font-size: 2.4rem;
                font-weight: 700;
                text-align: center;
                margin-bottom: 0.5rem;
            }
            .sub-header {
                font-size: 1.1rem;
                text-align: center;
                margin-bottom: 2rem;
                opacity: 0.8;
            }
            .stButton > button {
                width: 100%;
                border-radius: 8px;
                height: 3em;
                font-weight: 600;
            }
            .block-container {
                padding-top: 2rem;
            }
        </style>
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        '<div class="main-header">🎙️ AI Podcast Generator</div>',
        unsafe_allow_html=True,
    )
    st.markdown(
        '<div class="sub-header">Turn any topic or script into an engaging podcast.</div>',
        unsafe_allow_html=True,
    )

    with st.expander("✨ How it works", expanded=True):
        st.markdown(
            """
            1. **Configure in the sidebar**
               - Enter your API keys  
               - Choose TTS provider, voice, and language  

            2. **Provide content**
               - Select **From Topic** to auto-generate a script, or  
               - Select **From Custom Script** and paste your own script  

            3. **Generate & download**
               - Click **Generate Podcast**  
               - Listen to the audio preview  
               - Download the MP3 file  
            """
        )

    st.markdown("---")

    config = build_sidebar()

    # st.subheader("1️⃣ Content")
    if config["mode"] == "From Topic (auto script)":
        topic = st.text_input(
            "Podcast Topic",
            value="Python Programming",
            help="Describe the main subject you want the podcast to cover.",
        )
    else:
        topic = None

    script_text = ""
    if config["mode"] == "From Custom Script":
        st.subheader("✍️ Your Script")
        script_text = st.text_area(
            "Paste your full podcast script here",
            height=220,
            placeholder="Welcome to our podcast...",
        )

    # st.markdown("---")

    # Button directly under the main inputs for a cohesive look
    generate_button = st.button(
        "🚀 Generate Podcast", type="primary", use_container_width=True
    )

    if generate_button:
        # Basic validation
        if config["tts_provider"] in ("openai",) and not config["openai_key"]:
            st.error("Please provide your OpenAI API key in the sidebar.")
            return
        if config["tts_provider"] in ("gemini", "google") and not config["google_key"]:
            st.error("Please provide your Google API key in the sidebar.")
            return

        if config["mode"] == "From Topic (auto script)" and not topic:
            st.error("Please enter a topic for your podcast.")
            return

        if config["mode"] == "From Custom Script" and not script_text.strip():
            st.error("Please paste a script to generate your podcast.")
            return

        try:
            client = init_client(
                openai_key=config["openai_key"],
                google_key=config["google_key"],
            )
        except Exception as e:
            st.error(f"Failed to initialize Educhain client: {e}")
            return

        output_path = get_output_path("podcast")

        with st.spinner("Generating your podcast. This may take a minute..."):
            try:
                if config["mode"] == "From Topic (auto script)":
                    podcast = client.content_engine.generate_complete_podcast(
                        topic=topic,
                        output_path=output_path,
                        tts_provider=config["tts_provider"],
                        language=config["language"],
                        tts_model=config["tts_model"],
                        tts_voice=config["tts_voice"],
                        enhance_audio=config["enhance_audio"],
                    )
                else:
                    podcast = client.content_engine.generate_podcast_from_script(
                        script=script_text,
                        output_path=output_path,
                        tts_provider=config["tts_provider"],
                        tts_model=config["tts_model"],
                        tts_voice=config["tts_voice"],
                        enhance_audio=config["enhance_audio"],
                    )
            except Exception as e:
                st.error(f"Podcast generation failed: {e}")
                return

        st.success("✅ Podcast generated successfully!")

        # Persist path in session state so audio remains on interaction reruns
        st.session_state["podcast_output_path"] = output_path

    # Always try to show the last generated podcast (if any) without regenerating
    output_path = st.session_state.get("podcast_output_path")
    if output_path and os.path.exists(output_path):
        with open(output_path, "rb") as f:
            audio_bytes = f.read()

        st.markdown("### 🔊 Listen to your podcast")

        options = WaveSurferOptions(
            wave_color="#2B88D9",
            progress_color="#b91d47",
            height=80,
        )

        result = audix(output_path, wavesurfer_options=options)

        if result:
            current_time = result.get("currentTime")
            selected_region = result.get("selectedRegion")
            if current_time is not None:
                st.caption(f"Current time: {current_time:.1f}s")
            if selected_region:
                start = selected_region.get("start")
                end = selected_region.get("end")
                if start is not None and end is not None:
                    st.caption(f"Selected region: {start:.1f}s – {end:.1f}s")

        st.download_button(
            label="⬇️ Download Podcast (MP3)",
            data=audio_bytes,
            file_name=os.path.basename(output_path),
            mime="audio/mpeg",
        )

    st.markdown("---")

    with st.expander("ℹ️ Tips & Best Practices"):
        st.markdown(
            """
            - **Topic quality**: More specific topics generally produce better podcasts.
            - **Length vs. detail**: Use the *Duration / depth hint* field to suggest how deep or long the podcast should be.
            - **Voices**: Try different voices to match the tone of your content (e.g., `nova` for educational content, `onyx` for news-style).
            - **Languages**: Make sure your topic or script matches the selected language for best results.
            """
        )


if __name__ == "__main__":
    main()


