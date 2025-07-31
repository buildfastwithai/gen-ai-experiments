"""
Chess Team Battle
---------------------------------
This example shows how to build a Chess game where AI agents play different roles in a team.
The game features specialized agents for strategy for white pieces, strategy for black pieces,
and a master agent overseeing the game. Move validation is handled by python-chess.

Usage Examples:
---------------
1. Quick game with default settings:
   team = get_chess_team()

2. Game with debug mode off:
   team = get_chess_team(debug_mode=False)

The game integrates:
  - Multiple AI models (Claude, GPT-4, etc.)
  - Specialized agent roles (strategist, master)
  - Turn-based gameplay coordination
  - Move validation using python-chess
"""

import sys
import os
from pathlib import Path

from agno.agent import Agent
from agno.team.team import Team
from agno.utils.log import logger
from agno.models.openai import OpenAILike
BASE_URL="https://openrouter.ai/api/v1"

project_root = str(Path(__file__).parent.parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)


def get_model_for_provider(provider: str, model_name: str, api_token: str):
    """
    Creates and returns the appropriate model instance based on the provider.

    Args:
        provider: The model provider (e.g., 'openai', 'google', 'anthropic', 'groq')
        model_name: The specific model name/ID

    Returns:
        An instance of the appropriate model class

    Raises:
        ValueError: If the provider is not supported
    """
    if provider == "openai":
        return OpenAILike(
            api_key=api_token,
            base_url=BASE_URL,
            id="openai/gpt-4o",
        )
    elif provider == "GLM":
        return OpenAILike(
            api_key=api_token,
            base_url=BASE_URL,
            id="z-ai/glm-4.5-air",
        )
    elif provider == "google":
        return OpenAILike(
            api_key=api_token,
            base_url=BASE_URL,
            id="google/gemini-pro-1.5",
        )
    else:
        raise ValueError(f"Unsupported model provider: {provider}")


def get_chess_team(
    api_token,
    white_model: str = "GLM:z-ai/glm-4.5-air",
    black_model: str = "google:google/gemini-pro-1.5",
    master_model: str = "openai:openai/gpt-4o",
    debug_mode: bool = True,
) -> Team:

    """
    Returns a chess team with specialized agents for white pieces, black pieces, and game master.

    Args:
        white_model: Model for white piece strategy
        black_model: Model for black piece strategy
        master_model: Model for game state evaluation
        debug_mode: Enable logging and debug features

    Returns:
        Team instance configured for chess gameplay
    """
    try:
        white_provider, white_name = white_model.split(":")
        black_provider, black_name = black_model.split(":")
        master_provider, master_name = master_model.split(":")

        white_piece_model = get_model_for_provider(white_provider, white_name, api_token)
        black_piece_model = get_model_for_provider(black_provider, black_name, api_token)
        master_model = get_model_for_provider(master_provider, master_name, api_token)

        white_piece_agent = Agent(
            name="white_piece_agent",
            role="White Piece Strategist",
            description="""You are a chess strategist for white pieces. Given a list of legal moves,
                    analyze them and choose the best one based on standard chess strategy.
                    Consider piece development, center control, and king safety.
                    Respond ONLY with your chosen move in UCI notation (e.g., 'e2e4').""",
            model=white_piece_model,
            debug_mode=debug_mode,
        )

        black_piece_agent = Agent(
            name="black_piece_agent",
            role="Black Piece Strategist",
            description="""You are a chess strategist for black pieces. Given a list of legal moves,
                    analyze them and choose the best one based on standard chess strategy.
                    Consider piece development, center control, and king safety.
                    Respond ONLY with your chosen move in UCI notation (e.g., 'e7e5').""",
            model=black_piece_model,
            debug_mode=debug_mode,
        )

        return Team(
            name="Chess Team",
            mode="route",
            model=master_model,
            success_criteria="The game is completed with a win, loss, or draw",
            members=[white_piece_agent, black_piece_agent],
            instructions=[
                "You are the chess game coordinator and master analyst.",
                "Your role is to coordinate between two player agents and provide game analysis:",
                "1. white_piece_agent - Makes moves for white pieces",
                "2. black_piece_agent - Makes moves for black pieces",
                "",
                "When receiving a task:",
                "1. Check the 'current_player' in the context",
                "2. If current_player is white_piece_agent or black_piece_agent:",
                "   - Forward the move request to that agent",
                "   - Return their move response directly without modification",
                "3. If no current_player is specified:",
                "   - This indicates a request for position analysis",
                "   - Analyze the position yourself and respond with a JSON object:",
                "   {",
                "       'game_over': true/false,",
                "       'result': 'white_win'/'black_win'/'draw'/null,",
                "   }",
                "",
                "Do not modify player agent responses.",
                "For analysis requests, provide detailed evaluation of the position.",
            ],
            debug_mode=debug_mode,
            markdown=True,
            show_members_responses=True,
        )

    except Exception as e:
        logger.error(f"Error initializing chess team: {str(e)}")
        raise