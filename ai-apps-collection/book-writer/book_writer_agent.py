import asyncio
from pathlib import Path
from textwrap import dedent
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from agno.models.groq import Groq
from agno.agent import Agent
from agno.team import Team
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.newspaper4k import Newspaper4kTools
import os

llm = Groq(id="openai/gpt-oss-120b")

# Data models for structured output
class Chapter(BaseModel):
    title: str
    content: str
    word_count: int


class BookOutline(BaseModel):
    title: str
    subtitle: str
    genre: str
    target_audience: str
    estimated_word_count: int
    chapters: List[Dict[str, Any]]


class CompleteBook(BaseModel):
    title: str
    subtitle: str
    author: str
    genre: str
    target_audience: str
    total_word_count: int
    chapters: List[Chapter]
    table_of_contents: str
    introduction: str
    conclusion: str
    bibliography: List[str]
    metadata: Optional[Dict[str, Any]] = None


# 1. Research and Outline Agent
outline_agent = Agent(
    name="Book Outliner",
    model=llm,
    tools=[DuckDuckGoTools()],
    description=dedent("""\
        You are an expert book planner and literary architect with decades of experience in publishing.
        Your expertise encompasses: 📚

        - Market research and audience analysis
        - Genre-specific structure and conventions
        - Compelling narrative arc development
        - Chapter organization and flow
        - Research methodology and source curation
        - Word count optimization and pacing
        - Competitive analysis and positioning
        - Hook development and reader engagement
        - Theme integration and symbolism
        - Publication-ready outline standards\
    """),
    instructions=dedent("""\
        1. Research Phase 🔍
           - Search for current trends in the specified genre
           - Analyze successful books in the same category
           - Research target audience preferences and demographics
           - Gather authoritative sources and references

        2. Market Analysis 📊
           - Identify unique selling points and positioning
           - Analyze competitive landscape
           - Determine optimal word count and structure
           - Assess market demand and timing

        3. Outline Development ✍️
           - Create compelling title and subtitle options
           - Design logical chapter progression
           - Establish clear themes and messaging
           - Plan for reader engagement and retention

        4. Quality Assurance ✓
           - Ensure narrative coherence and flow
           - Verify research depth and accuracy
           - Optimize for target audience appeal
           - Include actionable writing guidance
    """),
    expected_output=dedent("""\
        # {Book Title} - Comprehensive Outline

        ## Book Metadata
        - **Title**: {Compelling title}
        - **Subtitle**: {Engaging subtitle}
        - **Genre**: {Specific genre and subgenre}
        - **Target Audience**: {Detailed audience description}
        - **Estimated Word Count**: {Realistic word count range}

        ## Key Themes & Messages
        {List of 3-5 core themes that will be explored}

        ## Chapter Breakdown
        {Detailed chapter outline with titles, key points, and estimated word counts}

        ## Research Sources
        {List of authoritative sources and references}

        ## Writing Guidelines
        {Specific guidance for tone, style, and approach}

        ---
        Outline created by AI Book Architect
        Ready for chapter development
    """),
    markdown=True,
    show_tool_calls=True,
    add_datetime_to_instructions=True,
)


# 2. Chapter Writer Agent
chapter_writer_agent = Agent(
    name="Chapter Writer",
    model=llm,
    tools=[DuckDuckGoTools(), Newspaper4kTools()],
    description=dedent("""\
        You are a master storyteller and content creator with expertise in engaging narrative writing.
        Your capabilities include: ✍️

        - Compelling opening hooks and chapter transitions
        - Rich character development and dialogue
        - Vivid scene setting and atmosphere creation
        - Emotional resonance and reader connection
        - Pacing optimization and tension building
        - Research integration and fact verification
        - Multiple writing styles and genre conventions
        - SEO-friendly content optimization
        - Accessibility and readability enhancement
        - Professional editing and polish\
    """),
    instructions=dedent("""\
        1. Chapter Planning 📋
           - Review chapter outline and objectives
           - Identify key messages and takeaways
           - Plan engaging opening and closing
           - Structure content for optimal flow

        2. Research Integration 🔍
           - Gather additional supporting information
           - Verify facts and statistics
           - Find compelling examples and case studies
           - Source relevant quotes and references

        3. Writing Execution ✍️
           - Create compelling opening hook
           - Develop engaging narrative flow
           - Include relevant examples and stories
           - Maintain consistent tone and voice
           - Build toward strong chapter conclusion

        4. Quality Enhancement ✨
           - Ensure readability and accessibility
           - Add emotional resonance and connection
           - Optimize for engagement and retention
           - Include call-to-action or transition elements
    """),
    expected_output=dedent("""\
        # {Chapter Title}

        {Engaging chapter content with proper structure, examples, and flow}


        ## References
        {List of sources and citations used}

        ---
        Chapter written by AI Master Storyteller
        Ready for review and integration
    """),
    markdown=True,
    show_tool_calls=True,
    add_datetime_to_instructions=True,
)


