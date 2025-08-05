# solver.py
from educhain import Educhain, LLMConfig
from langchain_openai import ChatOpenAI
import os

def setup_educhain(api_key):
    """Set up Educhain with Horizon Alpha model"""

    horizon_alpha = ChatOpenAI(
        openai_api_base="https://openrouter.ai/api/v1",
        openai_api_key=api_key,
        model_name="openrouter/horizon-beta"
    )
    config = LLMConfig(custom_model=horizon_alpha)
    return Educhain(config)

def generate_origami_steps(image_path, educhain_client):
    """Generate tutorial from uploaded image"""
    prompt = (
        "This is an origami object. Generate a complete, easy-to-follow, step-by-step folding guide to recreate it.\n\n"
        "Make sure to include the following in each step:\n"
        "🟢 Step number and a friendly instruction\n"
        "📄 Paper size to start with (like 'Start with a square paper – 15cm by 15cm')\n"
        "✨ What fold to do (like 'Fold the paper in half like a sandwich')\n"
        "🔍 What it should look like after the fold (like 'You should see a triangle now')\n"
        "🎯 Little tips or checks (like 'Make sure the corners match!' or 'Press the fold neatly')\n"
        "🎨 Use emojis and simple words so even a child can understand\n"
        "📷 If you can, include simple drawings\n\n"
        "Keep it very beginner-friendly, creative, and encouraging. Imagine you're writing it for a 10-year-old doing origami for the first time!"
    )

    result = educhain_client.qna_engine.solve_doubt(
        image_source=image_path,
        prompt=prompt,
        detail_level="High"
    )
    #
    # if isinstance(result, dict) and "steps" in result:
    #     explanation = result.get("explanation", "")
    #     steps = result["steps"]
    #     notes = result.get("additional_notes", "")
    #     return explanation, steps, notes
    # else:
    #     return "", [str(result)], ""
    return result
