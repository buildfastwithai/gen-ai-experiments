"""
improved_personal_agent.py

Improved AgentOS single-file app:
- Uses SqliteDb for agent persistence (like your example).
- Uses Claude model (as in your example) for the agent.
- Uses ChromaDB for vector knowledge (with OpenAI or SentenceTransformer embeddings).
- Exposes a KnowledgeChroma wrapper with the attributes AgentOS expects.
- Preloads a few sample docs and user helpers (todos/budget/workouts).
"""

import os
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

# AgentOS imports
from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from agno.models.anthropic import Claude
from agno.os import AgentOS
from agno.team import Team
from agno.tools.mcp import MCPTools
from agno.tools.duckduckgo import DuckDuckGoTools

# Chroma + Embeddings
try:
    import chromadb
    from chromadb.utils import embedding_functions
except Exception as e:
    raise RuntimeError(
        "chromadb import failed. Install chromadb and its dependencies: `pip install chromadb`.\n"
        f"Original error: {e}"
    )

# Optional local embedding fallback
USE_OPENAI = bool(os.getenv("OPENAI_API_KEY"))

# ---------- Chroma client & embedding setup ----------
# Use in-memory client by default; change to PersistentClient(path=...) if you want persistence.
chroma_client = chromadb.Client()

if USE_OPENAI:
    emb_fn = embedding_functions.OpenAIEmbeddingFunction(
        api_key=os.getenv("OPENAI_API_KEY"),
        model_name="text-embedding-3-small"
    )
else:
    # SentenceTransformer fallback
    emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

# Create or get a collection for the assistant KB
KB_COLLECTION_NAME = "personal_assistant_kb"
kb_collection = chroma_client.get_or_create_collection(
    name=KB_COLLECTION_NAME,
    embedding_function=emb_fn
)