# 3. Book Compiler Agent
book_compiler_agent = Agent(
    name="Book Compiler",
    model=llm,
    description=dedent("""\
        You are a professional book editor and publisher with expertise in manuscript preparation.
        Your skills include: 📖

        - Manuscript formatting and structure
        - Content flow and narrative coherence
        - Professional editing and polish
        - Metadata and publishing preparation
        - Table of contents and index creation
        - Bibliography and citation formatting
        - Quality assurance and consistency checking
        - Publication-ready formatting
        - Marketing copy and description writing
        - Industry standard compliance\
    """),
    instructions=dedent("""\
        1. Content Review 📋
           - Review all chapters for consistency
           - Check narrative flow and transitions
           - Verify formatting and structure
           - Ensure quality and completeness

        2. Book Assembly 📚
           - Create professional table of contents
           - Write compelling introduction
           - Develop cohesive conclusion
           - Format bibliography and references

        3. Quality Assurance ✓
           - Check for consistency in tone and style
           - Verify all references and citations
           - Ensure proper chapter transitions
           - Optimize overall reading experience

        4. Publication Preparation 📖
           - Format for professional standards
           - Add metadata and publishing info
           - Create marketing description
           - Prepare for various formats
    """),
    expected_output=dedent("""\
        # {Complete Book Title}

        {Professional book with all components properly formatted and assembled}

        ## Table of Contents
        {Complete and professional TOC}

        ## Introduction
        {Compelling book introduction}

        {All chapters with proper formatting}

        ## Conclusion
        {Strong book conclusion}

        ## Bibliography
        {Properly formatted references}

        ## Book Metadata
        {Complete publishing information}

        ---
        Complete book compiled by AI Professional Editor
        Ready for publication
    """),
    markdown=True,
    show_tool_calls=True,
    add_datetime_to_instructions=True,
)


# 4. Book Writing Team
book_writing_team = Team(
    name="Book Writing Team",
    mode="coordinate",
    model=llm,
    members=[outline_agent, chapter_writer_agent, book_compiler_agent],
    instructions=[
        "You are coordinating a complete book writing process.",
        "First, use the outline agent to create a comprehensive book outline.",
        "Then, use the chapter writer to create each chapter based on the outline.",
        "Finally, use the book compiler to assemble everything into a complete book.",
        "Ensure high quality, consistency, and professional standards throughout.",
        "Save the final book as a markdown file in the project directory."
    ],
    expected_output="a markdown file with name of book",
    response_model=CompleteBook,
    show_tool_calls=True,
    markdown=True,
    debug_mode=True,
    show_members_responses=True,
)


# 5. Individual Book Writer Agent (Simplified Version)
book_writer_agent = Agent(
    name="Book Writer",
    model=llm,
    tools=[DuckDuckGoTools()],
    description=dedent("""\
        You are a bestselling author and writing coach with expertise in creating compelling books.
        Your specialties include: 📚

        - Complete book development from concept to publication
        - Genre-specific writing techniques and conventions
        - Character development and plot structure
        - Research integration and fact-checking
        - Engaging narrative and storytelling
        - Professional editing and polish
        - Market analysis and audience targeting
        - Publication strategy and formatting
        - Marketing copy and book descriptions
        - Industry best practices and trends\
    """),
    instructions=dedent("""\
        When writing a complete book, follow this comprehensive process:

        1. Book Planning Phase 📋
           - Research the topic and target audience
           - Analyze market trends and competition
           - Create compelling title and subtitle
           - Develop comprehensive outline with chapters
           - Establish key themes and messaging

        2. Writing Phase ✍️
           - Write engaging introduction and hook
           - Develop each chapter with rich content
           - Include relevant examples, stories, and research
           - Maintain consistent tone and voice throughout
           - Create smooth transitions between chapters

        3. Enhancement Phase ✨
           - Add compelling conclusion and takeaways
           - Include professional table of contents
           - Format for readability and accessibility
           - Add relevant citations and references
           - Optimize for target audience engagement

        4. Final Polish 📖
           - Review for consistency and flow
           - Ensure professional formatting
           - Add metadata and publishing information
           - Create marketing description
           - Prepare for various publication formats

        Output Format:
        - Professional book title and metadata
        - Complete table of contents
        - Engaging introduction
        - All chapters with proper formatting
        - Strong conclusion
        - Bibliography and references
        - Publishing metadata
    """),
    expected_output=dedent("""\
        # {Book Title}
        *{Subtitle}*

        **Genre**: {Genre}  
        **Target Audience**: {Audience}  
        **Word Count**: {Total words}  
        **Author**: {Author name}

        ---

        ## Table of Contents

        {Professional table of contents with page numbers}

        ---

        ## Introduction

        {Compelling book introduction that hooks the reader}

        ---

        {All chapters with professional formatting}

        ---

        ## Conclusion

        {Strong conclusion that ties everything together}

        ---

        ## Bibliography

        {Properly formatted references and sources}

        ---

        **Book Metadata**  
        Created: {Date}  
        Genre: {Genre}  
        Target Audience: {Audience}  
        Word Count: {Count}  
        Status: Ready for Publication

        ---
        *Complete book written by AI Bestselling Author*
    """),
    markdown=True,
    show_tool_calls=True,
    add_datetime_to_instructions=True,
)


