import asyncio
import json
import logging
import struct
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import google.genai as genai
from config import GEMINI_API_KEY, BACKEND_PORT, FRONTEND_URL, USE_GEMINI

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Gemini client only when a valid API key is configured.
genai_client = genai.Client(api_key=GEMINI_API_KEY) if USE_GEMINI else None
MODEL = "gemini-3.1-flash-live-preview"
TEXT_MODEL = "gemini-2.0-flash"

SYSTEM_PROMPT = """You are a real-time AI Interview Copilot.
The user is speaking live and may be incomplete or messy.
Continuously process partial input.

Tasks:
1. Clean the transcript of filler words (uh, um, like, etc.)
2. Generate a structured 'Better Answer'
3. Detect filler words like 'uh', 'um', 'like'
4. Suggest improvements ONLY if needed
5. Generate 1-2 likely follow-up questions

Output format (strict):
Transcript: [cleaned speech]
Better Answer: [polished response]
Suggestion: [only if fillers detected, otherwise empty]
Follow-ups: [1-2 questions]

Keep responses under 120 words.
Be fast, concise, and update incrementally."""

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown"""
    logger.info("🎤 Interview Copilot backend starting...")
    yield
    logger.info("🔌 Backend shutting down...")

app = FastAPI(
    title="Interview Copilot Backend",
    description="Real-time interview coaching with Gemini 3.1 Flash Live",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class InterviewSession:
    """Manages a single interview session with Gemini Live"""
    
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.gemini_context = None
        self.gemini_session = None
        self.is_active = True
        self.current_transcript = ""
        self.buffer = b""
        self.audio_chunk_count = 0
        self.fallback_notified = False
        self.receiver_task = None
        self.audio_queue = asyncio.Queue(maxsize=64)
        self.live_available = USE_GEMINI
        self.audio_buffer = bytearray()
        self.max_audio_bytes = 16_000 * 2 * 10  # 10s mono PCM16 at 16kHz
        
    async def init_gemini(self):
        """Initialize Gemini Live session"""
        if not USE_GEMINI:
            await self.websocket.send_json({
                "type": "ready",
                "content": "Local fallback mode active. Configure GEMINI_API_KEY in backend/.env for live Gemini coaching."
            })
            return

        config = {
            "response_modalities": ["TEXT"],
            "system_instruction": SYSTEM_PROMPT,
            "tools": [],
        }
        
        try:
            self.gemini_context = genai_client.aio.live.connect(
                model=MODEL,
                config=config
            )
            self.gemini_session = await self.gemini_context.__aenter__()
            self.receiver_task = asyncio.create_task(self._stream_audio_to_gemini())
            logger.info("✓ Gemini Live session connected")
        except Exception as e:
            # If Live is unavailable for this key/project, keep session alive and
            # fall back to text analysis triggered from frontend transcript.
            self.live_available = False
            logger.error(f"❌ Failed to initialize Gemini Live: {e}", exc_info=True)
            await self.websocket.send_json({
                "type": "ready",
                "content": "Live audio model unavailable. Using text analysis fallback; speak normally and we'll analyze your transcript on stop."
            })

    async def _audio_stream(self):
        """Async generator yielding queued PCM audio bytes to Gemini."""
        while self.is_active:
            chunk = await self.audio_queue.get()
            if chunk is None:
                break
            yield chunk

    async def _stream_audio_to_gemini(self):
        """Send queued audio to Gemini using start_stream and forward responses."""
        if not self.gemini_session:
            return

        try:
            async for response in self.gemini_session.start_stream(
                stream=self._audio_stream(),
                mime_type="audio/pcm;rate=16000",
            ):
                if not self.is_active:
                    break

                if response.server_content and response.server_content.model_turn:
                    for part in response.server_content.model_turn.parts:
                        if hasattr(part, "text") and part.text:
                            await self._stream_response(part.text)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error receiving Gemini stream: {e}", exc_info=True)
            if self.is_active:
                await self._send_error(str(e))
    
    async def process_audio(self, audio_chunk: bytes):
        """Send audio chunk to Gemini and stream responses"""
        if not self.is_active:
            return

        # Keep a rolling buffer so we can transcribe on stop if Live API is unavailable.
        self.audio_buffer.extend(audio_chunk)
        if len(self.audio_buffer) > self.max_audio_bytes:
            del self.audio_buffer[: len(self.audio_buffer) - self.max_audio_bytes]

        if not USE_GEMINI:
            # In fallback mode, acknowledge audio once per session to avoid loop-like UI spam.
            self.audio_chunk_count += 1
            if not self.fallback_notified:
                await self._send_streaming(
                    "transcript",
                    "[demo] Audio received and processed locally. "
                )
                await self._send_streaming(
                    "better_answer",
                    "[demo] Structured answer: Situation, Action, Result, and measurable outcome. "
                )
                await self._send_streaming(
                    "follow_ups",
                    "Can you quantify the business impact? What would you improve next time? "
                )
                self.fallback_notified = True
            return

        if not self.live_available:
            # Live model unavailable; frontend transcript fallback handles analysis.
            return

        if not self.gemini_session:
            return
        
        try:
            if self.audio_queue.full():
                # Drop oldest chunk under backpressure to keep latency low.
                _ = self.audio_queue.get_nowait()
            self.audio_queue.put_nowait(audio_chunk)
        except Exception as e:
            logger.error(f"Error processing audio: {e}", exc_info=True)
            await self._send_error(str(e))

    async def process_text_transcript(self, transcript: str):
        """Analyze transcript with text model when Live API is unavailable."""
        text = (transcript or "").strip()
        if not text:
            await self.process_buffered_audio()
            return

        if not USE_GEMINI:
            await self._send_streaming("transcript", text)
            await self._send_streaming(
                "better_answer",
                "[demo] Structured answer: Situation, Action, Result, and measurable outcome."
            )
            await self._send_streaming(
                "follow_ups",
                "Can you quantify the business impact? What would you improve next time?"
            )
            return

        prompt = (
            "You are an interview coach. Return STRICTLY this format:\n"
            "Transcript: ...\n"
            "Better Answer: ...\n"
            "Suggestion: ...\n"
            "Follow-ups: ...\n\n"
            "If no suggestion needed, keep 'Suggestion:' empty."
            f"\n\nTranscript input:\n{text}"
        )

        try:
            response = await asyncio.to_thread(
                genai_client.models.generate_content,
                model=TEXT_MODEL,
                contents=prompt,
            )
            model_text = (getattr(response, "text", "") or "").strip()
            if not model_text:
                await self._send_error("No response received from Gemini text model.")
                return
            await self._stream_response(model_text)
        except Exception as e:
            logger.error(f"Text transcript analysis failed: {e}", exc_info=True)
            await self._send_error(f"Text analysis failed: {e}")

    @staticmethod
    def _pcm16_to_wav_bytes(pcm_bytes: bytes, sample_rate: int = 16000, channels: int = 1, bits_per_sample: int = 16) -> bytes:
        """Wrap raw PCM16 mono audio in a WAV container."""
        byte_rate = sample_rate * channels * bits_per_sample // 8
        block_align = channels * bits_per_sample // 8
        subchunk2_size = len(pcm_bytes)
        chunk_size = 36 + subchunk2_size

        header = b"RIFF" + struct.pack("<I", chunk_size) + b"WAVE"
        fmt = (
            b"fmt "
            + struct.pack("<I", 16)            # Subchunk1Size for PCM
            + struct.pack("<H", 1)             # AudioFormat PCM
            + struct.pack("<H", channels)
            + struct.pack("<I", sample_rate)
            + struct.pack("<I", byte_rate)
            + struct.pack("<H", block_align)
            + struct.pack("<H", bits_per_sample)
        )
        data = b"data" + struct.pack("<I", subchunk2_size)
        return header + fmt + data + pcm_bytes

    async def process_buffered_audio(self):
        """Transcribe buffered PCM audio and coach with text model when Live API is unavailable."""
        logger.info(f"Starting buffered audio analysis, bytes={len(self.audio_buffer)}")
        if len(self.audio_buffer) < 3200:
            await self._send_error("No usable audio captured. Check microphone permissions and try again.")
            return

        if not USE_GEMINI:
            await self._send_streaming("transcript", "[demo] Audio captured, but Gemini API key is not configured.")
            return

        wav_bytes = self._pcm16_to_wav_bytes(bytes(self.audio_buffer))
        prompt = (
            "You are an interview coach. First transcribe the provided audio and then return STRICTLY this format:\n"
            "Transcript: ...\n"
            "Better Answer: ...\n"
            "Suggestion: ...\n"
            "Follow-ups: ...\n\n"
            "If no suggestion needed, keep 'Suggestion:' empty."
        )

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    genai_client.models.generate_content,
                    model=TEXT_MODEL,
                    contents=[
                        prompt,
                        genai.types.Part.from_bytes(
                            data=wav_bytes,
                            mime_type="audio/wav",
                        ),
                    ],
                ),
                timeout=20,
            )
            model_text = (getattr(response, "text", "") or "").strip()
            if not model_text:
                await self._send_error("No response received while transcribing audio.")
                return
            await self._stream_response(model_text)
            logger.info("Buffered audio analysis completed successfully")
        except asyncio.TimeoutError:
            await self._send_error("Audio analysis timed out. Please speak for 5-10 seconds and try again.")
        except Exception as e:
            logger.error(f"Audio transcription analysis failed: {e}", exc_info=True)
            await self._send_error(f"Audio analysis failed: {e}")
        finally:
            self.audio_buffer.clear()
    
    async def _stream_response(self, text: str):
        """Parse Gemini response and stream sections to client"""
        if not self.is_active:
            return

        raw_text = (text or "").strip()
        if not raw_text:
            return
        
        # Parse structured response
        lines = raw_text.split('\n')
        current_section = None
        section_content = ""
        sent_any_section = False
        sent_suggestion = False
        
        for line in lines:
            if line.startswith("Transcript:"):
                if current_section == "transcript" and section_content:
                    await self._send_streaming("transcript", section_content)
                    sent_any_section = True
                current_section = "transcript"
                section_content = line.replace("Transcript:", "").strip()
            elif line.startswith("Better Answer:"):
                if current_section == "transcript" and section_content:
                    await self._send_streaming("transcript", section_content)
                    sent_any_section = True
                current_section = "better_answer"
                section_content = line.replace("Better Answer:", "").strip()
            elif line.startswith("Suggestion:"):
                if current_section == "better_answer" and section_content:
                    await self._send_streaming("better_answer", section_content)
                    sent_any_section = True
                current_section = "suggestion"
                section_content = line.replace("Suggestion:", "").strip()
            elif line.startswith("Follow-ups:"):
                if current_section == "suggestion" and section_content:
                    await self._send_streaming("suggestion", section_content)
                    sent_any_section = True
                    sent_suggestion = True
                current_section = "follow_ups"
                section_content = line.replace("Follow-ups:", "").strip()
            elif line.strip() == "":
                continue
            else:
                if section_content:
                    section_content += " " + line
                else:
                    section_content = line
        
        # Flush remaining content
        if section_content and current_section:
            await self._send_streaming(current_section, section_content)
            sent_any_section = True
            if current_section == "suggestion":
                sent_suggestion = True

        # Keep Suggestions card useful even when the model leaves this section empty.
        if sent_any_section and not sent_suggestion:
            await self._send_streaming("suggestion", "No major filler words detected. Keep this pace.")

        # Fallback: if model output didn't include strict section labels, show
        # the raw response so UI doesn't appear stuck at processing state.
        if not sent_any_section:
            await self._send_streaming("better_answer", raw_text)
    
    async def _send_streaming(self, section_type: str, content: str):
        """Send streaming content to client"""
        if not content.strip():
            return
        
        try:
            message = {
                "type": section_type,
                "content": content.strip()
            }
            await self.websocket.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send streaming message: {e}")
    
    async def _send_error(self, error_msg: str):
        """Send error message to client"""
        try:
            await self.websocket.send_json({
                "type": "error",
                "content": error_msg
            })
        except Exception as e:
            logger.error(f"Failed to send error: {e}")
    
    async def close(self):
        """Close the Gemini session"""
        self.is_active = False
        try:
            if not self.audio_queue.full():
                self.audio_queue.put_nowait(None)
        except Exception:
            pass

        if self.receiver_task:
            self.receiver_task.cancel()
            try:
                await self.receiver_task
            except asyncio.CancelledError:
                pass

        if self.gemini_context:
            try:
                await self.gemini_context.__aexit__(None, None, None)
                logger.info("✓ Gemini session closed")
            except Exception as e:
                logger.error(f"Error closing Gemini session: {e}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for interview copilot"""
    await websocket.accept()
    session = None
    
    try:
        logger.info("🔗 New WebSocket connection")
        
        # Initialize Gemini session
        session = InterviewSession(websocket)
        await session.init_gemini()
        
        logger.info("✓ Ready to receive audio")
        
        # Main loop: receive audio and commands
        while session.is_active:
            data = await websocket.receive()

            if data.get("type") == "websocket.disconnect":
                logger.info("WebSocket disconnect message received")
                break
            
            if "bytes" in data:
                # Received audio chunk
                audio_chunk = data["bytes"]
                await session.process_audio(audio_chunk)
            
            elif "text" in data:
                # Received control command
                try:
                    command = json.loads(data["text"])
                    if command.get("type") == "control":
                        ctrl_cmd = command.get("command")
                        if ctrl_cmd == "stop":
                            logger.info("Stop command received")
                            if not USE_GEMINI:
                                await session._send_streaming(
                                    "suggestion",
                                    "Fallback mode is active. Add a real GEMINI_API_KEY in backend/.env for live, speech-aware responses."
                                )
                            elif not session.live_available:
                                await session.process_buffered_audio()
                            continue
                        elif ctrl_cmd == "start":
                            logger.info("Start command received")
                            session.audio_buffer.clear()
                    elif command.get("type") == "analyze_text":
                        await session.process_text_transcript(command.get("content", ""))
                except json.JSONDecodeError:
                    pass
    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await websocket.send_json({
                "type": "error",
                "content": f"Backend error: {str(e)}"
            })
        except:
            pass
    
    finally:
        if session:
            await session.close()
        try:
            await websocket.close()
        except:
            pass

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model": MODEL if USE_GEMINI else "local-fallback",
        "mode": "gemini" if USE_GEMINI else "fallback",
        "api": "Interview Copilot"
    }

if __name__ == "__main__":
    import uvicorn
    logger.info(f"🚀 Starting Interview Copilot backend on port {BACKEND_PORT}")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=BACKEND_PORT,
        reload=True,
        log_level="info"
    )
