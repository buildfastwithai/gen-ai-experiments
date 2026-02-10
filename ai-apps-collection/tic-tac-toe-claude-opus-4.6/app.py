
import streamlit as st
from agno.agent import Agent
from agno.models.openrouter import OpenRouter
import os

# --- PAGE CONFIG ---
st.set_page_config(
    page_title="Agno Agent Tic-Tac-Toe",
    page_icon="dX",
    layout="centered"
)

# --- SIDEBAR CONFIGURATION ---
with st.sidebar:
    st.header("Configuration")
    
    # 1. API Key Input
    api_key = st.text_input("Enter OpenRouter API Key", type="password")
    
    st.markdown("---")

    # 2. Model Selection
    st.subheader("Choose Your Fighter")
    
    # Model Map
    MODEL_MAP = {
        "Claude Opus 4.6": "anthropic/claude-opus-4.6",
        "Kimi 2.5": "moonshotai/kimi-k2-thinking",
    }
    
    # Player X Selection
    selected_name = st.selectbox(
        "Select Player X (Challenger)",
        options=list(MODEL_MAP.keys()),
        index=0
    )
    player_x_model = MODEL_MAP[selected_name]

    # Player O: Kimi 2.5
    st.info("Player O (Champion): Kimi 2.5")
    player_o_model = "moonshotai/kimi-k2.5"  # Fixed as Champion
    
    st.markdown("---")
    
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

# --- BATTLE VIBES STYLING ---
st.markdown("""
<style>
    .battle-title {
        font-family: 'Verdana', sans-serif;
        background: -webkit-linear-gradient(45deg, #FF0000, #FFD700);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 3em;
        font-weight: 900;
        text-align: center;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        margin-bottom: 0px;
    }
    .vs-container {
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 1.5em;
        font-weight: bold;
        margin: 20px 0;
    }
    .player-x { color: #0099CC; font-size: 1.2em; text-shadow: 0 0 10px #0099CC; }
    .vs-text { 
        margin: 0 20px; 
        color: #FF00FF; 
        font-style: italic; 
        text-shadow: 0 0 10px #FF00FF;
    }
    .player-o { color: #FF8800; font-size: 1.2em; text-shadow: 0 0 10px #FF8800; }
</style>
""", unsafe_allow_html=True)


# --- GAME LOGIC ---

def check_winner(board):
    # Winning combinations
    lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],  # Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8],  # Cols
        [0, 4, 8], [2, 4, 6]              # Diagonals
    ]
    for line in lines:
        if board[line[0]] == board[line[1]] == board[line[2]] and board[line[0]] is not None:
            return board[line[0]]
    if None not in board:
        return "Draw"
    return None

from pydantic import BaseModel, Field

class Move(BaseModel):
    cell_index: int = Field(..., description="The index of the cell to play (0-8).")

# --- TEAM ARCHITECTURE ---

class PlayerAgent:
    def __init__(self, model_id, api_key, symbol, description):
        self.symbol = symbol
        self.model_id = model_id
        try:
            self.agent = Agent(
                model=OpenRouter(id=model_id, api_key=api_key),
                description=description,
                instructions=[
                    f"You are playing Tic-Tac-Toe as '{symbol}'.",
                    "The board is a 3x3 grid with indices 0-8.",
                    "Your goal is to win.",
                    "You MUST pick an EMPTY cell.",
                    "Return ONLY the `cell_index` in JSON format.",
                    "Do NOT return any text outside the JSON.",
                ],
                response_model=Move,
                markdown=False,
            )
        except Exception as e:
            st.error(f"Failed to initialize agent for {symbol}: {e}")
            self.agent = None

    def get_move(self, context, feedback=None):
        prompt = f"{context}\n\nCRITICAL: Return ONLY the JSON for the move. Do not explain."
        if feedback:
            prompt += f"\n\nPREVIOUS ERROR: {feedback}\nYou MUST pick a different move from the Available Moves list."
        
        try:
            response = self.agent.run(prompt)
            # Handle Response Handling & Parsing
            if isinstance(response.content, Move):
                 return response.content.cell_index
            elif isinstance(response.content, str):
                 # Fallback parsing
                 import re
                 import json
                 clean_content = response.content.replace("```json", "").replace("```", "").strip()
                 try:
                     data = json.loads(clean_content)
                     return Move(**data).cell_index
                 except:
                     match = re.search(r'\d+', response.content)
                     if match:
                         return int(match.group())
        except Exception as e:
            print(f"Agent {self.symbol} error: {e}")
        return None

class GameSupervisor:
    def __init__(self, board):
        self.board = board

    def validate_move(self, move):
        if move is None:
            return False, "No move received."
        if not isinstance(move, int):
             return False, "Move must be an integer."
        if not (0 <= move <= 8):
            return False, f"Move {move} is out of bounds (0-8)."
        if self.board[move] is not None:
             return False, f"Cell {move} is already occupied."
        return True, None

