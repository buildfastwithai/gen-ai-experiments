'use client';

import { useState, useEffect, useRef } from 'react';
import { AudioCapture, AUDIO_CONFIG, detectFillers } from '@/lib/audio';
import { InterviewCopilotWS, StreamMessage } from '@/lib/ws';

interface CopilotState {
  transcript: string;
  betterAnswer: string;
  suggestion: string;
  followUps: string;
}

const STARTER_QUESTIONS = [
  'Tell me about a time you solved a difficult problem under pressure.',
  'Describe a project where you had to influence stakeholders without direct authority.',
  'Walk me through a failure you experienced and what you changed afterward.',
  'How have you used AI tools to improve your workflow while maintaining quality?',
];

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState<CopilotState>({
    transcript: '',
    betterAnswer: '',
    suggestion: '',
    followUps: '',
  });
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState('');
  const [activeQuestion] = useState(
    () => STARTER_QUESTIONS[Math.floor(Math.random() * STARTER_QUESTIONS.length)]
  );

  const audioRef = useRef<AudioCapture | null>(null);
  const wsRef = useRef<InterviewCopilotWS | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const interimTranscriptRef = useRef('');

  const mergeStreamText = (previous: string, incoming: string): string => {
    const prev = previous.trim();
    const next = incoming.trim();

    if (!next) return previous;
    if (!prev) return next;
    if (next === prev) return previous;
    if (next.startsWith(prev) || next.includes(prev)) return next;
    if (prev.endsWith(next) || prev.includes(next)) return previous;

    return `${previous} ${next}`.trim();
  };

  const isTransientSuggestion = (value: string): boolean => {
    const text = value.trim().toLowerCase();
    return (
      text.includes('processing captured audio') ||
      text.includes('capturing audio') ||
      text.includes('processing audio')
    );
  };

  // Initialize WebSocket connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
    wsRef.current = new InterviewCopilotWS(wsUrl);

    wsRef.current
      .connect(
        (message: StreamMessage) => handleMessage(message),
        (error: string) => {
          setError(error);
          setIsConnected(false);
        },
        () => {
          setIsConnected(false);
        }
      )
      .then(() => {
        setIsConnected(true);
        setStatus('Connected to backend');
      })
      .catch((err) => {
        setError(`Failed to connect: ${err.message}`);
        setStatus('Connection failed');
      });

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, []);

  const handleMessage = (message: StreamMessage) => {
    const { type, content } = message;

    setState((prev) => {
      const updated = { ...prev };
      switch (type) {
        case 'transcript':
          updated.transcript = mergeStreamText(prev.transcript, content);
          break;
        case 'better_answer':
          updated.betterAnswer = mergeStreamText(prev.betterAnswer, content);
          break;
        case 'suggestion':
          if (!isTransientSuggestion(content)) {
            updated.suggestion = content;
          }
          break;
        case 'follow_ups':
          updated.followUps = mergeStreamText(prev.followUps, content);
          break;
        case 'error':
          setError(content);
          break;
      }
      return updated;
    });
  };

  const startRecording = async () => {
    if (!isConnected) {
      setError('Not connected to backend');
      return;
    }

    try {
      setError('');
      setStatus('Starting audio capture...');
      
      // Reset state for new session
      setState({
        transcript: '',
        betterAnswer: '',
        suggestion: '',
        followUps: '',
      });
      transcriptRef.current = '';
      interimTranscriptRef.current = '';

      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let finalizedChunk = '';
          let interimChunk = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalizedChunk += ` ${result[0].transcript}`;
            } else {
              interimChunk += ` ${result[0].transcript}`;
            }
          }

          if (finalizedChunk.trim()) {
            transcriptRef.current = `${transcriptRef.current} ${finalizedChunk}`.trim();
          }

          interimTranscriptRef.current = interimChunk.trim();

          const liveTranscript = `${transcriptRef.current} ${interimTranscriptRef.current}`.trim();
          if (liveTranscript) {
            setState((prev) => ({
              ...prev,
              transcript: liveTranscript,
            }));
          }
        };

        recognition.onerror = () => {
          setStatus('Recording (speech recognition limited; audio will be analyzed on stop)');
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      audioRef.current = new AudioCapture();
      await audioRef.current.start((chunk: Uint8Array) => {
        if (wsRef.current && wsRef.current.isConnected()) {
          wsRef.current.sendAudio(chunk);
        }
      });

      setIsRecording(true);
      setStatus('Recording...');
      wsRef.current?.sendControl('start');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      setError(message);
      setStatus('Ready');
    }
  };

  const stopRecording = async () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      if (audioRef.current) {
        audioRef.current.stop();
        audioRef.current = null;
      }

      setIsRecording(false);
      setStatus('Processing...');
      wsRef.current?.sendControl('stop');
      const finalTranscript = `${transcriptRef.current} ${interimTranscriptRef.current}`.trim();
      interimTranscriptRef.current = '';
      if (finalTranscript) {
        setState((prev) => ({
          ...prev,
          transcript: finalTranscript,
        }));
        wsRef.current?.sendJson({
          type: 'analyze_text',
          content: finalTranscript,
        });
      }

      // Wait a bit for final responses
      setTimeout(() => {
        setStatus('Complete');
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error stopping recording';
      setError(message);
    }
  };

  const isStreaming = isRecording || status === 'Processing...';
  const showTranscriptPlaceholder = !state.transcript;
  const showBetterAnswerPlaceholder = !state.betterAnswer;
  const showSuggestionPlaceholder = !state.suggestion;
  const showFollowupsPlaceholder = !state.followUps;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-7xl animate-reveal-up space-y-5 sm:space-y-6">
        <header className="card-surface relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-24 h-48 w-48 rounded-full bg-emerald-300/20 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Live AI Interview Coach</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Interview Copilot</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                Real-time AI that improves your answers as you speak
              </p>
              <p className="mt-3 max-w-2xl text-xs leading-6 text-slate-500 sm:text-sm">
                This app listens to your spoken answer, rewrites it into a sharper interview response, and suggests
                stronger framing plus likely follow-up questions.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 py-2 shadow-sm">
              <span
                className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'animate-pulse-dot bg-emerald-500' : 'bg-slate-300'}`}
              />
              <span className="text-sm font-medium text-slate-700">{isRecording ? 'Listening...' : 'Standby'}</span>
              <span className={`text-xs ${isConnected ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        )}

        <section className="card-surface p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={startRecording}
              disabled={isRecording || !isConnected}
            >
              {isRecording ? 'Recording...' : 'Start Recording'}
            </button>
            <button
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={stopRecording}
              disabled={!isRecording}
            >
              Stop
            </button>
            <div className="flex items-center text-sm text-slate-500 sm:ml-auto">Status: {status}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50 to-sky-50 p-4 shadow-soft-xl sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Start Here</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">Practice Interview Question</h2>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm">
              Answer out loud, then press Stop
            </span>
          </div>
          <p className="mt-3 rounded-xl border border-indigo-200/70 bg-white/85 p-4 text-sm leading-7 text-slate-800 sm:text-base">
            {activeQuestion}
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <article className="card-surface border-slate-200 p-4 sm:p-5 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-600">Live Transcript</h2>
              {isStreaming && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">Streaming</span>
              )}
            </div>
            <div className="mt-3 min-h-[320px] rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm leading-7 text-slate-700">
              {showTranscriptPlaceholder ? (
                <span className="text-slate-400">Start speaking...</span>
              ) : (
                <>
                  {state.transcript}
                  {isStreaming && <span className="stream-caret" aria-hidden="true" />}
                </>
              )}
            </div>
          </article>

          <div className="space-y-4 lg:col-span-7 lg:space-y-5">
            <article className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 p-5 shadow-soft-2xl sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-sky-700">Better Answer</h2>
                {isStreaming && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-sky-700">
                    <span className="h-1.5 w-1.5 animate-stream rounded-full bg-sky-500" />
                    <span className="h-1.5 w-1.5 animate-stream rounded-full bg-sky-500 [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 animate-stream rounded-full bg-sky-500 [animation-delay:0.4s]" />
                  </div>
                )}
              </div>
              <div className="mt-3 min-h-[260px] rounded-xl border border-sky-200/70 bg-white/85 p-4 text-[15px] leading-7 text-slate-800 sm:p-5">
                {showBetterAnswerPlaceholder ? (
                  <span className="text-slate-400">Your improved answer will appear here...</span>
                ) : (
                  <>
                    {state.betterAnswer}
                    {isStreaming && <span className="stream-caret" aria-hidden="true" />}
                  </>
                )}
              </div>
            </article>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-soft-xl sm:p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-800">Suggestions</h3>
                <p className="mt-3 min-h-[130px] text-sm leading-7 text-amber-900/90">
                  {showSuggestionPlaceholder ? 'Suggestions will appear here...' : state.suggestion}
                </p>
              </article>

              <article className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-soft-xl sm:p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-violet-800">Follow-ups</h3>
                <p className="mt-3 min-h-[130px] text-sm leading-7 text-violet-900/90">
                  {showFollowupsPlaceholder ? 'Likely follow-up questions will appear here...' : state.followUps}
                </p>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
