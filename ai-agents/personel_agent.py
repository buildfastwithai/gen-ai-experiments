"""
AgentOS — Personal Life Assistant with ChromaDB vector retrieval
"""

import os
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.os import AgentOS
from agno.team import Team
from agno.tools.duckduckgo import DuckDuckGoTools

# --- Vector DB and embeddings ---
import chromadb
from chromadb.utils import embedding_functions

# Initialize Chroma client (in-memory or persistent)
chroma_client = chromadb.Client()
from dotenv import load_dotenv
load_dotenv()

# Choose embedding function:
if os.getenv("OPENAI_API_KEY"):
    embedding_fn = embedding_functions.OpenAIEmbeddingFunction(
        api_key=os.getenv("OPENAI_API_KEY"), model_name="text-embedding-3-small"
    )
else:
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

# Create collection for knowledge base
kb_collection = chroma_client.get_or_create_collection(
    name="personal_assistant_kb",
    embedding_function=embedding_fn
)

# --- Add sample docs ---
docs = [
    {"id": "r1", "title": "5-Min Avocado Toast",
     "text": "Mash avocado with lemon/salt, toast bread, spread, add chili or egg if desired."},
    {"id": "r2", "title": "Simple Budget Template",
     "text": "Track monthly income and expenses using 50/30/20 rule."},
    {"id": "f1", "title": "10-Min Low Impact Home Workout",
     "text": "Warm-up 2 min march in place. Circuit: squats, push-ups, glute bridges, side planks."},
]

for d in docs:
    kb_collection.add(
        ids=[d["id"]],
        documents=[d["text"]],
        metadatas=[{"title": d["title"], "created_at": datetime.now(timezone.utc).isoformat()}]
    )

# --- Knowledge wrapper ---
# --- Knowledge wrapper that AgentOS expects (updated) ---
from typing import Dict, Any, List, Optional

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
        self.collection.add(
            ids=[doc_id],
            documents=[text],
            metadatas=[{"title": title, **metadata}],
        )
        return {"id": doc_id, "title": title, "text": text, "metadata": metadata}

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
        # Chroma's query supports `where` for filtering; only pass it if filters provided.
        query_kwargs = {"query_texts": [query], "n_results": n}
        if filters:
            # Chroma expects 'where' to be a dict
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


knowledge = KnowledgeChroma(kb_collection, max_results=8)

# --- Set up agents ---
fast_model = OpenAIChat(id="gpt-5-mini")

life_agent = Agent(
    name="Life Agent",
    id="life_agent",
    role="Personal assistant for everyday tasks.",
    model=fast_model,
    instructions=[
        "Use ChromaDB-backed KB for recipes, workouts, or budget tips.",
        "Keep responses short and practical."
    ],
    knowledge=knowledge,
)

team = Team(
    name="Personal Life Team",
    id="personal_life_team",
    description="Agents for personal productivity, fitness, travel, and finance.",
    members=[life_agent],
    model=fast_model,
)

agent_os = AgentOS(
    id="agentos-personal-assistant-chroma",
    agents=[life_agent],
    teams=[team],
)

app = agent_os.get_app()

SAMPLE_PROMPTS = [
    # Life agent tasks
    'Add a to-do: "Schedule dentist appointment next Monday at 10am" and remind me the day before.',
    'List my open to-dos and show which are due within 48 hours.',
    # Recipe
    'I have eggs, spinach, bread, and tomatoes. Suggest 3 quick recipes for dinner and a shopping list for missing items.',
    'Create a 3-day vegetarian meal plan with breakfast, lunch, dinner and a compact shopping list.',
    # Travel
    'Plan a weekend trip to Goa from Nov 21-23: suggest a 2-day itinerary, packing checklist, and rough cost estimate for 2 people.',
    # Finance
    'Summarize my budget for 2025-11 (income $2500, expenses rent $800, groceries $250, transport $100). Suggest 3 ways to save $100/month.',
    # Fitness
    'I have 15 minutes and a bad knee. Give me a low-impact workout I can do at home.',
]

if __name__ == "__main__":
    agent_os.serve(app="personel_agent:app", port=7777)
