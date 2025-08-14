import os
import json
from pathlib import Path
from typing import List, Dict, Optional, Any, Type, TypeVar

import streamlit as st

from agents import (
    build_language_tutor_agent,
    build_correction_scoring_agent,
    build_quiz_agent,
    CorrectionAndScore,
    Quiz,
    build_vocab_pairs_agent,
    VocabPairs,
    build_card_match_html_agent,
)


APP_TITLE = "GPT-5 🎓 WordWise- Language Tutor"
DB_DIR = Path("tmp")
DB_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_DB_FILE = str(DB_DIR / "agent.db")


def initialize_session_state() -> None:
    if "initialized" in st.session_state:
        return

    st.session_state.initialized = True
    st.session_state.mode = "Chat Mode"
    st.session_state.target_language = "spanish"
    st.session_state.current_concept = "greetings"
    st.session_state.dashboard = {
        "total_points": 0,
        "num_chats": 0,
        "avg_score": 0.0,
        "history": [],  # list of {type: chat|game, score: int, label: str}
    }
    st.session_state.notes: List[str] = []
    st.session_state.chat_messages: List[Dict[str, str]] = []  # {role: user|tutor|corrector, content: str}
    st.session_state.quiz: Optional[Quiz] = None
    st.session_state.quiz_answers: Dict[int, int] = {}


def render_sidebar(api_key: Optional[str]) -> None:
    with st.sidebar:
        st.title("Dashboard")

        # Metrics
        col1, col2 = st.columns(2)
        col1.metric("Total Points", st.session_state.dashboard["total_points"]) 
        col2.metric(
            "Avg Score",
            f"{st.session_state.dashboard['avg_score']:.1f}",
        )

        # Simple history chart
        try:
            import pandas as pd
            import plotly.express as px

            if st.session_state.dashboard["history"]:
                df = pd.DataFrame(st.session_state.dashboard["history"])
                fig = px.bar(
                    df,
                    x=df.index,
                    y="score",
                    color="type",
                    title="Progress",
                    labels={"x": "Entry", "score": "Points"},
                    height=250,
                )
                st.plotly_chart(fig, use_container_width=True)
        except Exception:
            pass

        st.divider()
        st.write("Download Notes")
        notes_md = "\n".join(f"- {note}" for note in st.session_state.notes) or "No notes yet."
        st.download_button(
            label="Download .md",
            data=notes_md.encode("utf-8"),
            file_name="learned_notes.md",
            mime="text/markdown",
        )

        st.divider()
        st.caption("Set your API key in the sidebar above to start.")

        if api_key:
            st.success("API key set")
        else:
            st.info("Enter your OpenAI API key to enable AI features.")


def update_dashboard(score: int, entry_type: str, label: str) -> None:
    dash = st.session_state.dashboard
    dash["total_points"] += int(score)
    dash["history"].append({"type": entry_type, "score": int(score), "label": label})
    # Update averages for chat entries
    if entry_type == "chat":
        dash["num_chats"] += 1
        total_chat_points = sum(h["score"] for h in dash["history"] if h["type"] == "chat")
        dash["avg_score"] = total_chat_points / max(1, dash["num_chats"])


def ensure_api_key(key: Optional[str]) -> bool:
    if not key:
        return False
    os.environ["OPENAI_API_KEY"] = key
    return True


T = TypeVar("T")


def coerce_to_model(model_cls: Type[T], result: Any) -> Optional[T]:
    """Attempt to coerce various result shapes (RunResponse, dict, json string) into a Pydantic model."""
    # Direct instance
    if isinstance(result, model_cls):
        return result

    # RunResponse-like object with .content
    payload = getattr(result, "content", result)

    # If payload is already the model
    if isinstance(payload, model_cls):
        return payload

    # If dict
    if isinstance(payload, dict):
        try:
            return model_cls.model_validate(payload)  # type: ignore[attr-defined]
        except Exception:
            pass

    # If string, try JSON
    if isinstance(payload, str):
        try:
            data = json.loads(payload)
            if isinstance(data, dict):
                return model_cls.model_validate(data)  # type: ignore[attr-defined]
        except Exception:
            pass

    return None


