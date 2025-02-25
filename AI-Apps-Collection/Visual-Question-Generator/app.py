import streamlit as st
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage
from educhain import Educhain, LLMConfig

st.set_page_config(
    page_title="Educhain Visual Question Generator ❓",
    page_icon="❓",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
    [data-testid="stAppViewContainer"] {
    background-color: #0e1117;
    color: white;
    }
     [data-testid="stHeader"] {
        background-color: rgba(0,0,0,0);
    }
    [data-testid="stToolbar"] {
        right: 2rem;
    }
    [data-testid="stTextInput"] > div > div > div {
        background-color: #1f2937;
        color: white;
    }
     [data-testid="stNumberInput"] > div > div > div {
        background-color: #1f2937;
        color: white;
         }
    [data-testid="stNumberInput"] input {
        color: white; /* Fix number input text color */
        }
    [data-testid="stButton"] button {
        background-color: #4CAF50;
        color: white;
    }
    [data-testid="stTextArea"] > div > div > div {
        background-color: #1f2937;
        color: white;
    }
    [data-testid="stSelectbox"] > div > div > div {
        background-color: #1f2937;
        color: white;
    }
     [data-testid="stSidebar"] {
        background-color: #1f2937;
        color: white;
    }
    [data-testid="stSidebar"] h1, h2, h3, h4, h5, h6, p, ul, ol, li {
        color: white;
    }
    [data-testid="stMarkdownContainer"] h1, h2, h3, h4, h5, h6, p, ul, ol, li {
        color: white;
    }
    [data-testid="stMarkdownContainer"] {
        color: white;
    }
   </style>
    """,
    unsafe_allow_html=True,
)


st.title("🚀 Visual Question Generator ❓")
st.write("❤️ Built by [Build Fast with AI](https://buildfastwithai.com/genai-course)")

with st.sidebar:
    st.header("⚙️ Configuration")
    st.session_state.groq_api_key = st.text_input("GROQ API Key", type="password")
    
    st.divider()
    st.markdown("**Model Details**")
    st.caption("Running: `deepseek-r1-distill-llama-70b`")
    st.caption("Groq LPU Inference Engine")
    st.divider()
    st.markdown(
        "**Built by** [Build Fast with AI](https://buildfastwithai.com/genai-course)",
        unsafe_allow_html=True
    )
    st.divider()
    st.markdown(
        "**Powered by** [Educhain](https://github.com/satvik314/educhain)",
        unsafe_allow_html=True
    )
    
topic_input = st.text_input("Enter Question Topic", "GMAT Statistics")
num_questions_input = st.number_input("Number of Questions", min_value=1, max_value=10, value=2, step=1)
generate_button = st.button("Generate Visual Questions")
if generate_button:
    topic = topic_input
    num_questions = num_questions_input
    llm = None
    config = None

    with st.spinner(f"Generating {num_questions} visual questions on '{topic}' using Deepseek-R1..."):
        try:
            if not st.session_state.groq_api_key:
                    st.error("Please enter your Groq API Key.")
                    st.stop()
            chat = ChatOpenAI(
                    model="deepseek-r1-distill-llama-70b",
                    openai_api_key=st.session_state.groq_api_key,
                    openai_api_base="https://api.groq.com/openai/v1"
                )
            config = LLMConfig(custom_model=chat)

            if config:
                client = Educhain(config)
                ques = client.qna_engine.generate_visual_questions(topic=topic, num=num_questions)

                if ques and ques.questions:
                    st.success(f"Successfully generated {len(ques.questions)} visual questions!")
                    for q_data in ques.questions:
                        st.markdown("---")
                        st.subheader(f"Question: {q_data.question}")

                        # Display Visualization - Assuming _generate_and_save_visual is accessible
                        instruction = q_data.graph_instruction.dict()
                        question_text = q_data.question
                        options = q_data.options
                        correct_answer = q_data.answer

                        try:
                            img_base64 = client.qna_engine._generate_and_save_visual(instruction, question_text, options, correct_answer)
                            if img_base64:
                                st.image(f"data:image/png;base64,{img_base64}", width=400) 
                            else:
                                st.warning("Visualization could not be generated.")
                        except Exception as viz_err:
                            st.error(f"Error displaying visualization: {viz_err}")

                        options_display = ""
                        for idx, option in enumerate(options, start=1):
                            options_display += f"{chr(64+idx)}. {option}  \n"
                        st.markdown(f"**Options:**  \n{options_display}")
                        st.markdown(f"**Correct Answer:** {correct_answer}")
                        if q_data.explanation:
                            st.markdown(f"**Explanation:** {q_data.explanation}")

                else:
                    st.error("Failed to generate visual questions. Please check settings and try again.")

        except Exception as e:
            st.error(f"An error occurred during question generation: {e}")

st.markdown("---")
st.markdown("Powered by Educhain")
