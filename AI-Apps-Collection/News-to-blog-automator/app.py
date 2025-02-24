import streamlit as st
from crewai import Agent, Task, Crew, Process, LLM
from crewai_tools import SerperDevTool
import os

# Streamlit App Configuration
st.set_page_config(page_title="⚡ News-to-Blog Automator", layout="wide")

# Sidebar for API Keys
with st.sidebar:
    st.header("⚙️ API Configuration")
    gemini_api_key = st.text_input("Gemini API Key", type="password", help="Enter your Google Gemini API key")
    serper_api_key = st.text_input("Serper API Key", type="password", help="Enter your Serper API key")
    
    if gemini_api_key and serper_api_key:
        os.environ["GEMINI_API_KEY"] = gemini_api_key
        os.environ["SERPER_API_KEY"] = serper_api_key
        st.success("API keys configured successfully!")
    else:
        st.warning("Please enter both API keys to proceed.")

# Define Gemini LLM
Gemini = LLM(model="gemini/gemini-2.0-flash") if "GEMINI_API_KEY" in os.environ else None

# Initialize tool
serper_search_tool = SerperDevTool()

# News Researcher Agent
news_researcher = Agent(
    role="News Researcher",
    goal="Find the latest news on a given topic from today and yesterday",
    backstory="An expert in digging up current events and trends from reliable sources",
    verbose=True,
    tools=[serper_search_tool],
    llm=Gemini
)

# Blog Writer Agent (Includes tagging)
blog_writer = Agent(
    role="Blog Writer",
    goal="Write an engaging blog post based on provided news and generate relevant tags",
    backstory="A skilled writer with a knack for turning facts into compelling stories and identifying key themes",
    verbose=True,
    llm=Gemini
)

# Define Tasks
def create_news_blog_crew(topic):
    # Task 1: News Researcher
    task1 = Task(
        description=f"Search for the latest news articles about {topic} from today and yesterday. Provide summaries of 3-5 articles, each including the title, URL, and key points.",
        expected_output="A list of 3-5 news articles from today and yesterday with title, URL, and key points for each.",
        agent=news_researcher
    )

    # Task 2: Blog Writer
    task2 = Task(
        description="Using the news summaries provided by the News Researcher, write a 300-word blog post. Include:\n"
                    "- A catchy title\n"
                    "- An excerpt of less than 250 characters\n"
                    "- The main content with an introduction, key highlights from the news, and a conclusion\n"
                    "- A sources section at the end listing the titles and URLs of the news articles\n"
                    "- Generate 3-5 relevant tags and append them in the format 'Tags: tag1, tag2, tag3'",
        expected_output="A complete blog post with title, excerpt, content, sources, and tags.",
        agent=blog_writer
    )

    # Create and Run the Crew
    crew = Crew(
        agents=[news_researcher, blog_writer],
        tasks=[task1, task2],
        verbose=True,
        process=Process.sequential
    )

    result = crew.kickoff()
    return result

# Streamlit App
def main():
    # Title and Description
    st.title("⚡ News-to-Blog Automator")
    st.write("Generate professional blog posts based on the latest news.")
    st.write("❤️ Built by [Build Fast with AI](https://buildfastwithai.com/genai-course)")

    # Check if API keys are provided
    if "GEMINI_API_KEY" not in os.environ or "SERPER_API_KEY" not in os.environ:
        st.error("Please configure both API keys in the sidebar to proceed.")
        return

    # Main Content Area
    col1, col2 = st.columns([2, 1])

    with col1:
        # Input field for topic
        topic = st.text_input("Enter Topic", value="AI advancements in 2025", help="Type a topic to generate a blog post about.")

        # Generate button
        if st.button("Generate Blog Post", key="generate", help="Click to create your blog post"):
            with st.spinner("Crafting your blog post..."):
                try:
                    blog_result = create_news_blog_crew(topic)
                    st.markdown("### Your Blog Post")
                    st.markdown(blog_result.raw)
                except Exception as e:
                    st.error(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()