import os
from dotenv import load_dotenv

# Always load backend/.env and override existing shell values so stale
# terminal environment variables do not force fallback mode accidentally.
ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=ENV_PATH, override=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
USE_GEMINI = bool(GEMINI_API_KEY and not GEMINI_API_KEY.startswith("demo-"))

if USE_GEMINI:
    print("✓ Configuration loaded in Gemini mode")
else:
    print("⚠ Configuration loaded in local fallback mode (set GEMINI_API_KEY for Gemini)")

print(f"✓ Configuration loaded: port={BACKEND_PORT}, frontend={FRONTEND_URL}")