def chat_mode_ui(api_key: Optional[str]) -> None:
    st.subheader("Chat Mode")
    st.caption("Chat only in your target language. A corrector will jump in with English explanations if you make mistakes.")

    if not ensure_api_key(api_key):
        st.warning("Please enter your OpenAI API key in the sidebar to use Chat Mode.")
        return

    # Build agents (kept in local scope; they rely on session state values)
    tutor_agent = build_language_tutor_agent(
        target_language=st.session_state.target_language,
        current_concept=st.session_state.current_concept,
        db_file=DEFAULT_DB_FILE,
    )
    correction_agent = build_correction_scoring_agent(
        target_language=st.session_state.target_language,
        current_concept=st.session_state.current_concept,
        db_file=DEFAULT_DB_FILE,
    )

    # Render history
    for msg in st.session_state.chat_messages:
        with st.chat_message(msg["role"]).container():
            st.markdown(msg["content"])

    prompt = st.chat_input(f"Speak in {st.session_state.target_language} about {st.session_state.current_concept}...")
    if prompt:
        st.session_state.chat_messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Tutor responds in target language
        with st.chat_message("assistant"):
            with st.spinner("Tutor is thinking..."):
                tutor_response = tutor_agent.run(prompt)
                tutor_text = tutor_response.content if hasattr(tutor_response, "content") else str(tutor_response)
                st.markdown(tutor_text)
        st.session_state.chat_messages.append({"role": "assistant", "content": tutor_text})

        # Corrector evaluates user's last message and gives English feedback + score
        with st.chat_message("assistant"):
            with st.spinner("Corrector is reviewing..."):
                corr_raw = correction_agent.run(
                    json.dumps(
                        {
                            "target_language": st.session_state.target_language,
                            "concept": st.session_state.current_concept,
                            "user_message": prompt,
                            "tutor_reply": tutor_text,
                        }
                    )
                )
                corr = coerce_to_model(CorrectionAndScore, corr_raw)
                if corr is None:
                    st.error("Could not parse correction response. Please try again.")
                    return
                # corr is structured output; convert to readable text
                correction_md = (
                    f"**Corrections (English):**\n\n"
                    f"- Corrected: {corr.corrected_sentence}\n\n"
                    f"- Explanation: {corr.explanation}\n\n"
                    f"- Mistakes: "
                    + ("; ".join(corr.mistakes) if corr.mistakes else "None")
                    + f"\n\n**Score:** {corr.overall_score} / 100"
                )
                st.markdown(correction_md)
        st.session_state.chat_messages.append({"role": "corrector", "content": correction_md})

        # Update notes and dashboard
        if corr and corr.concept_notes:
            st.session_state.notes.append(corr.concept_notes)
        update_dashboard(score=int(getattr(corr, "points_awarded", 0) or 0), entry_type="chat", label=st.session_state.current_concept)


