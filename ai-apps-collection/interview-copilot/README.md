# Interview Copilot

Real-time voice interview coaching powered by Gemini 3.1 Flash Live.

## Description

Interview Copilot is a full-stack web app that listens to your spoken interview answers and streams AI feedback in real time. It captures microphone audio in the browser, sends it to a FastAPI backend over WebSocket, and returns structured coaching output as you speak.

The app focuses on low-latency interview practice with:
- Live transcript cleanup
- Better answer suggestions
- Filler-word detection
- Follow-up question generation

## Architecture

```text
Frontend (Next.js 15)
|- Web Audio API microphone capture
|- PCM16 encoding (16kHz, mono)
'- WebSocket client

Backend (FastAPI)
|- WebSocket server
|- Session handling and response parsing
'- Gemini 3.1 Flash Live integration
```

## Features

- Real-time voice streaming and progressive AI responses
- Automatic WebSocket reconnection and error handling
- Structured coaching output:
	- Transcript
	- Better Answer
	- Suggestion (only when needed)
	- Follow-ups
- Health endpoint for backend monitoring

## Prerequisites

- Node.js 18+
- Python 3.9+
- Gemini API key from Google AI Studio
- Browser with microphone support

## Local Setup

### 1) Backend

```bash
cd backend
python -m venv .venv
```

Activate virtual environment:

```powershell
# Windows PowerShell
.venv\Scripts\Activate.ps1
```

```bash
# macOS/Linux
source .venv/bin/activate
```

Install dependencies and configure env:

```bash
pip install -r requirements.txt
```

Create `.env` in `backend/` with:

```env
GEMINI_API_KEY=your_gemini_api_key_here
BACKEND_PORT=8000
FRONTEND_URL=http://localhost:3000
```

Run backend:

```bash
python main.py
```

### 2) Frontend

```bash
cd frontend
npm install
```

Create `.env.local` in `frontend/` with:

```env
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

Run frontend:

```bash
npm run dev
```

Open http://localhost:3000

## Usage

1. Click Start Recording.
2. Allow microphone access.
3. Speak your interview response naturally.
4. Review streamed Transcript, Better Answer, Suggestion, and Follow-ups.
5. Click Stop when done.

## WebSocket Contract

Client to server:
- Binary PCM16 audio chunks
- Control JSON:

```json
{
	"type": "control",
	"command": "start"
}
```

Server to client:

```json
{
	"type": "transcript",
	"content": "string"
}
```

Possible `type` values: `transcript`, `better_answer`, `suggestion`, `follow_ups`, `error`.

## API

- `GET /health` returns backend health and model metadata.
- `WS /ws` handles bi-directional audio and coaching messages.

## Project Structure

```text
interview-copilot/
|- frontend/
|  |- app/
|  |  |- page.tsx
|  |  |- layout.tsx
|  |  |- page.module.css
|  |  '- globals.css
|  |- lib/
|  |  |- audio.ts
|  |  '- ws.ts
|  '- package.json
'- backend/
	 |- main.py
	 |- config.py
	 '- requirements.txt
```

## Troubleshooting

- Connection errors: confirm backend is running at `http://localhost:8000/health`.
- No audio input: verify microphone permission in browser settings.
- Model errors: verify `GEMINI_API_KEY` is valid and has access to Live API.
- Frequent disconnects: check local network stability and backend logs.

## Deployment

- Frontend: Vercel
- Backend: Railway / Render / Fly.io
- Use secure `wss://` URL for production WebSocket traffic.

## License

MIT
