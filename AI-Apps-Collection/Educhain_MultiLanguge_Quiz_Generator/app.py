import streamlit as st
from educhain import Educhain, LLMConfig
from langchain_openai import ChatOpenAI

# --- App Configuration ---
st.set_page_config(
    page_title="Educhain Multilingual Quiz Generator",
    page_icon="🌍",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- Sidebar for Settings ---
with st.sidebar:
    st.title("Quiz Settings")
    st.markdown("Generate quizzes in multiple languages using Mistral Saba!")
    st.markdown("**Powered by** [Educhain](https://github.com/satvik314/educhain)")
    st.write("❤️ Built by [Build Fast with AI](https://buildfastwithai.com/genai-course)")
    st.markdown("---")

    openrouter_api_key = st.text_input("Enter your OpenRouter API Key:", type="password")
    if not openrouter_api_key:
        st.warning("Please enter your OpenRouter API key to use Mistral Saba.")
        mistral_saba_model = None
    else:
        mistral_saba_model = ChatOpenAI(
            model="mistralai/mistral-saba",
            openai_api_key=openrouter_api_key,
            openai_api_base="https://openrouter.ai/api/v1"
        )
        st.success("OpenRouter API Key configured!")
        
    st.markdown("---")
    
    language_choice = st.selectbox(
        "Select Language:",
        ["English", "Hindi", "Tamil", "Malayalam"],
        index=0
    )

    topic_map = {
        "English": "Physics Basics",
        "Hindi": "भारतीय इतिहास", # Indian History
        "Tamil": "தமிழ் இலக்கியம்", # Tamil Literature
        "Malayalam": "മലയാള സാഹിത്യം" # Malayalam Literature
    }
    topic = topic_map[language_choice] # Default topic based on language

    quiz_topic = st.text_area("Enter Quiz Topic (or use default):",
                             value=topic,
                             placeholder=f"e.g., {topic_map[language_choice]}")

    num_questions = st.slider("Number of Questions:", min_value=1, max_value=10, value=5)

    if st.button("Generate Quiz"):
        if quiz_topic and mistral_saba_model:
            st.session_state.generate_quiz = True
        else:
            st.warning("Please enter a topic and configure OpenRouter API Key.")
    else:
        st.session_state.generate_quiz = False

# --- Main App Content ---
st.title("🌍 Educhain Multilingual Quiz Generator")
st.markdown("Generate quizzes in English, Hindi, Tamil, and Malayalam powered by Mistral AI Saba!")

if st.session_state.generate_quiz and quiz_topic and mistral_saba_model:
    with st.spinner(f"Generating Quiz in {language_choice} on '{quiz_topic}' using Mistral Saba..."):
        saba_config = LLMConfig(custom_model=mistral_saba_model)
        client = Educhain(saba_config)

        try:
            custom_instructions_map = {
                "English": "Generate beginner-level questions in English.",
                "Hindi": "Generate beginner-level questions in Hindi.",
                "Tamil": "Generate beginner-level questions in Tamil.",
                "Malayalam": "Generate beginner-level questions in Malayalam."
            }

            questions = client.qna_engine.generate_questions(
                topic=quiz_topic,
                num=num_questions,
                question_type="Multiple Choice",
                custom_instructions=custom_instructions_map[language_choice]
            )

            if questions and questions.questions:
                st.session_state.generated_questions = questions

                st.subheader(f"Generated Quiz in {language_choice} on: '{quiz_topic}'")

                for i, q in enumerate(questions.questions, 1):
                    st.markdown(f"**Question {i}:** {q.question}")
                    for j, option in enumerate(q.options):
                        st.write(f"  {chr(65 + j)}. {option}")
                    st.write(f"  *(Correct Answer: {q.answer})*")
                    st.write("---")

                st.success(f"Quiz in {language_choice} generated successfully!")

            else:
                st.error("Could not generate quiz questions. Please try again or adjust settings.")
                st.session_state.generated_questions = None

        except Exception as e:
            st.error(f"Error generating quiz: {e}")
            st.error("Please check your API key and try again, or simplify your topic.")
            st.session_state.generated_questions = None
            import traceback
            st.error(traceback.format_exc())


elif st.session_state.generate_quiz and not quiz_topic:
    st.warning("Please enter a topic to generate a quiz.")