# Example usage functions
def write_book_with_team(topic: str, genre: str = "non-fiction", target_audience: str = "general readers"):
    """Write a complete book using the team approach"""
    prompt = f"Write a complete book about '{topic}' in the {genre} genre for {target_audience}. Create a comprehensive outline, write all chapters, and compile into a complete book."
    
    return book_writing_team.print_response(prompt, stream=True)


def write_book_simple(topic: str, genre: str = "non-fiction", target_audience: str = "general readers"):
    """Write a complete book using the single agent approach"""
    prompt = f"Write a complete book about '{topic}' in the {genre} genre for {target_audience}. Include all chapters, proper formatting, and professional structure."
    
    return book_writer_agent.print_response(prompt, stream=True)


def create_book_outline(topic: str, genre: str = "non-fiction", target_audience: str = "general readers"):
    """Create just the book outline"""
    prompt = f"Create a comprehensive book outline for '{topic}' in the {genre} genre for {target_audience}. Include chapter breakdown, research sources, and writing guidelines."
    
    return outline_agent.print_response(prompt, stream=True)


def write_single_chapter(chapter_title: str, chapter_outline: str, book_context: str = ""):
    """Write a single chapter"""
    prompt = f"Write a complete chapter titled '{chapter_title}' based on this outline: {chapter_outline}. Book context: {book_context}"
    
    return chapter_writer_agent.print_response(prompt, stream=True)


# Example usage
if __name__ == "__main__":
    # Example 1: Write a complete book using the team approach
    print("=== Writing Complete Book with Team ===")
    write_book_with_team(
        "The Future of Artificial Intelligence in Healthcare",
        genre="technology/healthcare",
        target_audience="healthcare professionals and tech enthusiasts"
    )
    
    # Example 2: Write a complete book using single agent
    print("\n=== Writing Complete Book with Single Agent ===")
    write_book_simple(
        "Sustainable Living in the Digital Age",
        genre="lifestyle/environment",
        target_audience="environmentally conscious millennials"
    )
    
    # Example 3: Create just an outline
    print("\n=== Creating Book Outline ===")
    create_book_outline(
        "Mindful Leadership in Remote Teams",
        genre="business/leadership",
        target_audience="managers and team leaders"
    )


# Additional book writing prompts to explore:
"""
Fiction Genres:
1. "Write a science fiction novel about time travel and its consequences"
2. "Create a mystery thriller set in a small coastal town"
3. "Develop a fantasy novel with unique magic system and world-building"
4. "Write a contemporary romance with complex characters"

Non-Fiction Topics:
1. "Write a business book about building successful remote teams"
2. "Create a self-help book about overcoming imposter syndrome"
3. "Develop a cookbook focused on sustainable and healthy eating"
4. "Write a history book about technological revolutions"

Educational Content:
1. "Write a comprehensive guide to machine learning for beginners"
2. "Create a book about financial literacy for young adults"
3. "Develop a parenting guide for the digital age"
4. "Write a book about climate change solutions and actions"

Specialized Topics:
1. "Write a book about the psychology of social media addiction"
2. "Create a guide to starting and running a successful podcast"
3. "Develop a book about sustainable fashion and ethical consumption"
4. "Write a memoir-style book about personal growth and transformation"
""" 