import streamlit as st
from educhain import Educhain, LLMConfig
from educhain.engines import qna_engine
from langchain_google_genai import ChatGoogleGenerativeAI
import os

# Set page configuration at the very top of the script
st.set_page_config(page_title="Educhain Question Generator", page_icon="📚", layout="wide")

# --- Sidebar Configuration ---
with st.sidebar:
    st.header("⚙️ Configuration")
    api_key = st.text_input("Google API Key", type="password")
    model_options = {
        "gemini-2.0-flash": "gemini-2.0-flash",
        "gemini-2.0-flash-lite-preview-02-05": "gemini-2.0-flash-lite-preview-02-05",
        "gemini-2.0-pro-exp-02-05": "gemini-2.0-pro-exp-02-05",
    }
    model_name = st.selectbox("Select Model", options=list(model_options.keys()), format_func=lambda x: model_options[x])

    st.markdown("**Powered by** [Educhain](https://github.com/satvik314/educhain)")
    st.write("❤️ Built by [Build Fast with AI](https://buildfastwithai.com/genai-course)")

# --- Initialize Educhain with Gemini Model ---
@st.cache_resource
def initialize_educhain(api_key, model_name):
    if not api_key:
        return None  # Return None if API key is missing

    gemini_model = ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=api_key
    )
    llm_config = LLMConfig(custom_model=gemini_model)
    return Educhain(llm_config)


# --- Utility Function to Display Questions ---
def display_questions(questions):
    if questions and hasattr(questions, "questions"):
        for i, question in enumerate(questions.questions):
            st.subheader(f"Question {i + 1}:")

            if hasattr(question, 'options'):  # Multiple Choice
                st.write(f"**Question:** {question.question}")
                st.write("Options:")
                for j, option in enumerate(question.options):
                    st.write(f"   {chr(65 + j)}. {option}")
                if hasattr(question, 'answer'):
                    st.write(f"**Correct Answer:** {question.answer}")
                if hasattr(question, 'explanation') and question.explanation:
                    st.write(f"**Explanation:** {question.explanation}")

            else:  # Short Answer, True/False, Fill in the Blank
                st.write(f"**Question:** {question.question}")
                if hasattr(question, 'answer'):
                    st.write(f"**Answer:** {question.answer}")
                if hasattr(question, 'explanation') and question.explanation:
                    st.write(f"**Explanation:** {question.explanation}")
                if hasattr(question, 'keywords') and question.keywords:  # Display keywords if present
                    st.write(f"**Keywords:** {', '.join(question.keywords)}")

            st.markdown("---")

# --- Streamlit App Layout ---
st.title("📚 Educhain Question Generator")

# --- Main Content Tabs ---
tab1, tab2, tab3, tab4 = st.tabs([
    "Multiple Choice",
    "Short Answer",
    "True/False",
    "Fill in the Blank"
])

# --- Initialize Educhain client if API key is provided ---
if api_key:
    educhain_client = initialize_educhain(api_key, model_name)
    if educhain_client:
        qna_engine = educhain_client.qna_engine
    else:
        st.error("Failed to initialize Educhain. Please check your API key and model selection in the sidebar.")
        educhain_client = None # To prevent errors in tabs if initialization fails
else:
    st.warning("Please enter your Google API Key in the sidebar to continue.")
    educhain_client = None # To prevent errors in tabs if API key is missing


# --- Tab 1: Multiple Choice Questions ---
with tab1:
    if educhain_client:
        st.header("Generate Multiple Choice Questions")
        topic = st.text_input("Enter Topic:", "Science")
        num_questions = st.slider("Number of Questions", 1, 10, 3, key="mcq_num")
        custom_instructions = st.text_area("Custom Instructions (optional):", placeholder="e.g. 'Focus on advanced concepts'", key="mcq_instructions")

        if st.button("Generate Questions", key='mcq_button'):
            with st.spinner("Generating..."):
                questions = qna_engine.generate_questions(
                    topic=topic,
                    num=num_questions,
                    question_type="Multiple Choice", # Changed 'type' to 'question_type'
                    custom_instructions=custom_instructions
                )
                display_questions(questions)

# --- Tab 2: Short Answer Questions ---
with tab2:
    if educhain_client:
        st.header("Generate Short Answer Questions")
        topic = st.text_input("Enter Topic:", "History")
        num_questions = st.slider("Number of Questions", 1, 10, 3, key="short_num")
        custom_instructions = st.text_area("Custom Instructions (optional):", placeholder="e.g. 'Questions should be open-ended'", key="short_instructions")

        if st.button("Generate Questions", key='short_button'):
            with st.spinner("Generating..."):
                questions = qna_engine.generate_questions(
                    topic=topic,
                    num=num_questions,
                    question_type="Short Answer", # Changed 'type' to 'question_type'
                    custom_instructions=custom_instructions
                )
                display_questions(questions)

# --- Tab 3: True/False Questions ---
with tab3:
    if educhain_client:
        st.header("Generate True/False Questions")
        topic = st.text_input("Enter Topic:", "Geography")
        num_questions = st.slider("Number of Questions", 1, 10, 3, key="tf_num")
        custom_instructions = st.text_area("Custom Instructions (optional):", placeholder="e.g. 'Focus on capitals of countries'", key="tf_instructions")

        if st.button("Generate Questions", key='tf_button'):
            with st.spinner("Generating..."):
                questions = qna_engine.generate_questions(
                    topic=topic,
                    num=num_questions,
                    question_type="True/False", # Changed 'type' to 'question_type'
                    custom_instructions=custom_instructions
                )
                display_questions(questions)

# --- Tab 4: Fill in the Blank Questions ---
with tab4:
    if educhain_client:
        st.header("Generate Fill in the Blank Questions")
        topic = st.text_input("Enter Topic:", "Math")
        num_questions = st.slider("Number of Questions", 1, 10, 3, key="fib_num")
        custom_instructions = st.text_area("Custom Instructions (optional):", placeholder="e.g. 'Use only single blank per question'", key="fib_instructions")

        if st.button("Generate Questions", key='fib_button'):
            with st.spinner("Generating..."):
                questions = qna_engine.generate_questions(
                    topic=topic,
                    num=num_questions,
                    question_type="Fill in the Blank", # Changed 'type' to 'question_type'
                    custom_instructions=custom_instructions
                )
                display_questions(questions)
