import os
from langchain_openai import ChatOpenAI
import zipfile
import io

def get_llm(api_key, model_name="stepfun/step-3.5-flash:free"):
    """
    Returns a configured ChatOpenAI instance for OpenRouter.
    """
    if not api_key:
        return None
    
    return ChatOpenAI(
        model=model_name,
        openai_api_key=api_key,
        openai_api_base="https://openrouter.ai/api/v1",
        temperature=0.7
    )

def create_zip_download(code_files, readme_content):
    """
    Creates a ZIP file in memory containing the code files and README.md.
    Returns: BytesIO object of the zip file.
    """
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        # Add generated code files
        for filename, content in code_files.items():
            zip_file.writestr(filename, content)
        
        # Add README.md
        zip_file.writestr("README.md", readme_content)
    
    return zip_buffer
