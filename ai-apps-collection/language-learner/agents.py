from typing import List, Optional

from pydantic import BaseModel, Field

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.storage.sqlite import SqliteStorage


class CorrectionAndScore(BaseModel):
    corrected_sentence: str = Field(..., description="Corrected version of the user's sentence.")
    explanation: str = Field(..., description="English explanation of the correction in a friendly tone.")
    mistakes: List[str] = Field(default_factory=list, description="List of specific mistakes identified.")
    overall_score: int = Field(..., ge=0, le=100, description="Overall quality score.")
    points_awarded: int = Field(..., ge=0, description="Points to award the user for this message.")
    concept_notes: Optional[str] = Field(
        default=None,
        description="One-sentence note about the concept practiced or learned.",
    )


class QuizQuestion(BaseModel):
    prompt: str
    options: List[str]
    correct_index: int
    points: int = 10


class Quiz(BaseModel):
    title: str
    description: str
    questions: List[QuizQuestion]


class VocabPair(BaseModel):
    term_native: str = Field(..., description="English translation or learner's base language term")
    term_target: str = Field(..., description="Term in the target language")


class VocabPairs(BaseModel):
    pairs: List[VocabPair]


def build_language_tutor_agent(target_language: str, current_concept: str, db_file: str) -> Agent:
    return Agent(
        model=OpenAIChat(id="gpt-4o-mini"),
        storage=SqliteStorage(table_name="agent_sessions", db_file=db_file),
        description=(
            "You are a helpful language tutor. Always reply strictly in the target language. "
            "Keep responses short, conversational, and focused on the current concept."
        ),
        instructions=(
            "Target language: {target_language}. Current concept: {current_concept}. "
            "Do not translate to English. Encourage the learner briefly."
        ),
        session_state={
            "target_language": target_language,
            "current_concept": current_concept,
        },
        add_state_in_messages=True,
        markdown=True,
    )


def build_correction_scoring_agent(target_language: str, current_concept: str, db_file: str) -> Agent:
    return Agent(
        model=OpenAIChat(id="gpt-4o"),
        storage=SqliteStorage(table_name="agent_sessions", db_file=db_file),
        description=(
            "You are a third-party corrector and scorer. You never speak the target language. "
            "You analyze the user's message and the tutor reply. Provide corrections in English, "
            "a friendly explanation, a list of mistakes, an overall score 0-100, and points to award."
        ),
        instructions=(
            "Target language: {target_language}. Concept: {current_concept}. "
            "Return a structured object following the response model."
        ),
        response_model=CorrectionAndScore,
        use_json_mode=True,
        session_state={
            "target_language": target_language,
            "current_concept": current_concept,
        },
        add_state_in_messages=True,
        markdown=False,
    )


def build_quiz_agent(target_language: str, current_concept: str, db_file: str) -> Agent:
    return Agent(
        model=OpenAIChat(id="gpt-5"),
        storage=SqliteStorage(table_name="agent_sessions", db_file=db_file),
        description=(
            "You generate short, fun multiple-choice quizzes in HTML-friendly content."
        ),
        instructions=(
            "Target language: {target_language}. Concept: {current_concept}. "
            "Generate 4-6 MCQs. Each has options and exactly one correct index."
        ),
        response_model=Quiz,
        use_json_mode=True,
        session_state={
            "target_language": target_language,
            "current_concept": current_concept,
        },
        add_state_in_messages=True,
        markdown=False,
    )


def build_vocab_pairs_agent(target_language: str, current_concept: str, db_file: str) -> Agent:
    return Agent(
        model=OpenAIChat(id="gpt-4o-mini"),
        storage=SqliteStorage(table_name="agent_sessions", db_file=db_file),
        description=(
            "Generate concise vocabulary pairs for a matching game."
        ),
        instructions=(
            "Target language: {target_language}. Concept: {current_concept}. "
            "Return 6-8 pairs of (term_native, term_target) relevant to the concept."
        ),
        response_model=VocabPairs,
        use_json_mode=True,
        session_state={
            "target_language": target_language,
            "current_concept": current_concept,
        },
        add_state_in_messages=True,
        markdown=False,
    )


def build_card_match_html_agent(target_language: str, current_concept: str, db_file: str) -> Agent:
    return Agent(
        model=OpenAIChat(id="gpt-5"),
        storage=SqliteStorage(table_name="agent_sessions", db_file=db_file),
        description=(
            "Return only a complete, self-contained HTML document for a bilingual card matching game."
        ),
        instructions=(
            "Target language: {target_language}. Concept: {current_concept}.\n"
            "Requirements: Inline CSS and JS. 12 cards (6 pairs). Shuffle on load. Click to flip.\n"
            "Show current score and attempts. On match, keep cards face-up. Provide a 'Restart' button.\n"
            "Design: modern, high-contrast. Avoid external assets, no markdown, no backticks, HTML only."
        ),
        session_state={
            "target_language": target_language,
            "current_concept": current_concept,
        },
        add_state_in_messages=True,
        markdown=False,
    )


