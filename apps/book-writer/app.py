import streamlit as st
import os
import re
import json
from pathlib import Path

def slugify(text):
    return re.sub(r'[^a-zA-Z0-9]+', '-', text.strip().lower()).strip('-')

def get_book_outline(topic, genre, target_audience):
    prompt = (
        f"Create a comprehensive book outline and plan for '{topic}' in the {genre} genre for {target_audience}. "
        f"Return your response as a JSON object with the following keys: 'title', 'subtitle', 'genre', 'target_audience', 'outline', and 'chapters'. "
        f"The 'chapters' key should be a list of chapter titles in order. Example: {{'chapters': ['Introduction', 'Chapter 1', ...]}}. "
        f"Do not include any text outside the JSON object."
    )
    response = outline_agent.run(prompt, stream=False)
    return response.content

def extract_chapter_titles_from_json(json_input):
    try:
        if hasattr(json_input, 'text'):
            json_input = json_input.text
        elif hasattr(json_input, 'content'):
            json_input = json_input.content
        if isinstance(json_input, dict):
            data = json_input
        else:
            json_str = str(json_input).strip()
            json_str = re.sub(r"^```json|```$", "", json_str, flags=re.MULTILINE).strip()
            data = json.loads(json_str)
        chapters = data.get('chapters', [])
        if not isinstance(chapters, list):
            st.error("'chapters' key is not a list in the agent's response.")
            return []
        return chapters, data
    except Exception as e:
        st.error(f"Failed to parse JSON from agent response: {e}")
        return [], {}

def write_chapter(book_title, chapter_title, outline_json, book_context=""):
    prompt = (
        f"Write a complete, detailed chapter titled '{chapter_title}' for the book '{book_title}'. "
        f"Use the following outline (in JSON) for context: {outline_json}\nBook context: {book_context}"
    )
    response = chapter_writer_agent.run(prompt, stream=False)
    return response.content

# Page configuration
st.set_page_config(
    page_title="Book Writer App",
    page_icon="📖",
    layout="centered",
    initial_sidebar_state="expanded"
)
st.markdown(
    "<h1 style='text-align: center;'>𓂃🖊</h1>",
    unsafe_allow_html=True
)
st.markdown(
    "<h1 style='text-align: center;'>Prompt2Prose</h1>",
    unsafe_allow_html=True
)
st.markdown(
    "<h3 style='text-align: center;'>Leveraging latest Gpt-5 model</h3>",
    unsafe_allow_html=True
)
st.markdown("<p style='text-align: center;'>Turn your ideas into full-length books with chapters in seconds using AI</p>", unsafe_allow_html=True)
with st.sidebar:
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


# Sidebar for API key and book info
with st.sidebar:
    st.header("Configuration ⚙️")
    api_key = st.text_input("Enter Your OpenAI API Key", type="password")
    topic = st.text_input("Book Topic", value="The Power of Mindful Productivity")
    genre = st.text_input("Genre", value="self-help")
    audience = st.text_input("Audience", value="busy professionals")
    start_button = st.button("Generate Book")


if api_key:
    os.environ["OPENAI_API_KEY"] = api_key
    from book_writer_agent import outline_agent, chapter_writer_agent

if start_button:
    if not api_key:
        st.error("Please enter your OpenAI API key in the sidebar.")
        st.stop()
    if not topic or not genre or not audience:
        st.error("Please fill in all book details.")
        st.stop()

    st.sidebar.info("Generating outline and chapter plan...")
    outline_json = get_book_outline(topic, genre, audience)

    chapters, outline_data = extract_chapter_titles_from_json(outline_json)
    if not chapters:
        st.error("Could not extract chapter titles from outline JSON. Please check the agent's response format.")
        st.stop()

    st.sidebar.success(f"Found {len(chapters)} chapters. Generating chapters one by one...")
    st.markdown("---")

    # Compile the book markdown
    book_markdown = []

    # Centered INDEX heading
    st.markdown("<h1 style='text-align: center;'>INDEX</h1>", unsafe_allow_html=True)
    book_markdown.append("# INDEX\n")

    # Centered chapter list
    for idx, chapter_title in enumerate(chapters, 1):
        st.markdown(
            f"{chapter_title}"
        )
        book_markdown.append(f"### {idx}. {chapter_title}\n")

    # Horizontal line
    st.markdown("<hr>", unsafe_allow_html=True)
    book_markdown.append("\n---\n")

    # Generate and display each chapter as it is created
    for idx, chapter_title in enumerate(chapters, 1):
        with st.spinner(f"Writing Chapter {idx}: {chapter_title}"):
            chapter_content = write_chapter(topic, chapter_title, outline_json)
            st.markdown(chapter_content, unsafe_allow_html=True)
            st.markdown("---")
            # Add to book markdown
            book_markdown.append(f"\n# {chapter_content}\n\n---\n")
    st.success("All chapters generated!")

    # Show download button in sidebar
    full_book = "\n".join(book_markdown)
    st.sidebar.download_button(
        label="Download Complete Book (Markdown)",
        data=full_book,
        file_name=f"{slugify(topic)}.md",
        mime="text/markdown"
    )