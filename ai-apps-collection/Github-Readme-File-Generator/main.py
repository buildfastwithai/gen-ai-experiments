import os
import tempfile
import shutil
import streamlit as st
from git import Repo, GitCommandError
from agent import build_agent

st.set_page_config(page_title="README Generator", layout="wide")

# CSS for sidebar layout
st.markdown("""
    <style>
       
    /* Style for the Generate README button */
        div.stButton > button {
        border: 2px solid #00bfff;
        border-radius: 8px;
        padding: 10px 24px;
        background-color: #111;
        color: white;
        font-weight: bold;
        font-size: 16px;
        transition: 0.3s ease;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
    }
   
    div.stButton > button:hover {
        background-color: #00bfff;
        color: black;
        transform: scale(1.03);
        border-color: #fff;
    }
    .sidebar-content {
        flex: 1;
    }

    .sidebar-footer {
        font-size: 0.9em;
        padding: 10px 0;
    }

    .logo {
        width: 100%;
        max-width: 150px;
        
        display: block;
    }

    .project-title {
        text-align: left;
        font-weight: bold;
        font-size: 15px;
        margin-bottom: 10px;
    }
    </style>
""", unsafe_allow_html=True)



with st.sidebar:
    with st.container():
        st.markdown('<div class="sidebar-content">', unsafe_allow_html=True)

        # 1. Logo
        st.image("https://github.com/pratik-gond/temp_files/blob/main/image-removebg-preview.png?raw=true", use_container_width=False , width=120)

        # 2. Project name
        st.markdown('<div class="project-title">🦆 GitHub README File Generator</div>', unsafe_allow_html=True)

        # 3. API Key input field
        st.header("🔑 Settings")
        api_key = st.text_input(
            "OpenRouter API Key",
            type="password",
            help="Get one at https://openrouter.ai/keys"
        )

        st.divider()
        st.markdown("**Model Details**")
        st.caption("Running: `moonshotai/kimi-k2`")
        st.caption("via OpenRouter")

        # Download button placeholder
        download_placeholder = st.empty()

        st.markdown("</div>", unsafe_allow_html=True)

    # Footer sticky at bottom
    st.markdown("""
        <div class="sidebar-footer">
        ❤️ Built by <a href="https://buildfastwithai.com" target="_blank">Build Fast with AI</a>
         </div>
    """, unsafe_allow_html=True)


st.title("🦆 Github README File Generator")
st.subheader("🔥🔥 Kimi K2\u00A0\u00A0X\u00A0\u00A0Agno 🔥🔥")
repo_url = st.text_input("GitHub repo URL", placeholder="https://github.com/user/repo")


if "readme_generated" not in st.session_state:
    st.session_state["readme_generated"] = False

if not st.session_state["readme_generated"]:
    st.markdown("""
    <small>
    🔍 Paste your public GitHub repo URL above. </br>  
    🔍 Enter your OpenRouter API key in the sidebar.</br>
    🔍 After the file is generatee you can download it from download button in sidebar.</br> </br>
    </small>
    """, unsafe_allow_html=True)

if st.button("Generate README"):
    st.session_state["readme_generated"] = True

    if not repo_url.strip():
        st.warning("Please enter a repo URL.")
        st.stop()
    if not api_key.strip():
        st.error("🔑 API key required. Paste your OpenRouter key in the sidebar first.")
        st.stop()

    agent = build_agent(api_key)   # build agent only when needed

    with st.spinner("Cloning & analysing…"):
        tmp_dir = tempfile.mkdtemp()
        try:
            try:
                Repo.clone_from(repo_url, tmp_dir, depth=1)
            except GitCommandError as e:
                st.error("Unable to clone repository. Check the URL.")
                st.caption(str(e))
                st.stop()

            snippets = []
            for root, _, files in os.walk(tmp_dir):
                for f in files:
                    if f.lower().endswith(
                        (".py", ".js" , ".ts" , ".jsx" ,".ipynb", ".html" ,".css" , ".tsx" , ".php" , ".java", ".cpp", ".txt", ".yml", ".yaml", ".json", ".toml", ".cfg", ".ini") ):
                        path = os.path.join(root, f)
                        rel_path = os.path.relpath(path, tmp_dir)
                        try:
                            with open(path, "r", encoding="utf-8") as fh:
                                content = fh.read(4000)
                                snippets.append(f"### {rel_path}\n```\n{content}\n```")
                        except Exception:
                            pass

            if not snippets:
                st.error("Repository appears empty or has no readable files.")
                st.stop()

            repo_context = "\n\n".join(snippets)
            prompt = (
                "Below is the cloned repository.\n"
                f"{repo_context}\n\n"
                "Generate a complete, polished README.md (raw markdown ONLY). "
                "Include: shields.io badges, install steps, usage, tech stack, "
                "and contribution guide. "
                "Do NOT wrap the output in triple back-ticks."
            )
            readme = agent.run(prompt, markdown=True).content
            st.session_state["readme"] = readme

        except Exception as e:
            st.error("Something went wrong while processing the repository.")
            st.caption(str(e))
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


if "readme" in st.session_state:
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Markdown")
        st.code(st.session_state["readme"], language="markdown")
    with col2:
        st.subheader("Preview")
        st.markdown(st.session_state["readme"])

    with st.sidebar:
        st.download_button(
            label="📥 Download README.md",
            data=st.session_state["readme"],
            file_name="README.md",
            mime="text/markdown",
            use_container_width=True
        )

