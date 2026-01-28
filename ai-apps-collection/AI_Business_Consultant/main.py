import os

import streamlit as st
from crewai import Agent, Task, Crew
from langchain_cohere import ChatCohere

# Set up the Streamlit app
st.title("🤖 AI Business Consultant 💡")
st.markdown(
    """
    <div style="font-family: 'Segoe UI', sans-serif; font-size:18px; line-height:1.6; font-weight:500;">
        Your multi-agent partner for:<br>
        📊 Business insights<br>
        📈 Data analysis<br>
        🌍 Real-time trends<br>
        <span style="font-style: italic;">...about any business topic</span>
        <br>
    </div>
    """,
    unsafe_allow_html=True,
)

st.divider()

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
    st.header("Configuration")
    st.markdown("---")

cohere_api_key = st.sidebar.text_input("Enter your Cohere API Key", type="password")
st.sidebar.markdown("[Get your API key from Cohere](https://dashboard.cohere.com/api-keys)", unsafe_allow_html=True)
st.sidebar.divider()
st.sidebar.markdown("""<div class="sidebar-footer">
                    <p>❤️ Built by <a href="https://buildfastwithai.com" target="_blank">Build Fast with AI</a></p>
                </div> """, unsafe_allow_html=True)
# Initialize Cohere client
llm = None
if cohere_api_key:
    try:
        os.environ["COHERE_API_KEY"] = cohere_api_key
        llm = ChatCohere(cohere_api_key=cohere_api_key)
        st.sidebar.success("Cohere API Key validated successfully!")
    except Exception as e:
        st.sidebar.error("Invalid Cohere API Key. Please check your key and try again.")
else:
    st.sidebar.warning("Please enter your Cohere API Key to use the app.")

# Text inputs for user to specify the business area and stakeholder
business = st.text_input('Enter the required business search area')
stakeholder = st.text_input('Enter the stakeholder team')


# Crew Agents


planner = Agent(
    role="Business Consultant",
    goal="Plan engaging and factually accurate content about the topic: {topic}",
    backstory="You're working on providing insights about the topic: {topic} "
              "to your stakeholder who is: {stakeholder}. "
              "You collect information that helps them make decisions. "
              "Your work is the basis for the Business Writer to deliver good insights.",
    allow_delegation=False,
    verbose=True,
    llm=llm
)

writer = Agent(
    role="Business Writer",
    goal="Write insightful and factually accurate insights about the topic: {topic}",
    backstory="You're writing a Business Insights document about the topic: {topic}. "
              "You base your design on the work of the Business Consultant, who provides an outline "
              "and relevant context about the topic. "
              "You follow the main objectives and direction of the outline, "
              "as provided by the Business Consultant. "
              "You also provide objective and impartial insights "
              "and back them up with information provided by the Business Consultant.",
    allow_delegation=False,
    verbose=True,
    llm=llm
)

analyst = Agent(
    role="Data Analyst",
    goal="Perform comprehensive statistical analysis on the topic: {topic}",
    backstory="You're using your strong analytical skills to provide a comprehensive statistical analysis with numbers "
              "about the topic: {topic}. "
              "You base your design on the work of the Business Consultant, who provides an outline "
              "and relevant context about the topic. "
              "You follow the main objectives and direction of the outline, "
              "as provided by the Business Consultant. "
              "You also provide comprehensive statistical analysis with numbers to the Business Writer "
              "and back them up with information provided by the Business Consultant.",
    allow_delegation=False,
    verbose=True,
    llm=llm
)


# Crew Tasks


plan = Task(
    description=(
        "1. Prioritize the latest trends, key players, and noteworthy news on the {topic}.\n"
        "2. Place your business insights.\n"
        "3. Also give some suggestions and things to consider when dealing with International operators.\n"
        "4. Limit the document to only 500 words"
    ),
    expected_output="A comprehensive Business Consultancy document with an outline, and detailed insights, analysis, and suggestions",
    agent=planner,
)

write = Task(
    description=(
        "1. Use the business consultant's plan to craft a compelling document about {topic}.\n"
        "2. Sections/Subtitles are properly named in an engaging manner.\n"
        "3. Proofread for grammatical errors and alignment with the brand's voice.\n"
        "4. Limit the document to only 200 words.\n"
        "5. Use impressive images and charts to reinforce your insights."
    ),
    expected_output="A well-written document providing insights for {stakeholder}",
    agent=writer
)

analyse = Task(
    description=(
        "1. Use the business consultant's plan to do the needed statistical analysis with numbers on {topic}.\n"
        "2. To be presented to {stakeholder} in a document which will be designed by the Business Writer.\n"
        "3. You'll collaborate with your team of Business Consultant and Business Writer to align on the best analysis to be provided about {topic}."
    ),
    expected_output="A clear comprehensive data analysis providing insights and statistics with numbers to the Business Writer",
    agent=analyst
)


# Execution

crew = Crew(
    agents=[planner, analyst, writer],
    tasks=[plan, analyse, write],
    verbose=True
)

if st.button("Run"):
    if business and stakeholder and llm:
        with st.spinner('Loading...'):
            result = crew.kickoff(inputs={"topic": business, "stakeholder": stakeholder})

            # Display the raw output in Markdown format
            if hasattr(result, 'raw'):
                st.markdown(result.raw)
            else:
                st.warning("No raw output available.")
    else:
        st.warning("Please enter both the business search area, the stakeholder team, and a valid Cohere API Key.")
