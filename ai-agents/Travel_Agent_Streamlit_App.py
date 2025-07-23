import streamlit as st
import os
from phi.agent import Agent
from phi.model.openai import OpenAIChat
from phi.tools.duckduckgo import DuckDuckGo

# Initialize page config
st.set_page_config(
    page_title="AI Travel Planner",
    page_icon="🌎",
    layout="wide"
)

# Add loading state container
loading_container = st.empty()

try:
    # Set OpenAI API key
    os.environ["OPENAI_API_KEY"] = ""
    

    # Initialize travel agent
    travel_agent = Agent(
        name="Travel Planner",
        model=OpenAIChat(id="gpt-4o-mini"),
        tools=[DuckDuckGo()],
        instructions=[
            "You are a travel planning assistant. Help users plan their trips by:",
            "1. Researching destinations and providing up-to-date information",
            "2. Finding popular attractions and activities", 
            "3. Suggesting accommodations based on preferences",
            "4. Providing local transportation options",
            "5. Giving budget estimates and travel tips",
            "Always verify information is current before making recommendations"
        ],
        show_tool_calls=True,
        markdown=True
    )

    # Main UI
    st.title("🌎 AI Travel Planner")
    st.write("Let me help you plan your perfect trip!")

    # Input fields in columns
    col1, col2 = st.columns(2)
    with col1:
        destination = st.text_input("Where would you like to go?", "")
    with col2:
        duration = st.number_input("How many days?", min_value=1, max_value=30, value=5)

    # Generate button
    if st.button("Generate Travel Plan", type="primary"):
        if destination:
            try:
                with st.spinner("🔍 Researching and planning your trip..."):
                    prompt = f"""
                    Create a detailed travel plan for {destination} for {duration} days.
                    Include:
                    - Best time to visit
                    - Top attractions and activities
                    - Recommended hotels in different price ranges
                    - Local transportation options and tips
                    - Estimated daily budget breakdown
                    """
                    # Extract and clean the response content
                    response = travel_agent.run(prompt)
                    if hasattr(response, 'content'):
                        # Clean and format the response
                        clean_response = response.content.replace('∣', '|').replace('\n\n\n', '\n\n')
                        st.markdown(clean_response)
                    else:
                        st.markdown(str(response))
            except Exception as e:
                st.error(f"Error generating travel plan: {str(e)}")
                st.info("Please try again in a few moments.")
        else:
            st.warning("Please enter a destination")

    # Q&A Section
    st.divider()
    with st.expander("🤔 Ask a specific question about your destination"):
        question = st.text_input("Your question:")
        if st.button("Get Answer", key="qa_button"):
            if question:
                with st.spinner("Finding answer..."):
                    try:
                        response = travel_agent.run(question)
                        if hasattr(response, 'content'):
                            st.markdown(response.content)
                        else:
                            st.markdown(str(response))
                    except Exception as e:
                        st.error(f"Error getting answer: {str(e)}")
            else:
                st.warning("Please enter a question")

except Exception as e:
    st.error(f"Application Error: {str(e)}")
    st.info("Please make sure all dependencies are installed and API keys are set correctly.")