def render_quiz(quiz: Quiz) -> None:
    st.markdown(
        f"""
        <div style="padding:10px;border-radius:10px;background:#0b1020;border:1px solid #1f2937;">
            <h4 style="margin:0 0 6px 0;color:#e5e7eb;">{quiz.title}</h4>
            <p style="margin:0;color:#cbd5e1;">{quiz.description}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.write("\n")

    for idx, q in enumerate(quiz.questions):
        st.markdown(
            f"""
            <div style="padding:12px;margin:8px 0;border-radius:8px;background:#0f172a;color:#f8fafc;border:1px solid #1f2937;">
                <b>Q{idx+1}.</b> {q.prompt}
            </div>
            """,
            unsafe_allow_html=True,
        )
        # Use a selectbox with a placeholder to avoid preselecting the correct answer
        option_pairs = [(-1, "Select an answer...")] + list(enumerate(q.options))
        prev_idx = st.session_state.quiz_answers.get(idx, -1)
        default_index = 0
        if prev_idx != -1:
            for pos, (oi, _) in enumerate(option_pairs):
                if oi == prev_idx:
                    default_index = pos
                    break
        selected = st.selectbox(
            label=f"Select answer for Q{idx+1}",
            options=option_pairs,
            index=default_index,
            format_func=lambda opt: opt[1],
            key=f"quiz_q_{idx}",
        )
        st.session_state.quiz_answers[idx] = selected[0] if selected and selected[0] != -1 else None


def grade_quiz(quiz: Quiz) -> int:
    score = 0
    for idx, q in enumerate(quiz.questions):
        sel = st.session_state.quiz_answers.get(idx)
        if sel is not None and sel == q.correct_index:
            score += int(q.points)
    return score


def game_mode_ui(api_key: Optional[str]) -> None:
    st.subheader("Game Mode")
    st.caption("Play quick games to reinforce the concept. Try Quiz or Matching Cards.")

    if not ensure_api_key(api_key):
        st.warning("Please enter your OpenAI API key in the sidebar to use Game Mode.")
        return

    quiz_agent = build_quiz_agent(
        target_language=st.session_state.target_language,
        current_concept=st.session_state.current_concept,
        db_file=DEFAULT_DB_FILE,
    )
    vocab_agent = build_vocab_pairs_agent(
        target_language=st.session_state.target_language,
        current_concept=st.session_state.current_concept,
        db_file=DEFAULT_DB_FILE,
    )
    card_html_agent = build_card_match_html_agent(
        target_language=st.session_state.target_language,
        current_concept=st.session_state.current_concept,
        db_file=DEFAULT_DB_FILE,
    )

    game_type = st.radio("Choose a game", ["Card Match (beta)", "Quiz"], index=0)

    if game_type == "Quiz" and (st.button("Generate New Quiz") or st.session_state.quiz is None):
        with st.spinner("Generating quiz..."):
            quiz_raw = quiz_agent.run(
                f"Generate a short, fun quiz for {st.session_state.target_language} about {st.session_state.current_concept}."
            )
            st.session_state.quiz = coerce_to_model(Quiz, quiz_raw) or st.session_state.quiz
            st.session_state.quiz_answers = {}

    if game_type == "Quiz" and st.session_state.quiz:
        render_quiz(st.session_state.quiz)
        if st.button("Submit Answers"):
            score = grade_quiz(st.session_state.quiz)
            st.success(f"You scored {score} points!")
            update_dashboard(score=score, entry_type="game", label=st.session_state.current_concept)
            # Add brief note of what was reinforced
            st.session_state.notes.append(
                f"Quiz on {st.session_state.current_concept} in {st.session_state.target_language}: {score} points"
            )

    if game_type == "Card Match (beta)":
        if st.button("Generate Card Match Game"):
            with st.spinner("Generating HTML game..."):
                html_doc = card_html_agent.run(
                    f"Create a bilingual card-matching game for {st.session_state.target_language} concept {st.session_state.current_concept}."
                )
                html_text = getattr(html_doc, "content", str(html_doc))
                st.session_state["card_game_html"] = html_text
        if st.session_state.get("card_game_html"):
            st.components.v1.html(st.session_state["card_game_html"], height=700, scrolling=True)


def main() -> None:
    st.set_page_config(page_title=APP_TITLE, page_icon="🌍", layout="wide")
    initialize_session_state()

    # Sidebar controls
    with st.sidebar:
        st.title("🎓 WordWise")
        #st.markdown("<h1 style='text-align: center;'>🎓 WordWise</h1>", unsafe_allow_html=True)

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
        
        api_key = st.text_input("OpenAI API Key", type="password", placeholder="sk-...")
        languages = ["german", "spanish", "korean", "french", "italian", "chinese", "japanese"]
        default_lang_index = languages.index(st.session_state.target_language) if st.session_state.target_language in languages else 1
        st.session_state.target_language = st.selectbox("Target Language", languages, index=default_lang_index)
        topics = [
            "greetings",
            "introductions",
            "numbers",
            "days and months",
            "common verbs",
            "food and drinks",
            "directions",
            "family",
            "colors",
        ]
        default_topic_index = topics.index(st.session_state.current_concept) if st.session_state.current_concept in topics else 0
        st.session_state.current_concept = st.selectbox("Concept", topics, index=default_topic_index)
        st.session_state.mode = st.radio("Mode", ["Chat Mode", "Game Mode"], index=(0 if st.session_state.mode == "Chat Mode" else 1))

    # Right pane content
    st.title(APP_TITLE)
    st.write("Welcome to your learning journey! Choose a mode from the sidebar and get a, focused space to practice any language with games and real-time tutoring.")

    if st.session_state.mode == "Chat Mode":
        chat_mode_ui(api_key)
    else:
        game_mode_ui(api_key)

    # Sidebar dashboard and downloads
    render_sidebar(api_key)


if __name__ == "__main__":
    main()


