import streamlit as st
import os
from utils import get_llm, create_zip_download
from graph import create_agent_graph, AgentState
from langchain_core.messages import HumanMessage, AIMessage

# Page Config
st.set_page_config(page_title="AI Software Architect", layout="wide")

# Session State Initialization
if "messages" not in st.session_state:
    st.session_state.messages = []
if "stage" not in st.session_state:
    st.session_state.stage = "INIT"  # INIT, PLANNING, DESIGNING, DONE
if "agent_state" not in st.session_state:
    st.session_state.agent_state = {
        "messages": [],
        "user_requirement": "",
        "plan": "",
        "hld": "",
        "code_files": {},
        "readme": "",
        "feedback": "",
        "iteration_count": 0
    }

# --- SIDEBAR (STRICT) ---
with st.sidebar:
    st.header("Configuration")
    api_key = st.text_input("OpenRouter API Key", type="password")
    model_name = st.selectbox(
        "Select Model", 
        ["stepfun/step-3.5-flash:free", "google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.2-90b-vision-instruct:free"]
    )
    
    # === BRANDING SECTION (COPY EXACTLY) ===
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

# Logic to get LLM
llm = get_llm(api_key, model_name)

# Helper to add message to chat
def add_message(role, content):
    st.session_state.messages.append({"role": role, "content": content})

# Helper to run graph node manually (simulating the compiled graph step-by-step for UI control)
# We import nodes to call them directly or use the graph wrapper.
# For simplicity and robust UI control, we will use the node functions directly. 
# This preserves the logic while allowing Streamlit to interrupt.
from graph import planner_node, designer_node, coder_node

def handle_planning_step(prompt=None, feedback=None):
    if prompt:
        st.session_state.agent_state["user_requirement"] = prompt
    if feedback:
        st.session_state.agent_state["feedback"] = feedback
    
    with st.spinner("Thinking... Generating Plan..."):
        try:
            result = planner_node(st.session_state.agent_state, llm)
            st.session_state.agent_state["plan"] = result["plan"]
            st.session_state.agent_state["feedback"] = "" # Clear used feedback
            
            # Update Chat
            add_message("assistant", f"**Proposed Plan:**\n\n{result['plan']}")
            st.session_state.stage = "PLANNING"
        except Exception as e:
            st.error(f"Error generating plan: {e}")

def handle_design_step(feedback=None):
    if feedback:
        st.session_state.agent_state["feedback"] = feedback
        
    with st.spinner("Thinking... Creating High Level Design..."):
        try:
            result = designer_node(st.session_state.agent_state, llm)
            st.session_state.agent_state["hld"] = result["hld"]
            st.session_state.agent_state["feedback"] = ""
            
            add_message("assistant", f"**High Level Design:**\n\n{result['hld']}")
            st.session_state.stage = "DESIGNING"
        except Exception as e:
            st.error(f"Error generating design: {e}")

def handle_coding_step():
    with st.spinner("Coding... This may take a while..."):
        try:
            result = coder_node(st.session_state.agent_state, llm)
            st.session_state.agent_state["code_files"] = result["code_files"]
            st.session_state.agent_state["readme"] = result["readme"]
            
            add_message("assistant", f"**Code Generated!**\n\nREADME Preview:\n{result['readme']}")
            st.session_state.stage = "DONE"
        except Exception as e:
            st.error(f"Error generating code: {e}")


# --- MAIN UI ---
st.title("🤖 AI Software Architect")

# Display Chat History
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# --- INPUT HANDLING ---

# 1. INITIAL REQUEST
if st.session_state.stage == "INIT":
    user_input = st.chat_input("Describe the software you want to build...")
    if user_input:
        if not api_key:
            st.error("Please enter your API Key in the sidebar first.")
        else:
            add_message("user", user_input)
            handle_planning_step(prompt=user_input)
            st.rerun()

# 2. PLANNING PHASE
elif st.session_state.stage == "PLANNING":
    st.info("Review the plan above. You can Approve it to proceed or Request Changes.")
    
    col1, col2 = st.columns(2)
    with col1:
        if st.button("✅ Approve Plan", type="primary", use_container_width=True):
            add_message("user", "Plan Approved.")
            handle_design_step()
            st.rerun()
            
    with col2:
        # Refine uses chat input
        pass
    
    # Chat input for refinement
    refine_input = st.chat_input("Critique the plan or ask for changes...")
    if refine_input:
        add_message("user", f"Change Request: {refine_input}")
        handle_planning_step(feedback=refine_input)
        st.rerun()

# 3. DESIGNING PHASE
elif st.session_state.stage == "DESIGNING":
    st.info("Review the Design (HLD) above. You can Approve it to generate code or Request Changes.")
    
    col1, col2 = st.columns(2)
    with col1:
        if st.button("✅ Approve Design & Build", type="primary", use_container_width=True):
            add_message("user", "Design Approved. Start Coding.")
            handle_coding_step()
            st.rerun()
            
    with col2:
        pass
        
    refine_input = st.chat_input("Critique the design...")
    if refine_input:
        add_message("user", f"Change Request: {refine_input}")
        handle_design_step(feedback=refine_input)
        st.rerun()

# 4. DONE PHASE
elif st.session_state.stage == "DONE":
    st.success("Project Completed!")
    
    # Render README
    # Already shown in chat history, but we can show it efficiently again or just the download button.
    
    code_files = st.session_state.agent_state["code_files"]
    readme = st.session_state.agent_state["readme"]
    
    if code_files:
        zip_buffer = create_zip_download(code_files, readme)
        
        st.download_button(
            label="📦 Download Source Code",
            data=zip_buffer.getvalue(),
            file_name="generated_project.zip",
            mime="application/zip",
            type="primary"
        )
    
    if st.button("Start New Project"):
        st.session_state.messages = []
        st.session_state.stage = "INIT"
        st.session_state.agent_state = {
            "messages": [],
            "user_requirement": "",
            "plan": "",
            "hld": "",
            "code_files": {},
            "readme": "",
            "feedback": "",
            "iteration_count": 0
        }
        st.rerun()

