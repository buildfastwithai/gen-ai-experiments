from agno.agent import Agent
from agno.models.openai import OpenAILike
from  agno.tools.file import FileTools
from dotenv import load_dotenv
import os
import streamlit as st

load_dotenv()



def build_agent(api_key: str):
    return Agent(
        model=OpenAILike(
            id="moonshotai/kimi-k2",
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            max_tokens=4000
        ),
        tools=[FileTools()],
        description=(
            "You are a technical writer. Clone the repo, scan its structure except the readme.md file if it already exists , "
            "and return a complete README.md (raw markdown only)."
        ),
        markdown=True
    )