def get_team_move(board, api_key, model_id, player_symbol):
    if not api_key:
        return None

    # Supervisor prepares the board state for the agent
    # Visual Grid Board
    grid_lines = []
    for i in range(0, 9, 3):
        row_cells = []
        for j in range(3):
            idx = i + j
            # Show index if empty, else show symbol
            val = str(idx) if board[idx] is None else board[idx]
            row_cells.append(val)
        grid_lines.append(" | ".join(row_cells))
    
    board_visual = "\n---------\n".join(grid_lines)
    
    available_moves = [i for i, x in enumerate(board) if x is None]
    
    # Context string passed to agent
    board_context = f"""
You are playing Tic-Tac-Toe.
Symbol: {player_symbol}
Current Board (numbers are indices):
{board_visual}

Available Moves: {available_moves}
"""
    
    # Initialize the specific player agent
    player = PlayerAgent(
        model_id=model_id, 
        api_key=api_key, 
        symbol=player_symbol,
        description=f"You are the {player_symbol} player in a Tic-Tac-Toe team."
    )
    
    if not player.agent:
        return None

    # Retry Loop (Supervisor logic)
    max_retries = 3
    feedback = None
    
    for attempt in range(max_retries):
        move = player.get_move(board_context, feedback)
        
        # Validate logic
        is_valid, error = GameSupervisor(board).validate_move(move)
        
        if is_valid:
            return move
        else:
            feedback = error
            print(f"Supervisor rejected move {move}: {feedback}")
            continue

    st.warning(f"Supervisor terminated turn for {player_symbol} after {max_retries} failed attempts.")
    return None

# Initialize Game State
if "board" not in st.session_state:
    st.session_state.board = [None] * 9
if "turn" not in st.session_state:
    st.session_state.turn = "X" # X is Challenger, O is Champion
if "winner" not in st.session_state:
    st.session_state.winner = None
if "game_active" not in st.session_state:
    st.session_state.game_active = True

# --- MAIN APP UI ---
st.markdown('<div class="battle-title">🤖 AI TIC-TAC-TOE 🤖</div>', unsafe_allow_html=True)

# Helper to get display name from ID
def get_display_name(model_id):
    inv_map = {v: k for k, v in MODEL_MAP.items()}
    return inv_map.get(model_id, model_id)

display_x = selected_name
display_o = "Kimi 2.5"

st.markdown(
    f"""
    <div class="vs-container">
        <span class="player-x">{display_x} (X)</span>
        <span class="vs-text">VS</span>
        <span class="player-o">{display_o} (O)</span>
    </div>
    """,
    unsafe_allow_html=True
)
st.caption("Powered by Agno Agents & OpenRouter")

# Status Message
# Status Message
if st.session_state.winner:
    if st.session_state.winner == "Draw":
        st.info("Game Over! It's a Draw!")
    else:
        winner_model_id = player_x_model if st.session_state.winner == "X" else player_o_model
        st.success(f"Game Over! Winner: {st.session_state.winner} ({get_display_name(winner_model_id)})")
    # Stop game if over
    st.session_state.game_active = False
else:
    current_model_id = player_x_model if st.session_state.turn == "X" else player_o_model
    st.markdown(f"### Turn: **{st.session_state.turn}** ")

# Auto-Play Logic State
if "auto_play" not in st.session_state:
    st.session_state.auto_play = False

# Grid Layout
for i in range(0, 9, 3):
    cols = st.columns(3)
    for j in range(3):
        index = i + j
        with cols[j]:
            cell_value = st.session_state.board[index]
            label = cell_value if cell_value else " "
            
            # Rendering HTML Board
            color = "#333"
            bg_color = "#f0f0f0"
            if cell_value == "X":
                color = "white"
                bg_color = "#0099CC" # Blue
            elif cell_value == "O":
                color = "white"
                bg_color = "#FF8800" # Orange
            
            st.markdown(
                f"""
                <div style="
                    height: 100px;
                    width: 100%;
                    background-color: {bg_color};
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 40px;
                    font-weight: bold;
                    color: {color};
                    margin-bottom: 10px;
                ">
                    {label}
                </div>
                """,
                unsafe_allow_html=True
            )

st.markdown("---")

# Control Buttons (Consistent across session, placed below board)
col1, col2 = st.columns(2)
with col1:
    # Start/Stop Button
    if st.session_state.auto_play:
        if st.button("Stop Match", use_container_width=True):
            st.session_state.auto_play = False
            st.rerun()
    else:
        # Disable start if game is over (winner exists) OR no API key
        # Check if board is full (Draw) is handled by winner check usually, 
        # but let's ensure we can't start if it's already done unless reset.
        is_game_over = st.session_state.winner is not None
        if st.button("Start Match", disabled=is_game_over or not api_key, use_container_width=True):
            if not api_key:
                st.error("Enter API Key first!")
            else:
                st.session_state.auto_play = True
                st.rerun()

with col2:
    if st.button("Restart Game", use_container_width=True):
        st.session_state.board = [None] * 9
        st.session_state.turn = "X"
        st.session_state.winner = None
        st.session_state.game_active = True
        st.session_state.auto_play = False # Stop auto play on restart
        st.rerun()

# Execute Move if Auto-Play is ON and Game is Active
if st.session_state.auto_play and st.session_state.game_active:
    import time
    time.sleep(1) # Add delay for watchability
    
    with st.spinner(f"{st.session_state.turn} is thinking..."):
        current_model_id = player_x_model if st.session_state.turn == "X" else player_o_model
        move = get_team_move(st.session_state.board, api_key, current_model_id, st.session_state.turn)
        
        if move is not None:
            st.session_state.board[move] = st.session_state.turn
            
            winner = check_winner(st.session_state.board)
            if winner:
                st.session_state.winner = winner
                st.session_state.game_active = False
                st.session_state.auto_play = False # Stop auto play when game ends
            else:
                st.session_state.turn = "O" if st.session_state.turn == "X" else "X"
            st.rerun()