# ---------- Knowledge wrapper that AgentOS expects ----------
class KnowledgeChroma:
    """
    Thin wrapper around a Chroma collection that exposes:
      - contents_db attribute (AgentOS auto-discovery expects this)
      - max_results attribute (AgentOS reads this)
      - add_doc, get_doc, search methods used by agents
    """
    def __init__(self, collection, max_results: int = 5):
        self.collection = collection
        # Expose contents_db so AgentOS won't crash during auto-discovery.
        self.contents_db = collection
        # Number of results AgentOS/agents will request by default
        self.max_results = int(max_results)

    def add_doc(self, doc_id: str, title: str, text: str, metadata: Dict[str, Any] = None):
        metadata = metadata or {}
        # Keep title in metadata for quick retrieval
        meta = {"title": title, **metadata}
        # Add/Upsert to collection
        # Chroma will deduplicate by id if same id exists
        self.collection.add(
            ids=[doc_id],
            documents=[text],
            metadatas=[meta],
        )
        return {"id": doc_id, "title": title, "text": text, "metadata": meta}

    def get_doc(self, doc_id: str) -> Optional[Dict[str, Any]]:
        try:
            res = self.collection.get(ids=[doc_id])
            if res and res.get("ids"):
                ids = res.get("ids")[0]
                docs = res.get("documents")[0]
                metas = res.get("metadatas")[0]
                if len(ids) > 0:
                    return {"id": ids[0], "title": metas[0].get("title"), "text": docs[0], "metadata": metas[0]}
        except Exception:
            pass
        return None

    def search(self, query: str, top_k: Optional[int] = None, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Query the Chroma collection.

        - top_k: overrides self.max_results if provided.
        - filters: a dict used as Chroma 'where' clause (optional).
        """
        n = int(top_k) if top_k is not None else int(self.max_results)
        query_kwargs = {"query_texts": [query], "n_results": n}
        if filters:
            # Chroma expects 'where' to be a dict describing metadata filters
            query_kwargs["where"] = filters

        res = self.collection.query(**query_kwargs)
        results = []
        ids = res.get("ids", [[]])[0]
        docs = res.get("documents", [[]])[0]
        metas = res.get("metadatas", [[]])[0]
        dists = res.get("distances", [[]])[0] if "distances" in res else [None] * len(ids)

        for i, doc_id in enumerate(ids):
            meta_dict = metas[i] if metas and isinstance(metas[i], dict) else {}
            text = docs[i] if docs and i < len(docs) else None
            results.append({
                "doc_id": doc_id,
                "title": meta_dict.get("title"),
                "snippet": (text[:400] if text else None),
                "score": float(dists[i]) if dists and dists[i] is not None else None,
                "metadata": meta_dict,
            })
        return results

# Instantiate wrapper
knowledge = KnowledgeChroma(kb_collection, max_results=6)

# ---------- Preload KB with sample docs (idempotent) ----------
SAMPLE_DOCS = [
    {"id": "r1", "title": "5-Min Avocado Toast",
     "text": "Mash avocado with lemon/salt, toast bread, spread, add chili or egg if desired. Ready in 5-7 minutes."},
    {"id": "r2", "title": "Simple Budget Template",
     "text": "Track monthly income and expenses. Try 50% needs / 30% wants / 20% savings. Keep recurring expenses separate."},
    {"id": "w1", "title": "10-Min Low Impact Home Workout",
     "text": "Warm-up 2 min march in place. Circuit: chair squats 40s, incline push-ups 30s, glute bridges 40s, side plank 20s each side. Repeat 2 rounds."},
    {"id": "m1", "title": "Egg Spinach Omelette",
     "text": "Beat eggs, add chopped spinach and tomato, fry on low-med heat, fold and serve with toast."}
]

for d in SAMPLE_DOCS:
    # add_doc is idempotent if same id is added again
    knowledge.add_doc(d["id"], d["title"], d["text"], metadata={"source": "sample"})

# ---------- Simple in-memory helpers (user-facing) ----------
# These are not persisted in Chroma; agent DB will use SqliteDb for history/memories
def add_todo(store: Dict[str, Dict[str, Any]], todo_id: str, title: str, due: Optional[str] = None, note: str = ""):
    item = {"id": todo_id, "title": title, "note": note, "created_at": datetime.now(timezone.utc).isoformat(), "due": due, "status": "open"}
    store[todo_id] = item
    return item

# lightweight in-file user store (non-persistent across process restarts)
USER_STORE: Dict[str, Dict[str, Any]] = {}
add_todo(USER_STORE, "todo-1", "Buy groceries: milk, eggs, spinach", (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(), "Prefer fresh spinach")

# ---------- Agent configuration (following your simple_agent logic) ----------
# Database file for agent memory & persistence
SQLITE_DB_FILE = os.getenv("AGENT_SQLITE_DB", "tmp/personal_agent.db")
db = SqliteDb(db_file=SQLITE_DB_FILE)

# Model - follow your example (Claude). Swap out for OpenAI/Anthropic as you prefer.
agent_model = Claude(id=os.getenv("CLAUDE_MODEL_ID", "claude-sonnet-4-5"))

# Tools
mcp = MCPTools(transport="streamable-http", url=os.getenv("MCP_URL", "https://docs.agno.com/mcp"))
ddg = DuckDuckGoTools()

# Create the Agent
personal_agent = Agent(
    name="Personal Life Agent",
    model=agent_model,
    db=db,
    tools=[mcp, ddg],
    add_history_to_context=True,
    add_datetime_to_context=True,
    enable_agentic_memory=True,
    num_history_runs=3,
    markdown=True,
    # Provide our Chroma-backed knowledge directly
    knowledge=knowledge,
    role="Friendly personal assistant: recipes, budgets, quick planning, workouts.",
    instructions=[
        "Check the KB (Chroma) first for quick recipes, workouts, or tips.",
        "When the user asks to add/complete/list todos or budgets, use helper functions and confirm action.",
        "Be concise and show short snippets of matched knowledge when relevant."
    ],
)

# Optional: create a small team (mirrors your earlier multi-agent idea)
personal_team = Team(
    name="Personal Life Team",
    id="personal_life_team",
    description="Agents that help with everyday life tasks (recipes, travel, finance, fitness).",
    members=[personal_agent],
    model=agent_model,
    instructions=["Coordinate sensibly when multi-agent responses are requested."],
    db=db,
    enable_user_memories=True,
    add_datetime_to_context=True,
    markdown=True,
)

# Create AgentOS
agent_os = AgentOS(
    agents=[personal_agent],
    teams=[personal_team],
    id="improved-personal-agent"
)

app = agent_os.get_app()

# ---------- Small CLI helper to show searching works ----------
def debug_search(q: str):
    print(f"\n== Searching KB for: {q}")
    results = knowledge.search(q)
    for r in results:
        print(f"- {r['title']} ({r['doc_id']}) score={r['score']} snippet={r['snippet'][:120]}")

if __name__ == "__main__":
    # Quick debug: run a sample search
    debug_search("quick dinner recipes using eggs, spinach, bread, tomatoes")
    # Serve the web UI (reload useful in dev)
    agent_os.serve(app="improved_personal_agent:app", reload=True)
