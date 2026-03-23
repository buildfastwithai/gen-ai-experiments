"use client";

import { TextShimmer } from "@/components/ui/text-shimmer";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";

type LibraryItem = {
  id: string;
  kind: "text" | "file";
  createdAt: string;
  text?: string;
  filename?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  fileUrl?: string;
  truncated?: boolean;
  metadata?: Record<string, unknown>;
};

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, unitIndex);
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-green-600">
      <span>{children}</span>
      <span className="h-px max-w-[72px] flex-1 bg-gradient-to-r from-green-400/50 to-transparent" />
    </div>
  );
}

export default function Home() {
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [noteText, setNoteText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");

  const sortedItems = useMemo(
    () =>
      [...libraryItems].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [libraryItems],
  );

  async function loadItems() {
    const response = await fetch("/api/index");
    if (!response.ok) return;
    const data = (await response.json()) as { items?: LibraryItem[] };
    setLibraryItems(data.items ?? []);
  }

  useEffect(() => {
    fetch("/api/index")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { items?: LibraryItem[] };
      })
      .then((data) => {
        if (data) {
          setLibraryItems(data.items ?? []);
        }
      })
      .catch(() => {
        // Keep the empty state if the initial request fails.
      });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  async function handleIngest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    if (noteText.trim()) formData.set("text", noteText.trim());
    if (selectedFiles) {
      Array.from(selectedFiles).forEach((file) =>
        formData.append("files", file),
      );
    }

    const response = await fetch("/api/ingest", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error?: string };
      setUploadError(errorData.error ?? "Failed to upload content.");
    } else {
      setNoteText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedFiles(null);
      await loadItems();
    }

    setIsUploading(false);
  }

  async function handleDelete(id: string) {
    const response = await fetch("/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (response.ok) {
      await loadItems();
    }
  }

  const isStreaming = status === "streaming";
  const isThinking = status === "submitted";
  const isBusy = isStreaming || isThinking;

  return (
    <div className="relative h-screen overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-44 h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle,_rgba(22,163,74,0.12)_0%,_transparent_65%)] blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,_rgba(217,180,100,0.15)_0%,_transparent_65%)] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(28,25,23,0.07)_1px,_transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black_30%,transparent_100%)]" />
      </div>

      <div className="relative z-10 flex h-screen flex-col overflow-hidden">
        <header className="sticky top-0 z-20 border-b border-stone-900/10 bg-[#edeae2]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-[52px] w-full max-w-7xl items-center justify-between px-7">
            <div className="flex items-center gap-2.5">
              <div className="grid h-[26px] w-[26px] place-items-center rounded-md border border-green-600 text-[13px] text-green-600 shadow-[0_0_10px_rgba(22,163,74,0.15)]">
                ◆
              </div>
              <span className="text-[12px] font-semibold uppercase tracking-[0.26em] text-stone-900">
                Gemini x Supabase x AI SDK
              </span>
            </div>

            <div className="flex items-center gap-3.5">
              <span className="hidden text-[10px] uppercase tracking-[0.14em] text-stone-400 sm:block">
                Gemini Embedding 2
              </span>
              <div
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.1em] shadow-sm transition ${
                  isBusy
                    ? "border-green-600/35 bg-green-600/8 text-green-900"
                    : "border-stone-900/10 bg-[#faf9f6] text-stone-600"
                }`}
              >
                <span
                  className={`h-[5px] w-[5px] rounded-full ${
                    isBusy ? "bg-green-600 animate-pulse" : "bg-current"
                  }`}
                />
                {isBusy ? (isThinking ? "thinking" : "processing") : "ready"}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto grid h-[calc(100vh-52px)] w-full max-w-7xl flex-1 gap-7 overflow-hidden px-7 pb-7 pt-9 lg:grid-cols-[1fr_1.45fr]">
          <section className="h-full overflow-y-auto pr-2">
            <h1 className="mb-3 [font-family:var(--font-display)] text-[40px] leading-[1.12] font-normal tracking-[-0.02em] text-stone-900 italic">
              Multimodal
              <br />
              Library
            </h1>

            <p className="mb-6 max-w-xl text-[12px] leading-[1.75] text-stone-600">
              Drop text, images, audio, video, or PDFs.{" "}
              <span className="font-medium text-green-900">
                Gemini Embedding 2
              </span>{" "}
              vectorizes everything, then chat with the most relevant context.
            </p>

            <form
              onSubmit={handleIngest}
              className="relative mb-6 overflow-hidden rounded-2xl border border-stone-900/10 bg-[#faf9f6] p-[18px] shadow-[0_2px_8px_rgba(28,25,22,0.08),0_1px_3px_rgba(28,25,22,0.05)]"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-green-600 to-transparent opacity-50" />

              <div className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-[7px]">
                  <label
                    className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-600"
                    htmlFor="note-text"
                  >
                    Notes
                  </label>
                  <textarea
                    id="note-text"
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    placeholder="Paste notes, transcripts, or any text to embed..."
                    rows={3}
                    className="min-h-[82px] w-full resize-y rounded-[9px] border border-stone-900/10 bg-[#f2efe8] px-[13px] py-[10px] text-[12px] leading-[1.65] text-stone-900 outline-none placeholder:text-stone-400 focus:border-green-600/40 focus:bg-[#faf9f6]"
                  />
                </div>

                <div className="flex flex-col gap-[7px]">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-600">
                    Files{" "}
                    <span className="normal-case tracking-normal font-normal text-stone-400">
                      - images, audio, video, PDF, text
                    </span>
                  </label>
                  <div
                    className={`flex min-h-[76px] cursor-pointer items-center justify-center rounded-[9px] border border-dashed px-4 py-[18px] transition ${
                      isDragOver
                        ? "border-green-600/40 bg-green-600/8"
                        : "border-stone-900/15 bg-[#f2efe8] hover:border-green-600/40 hover:bg-green-600/8"
                    }`}
                    role="button"
                    tabIndex={0}
                    aria-label="Click or drag to add files"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") fileInputRef.current?.click();
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDragOver(false);
                      setSelectedFiles(event.dataTransfer.files);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={(event) => setSelectedFiles(event.target.files)}
                      className="sr-only"
                    />
                    <div className="flex flex-col items-center gap-1 text-center">
                      <span className="mb-0.5 text-base leading-none text-green-600">
                        ⊕
                      </span>
                      {selectedFiles && selectedFiles.length > 0 ? (
                        <span className="text-[12px] text-stone-600">
                          {selectedFiles.length} file
                          {selectedFiles.length > 1 ? "s" : ""} selected
                        </span>
                      ) : (
                        <span className="text-[12px] text-stone-600">
                          Drop files here or click to browse
                        </span>
                      )}
                      <span className="text-[10px] text-stone-400">
                        Max 10 MB per file
                      </span>
                    </div>
                  </div>
                </div>

                {uploadError && (
                  <p className="flex items-center gap-1 text-[11px] text-red-600">
                    Warning: {uploadError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isUploading}
                  className="mt-0.5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-600 px-5 py-2.5 text-[12px] font-semibold tracking-[0.06em] text-white transition hover:-translate-y-0.5 hover:bg-green-600/95 hover:shadow-[0_6px_20px_rgba(22,163,74,0.3)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                >
                  {isUploading ? (
                    <>
                      <span className="h-[11px] w-[11px] animate-spin rounded-full border-2 border-white/25 border-t-white" />
                      Embedding...
                    </>
                  ) : (
                    <>
                      <span>⊛</span>
                      Add to Library
                    </>
                  )}
                </button>
              </div>
            </form>

            <div>
              <div className="mb-2.5 flex items-baseline justify-between border-b border-stone-900/10 pb-2.5">
                <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-stone-600">
                  Uploaded Library
                </span>
                <span>
                  <span className="font-[family:var(--font-display)] text-2xl italic text-stone-900">
                    {sortedItems.length}
                  </span>
                  <span className="ml-1 text-[10px] uppercase tracking-[0.12em] text-stone-400">
                    vectors
                  </span>
                </span>
              </div>

              <div className="flex flex-col gap-1.5 pb-6">
                {sortedItems.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-stone-900/12 px-5 py-8 text-center text-[12px] text-stone-400">
                    <span className="text-[20px] leading-none">◇</span>
                    <span>No items yet. Upload something to begin.</span>
                  </div>
                ) : (
                  sortedItems.map((item) => (
                    <div
                      key={item.id}
                      className="group relative overflow-hidden rounded-[10px] border border-stone-900/10 bg-[#faf9f6] px-3 py-2.5 shadow-sm transition hover:border-stone-900/15 hover:shadow-[0_2px_8px_rgba(28,25,22,0.08),0_1px_3px_rgba(28,25,22,0.05)]"
                    >
                      <div className="absolute inset-y-[22%] left-0 w-0.5 rounded-full bg-green-600 opacity-0 transition group-hover:opacity-60" />

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-[7px] py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${
                            item.kind === "file"
                              ? "border-green-600/35 bg-green-600/8 text-green-900"
                              : "border-stone-900/10 bg-[#f2efe8] text-stone-600"
                          }`}
                        >
                          {item.kind}
                        </span>
                        <span className="flex-1 text-[10px] text-stone-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="text-[10px] tracking-[0.04em] text-stone-400 transition hover:text-red-600"
                        >
                          remove
                        </button>
                      </div>

                      {item.kind === "text" ? (
                        <p className="mt-1.5 line-clamp-2 text-[12px] leading-[1.55] text-stone-600">
                          {item.text}
                          {item.truncated ? "..." : ""}
                        </p>
                      ) : (
                        <div className="mt-1.5">
                          <span className="block text-[12px] text-stone-900">
                            {item.originalName}
                          </span>
                          <span className="mt-px block text-[10px] text-stone-400">
                            {item.mimeType} · {formatBytes(item.size)}
                          </span>
                          {item.fileUrl && (
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-px block text-[10px] text-green-900/70 hover:text-green-900"
                            >
                              open file
                            </a>
                          )}
                          {item.text && (
                            <span className="mt-px block text-[10px] text-green-900/70">
                              extracted text
                              {item.truncated ? " · truncated" : ""}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="self-start">
            <div className="relative flex h-[calc(100vh-116px)] min-h-[540px] max-h-[860px] flex-col overflow-hidden rounded-[18px] border border-stone-900/10 bg-[#faf9f6] shadow-[0_4px_20px_rgba(28,25,22,0.1),0_2px_8px_rgba(28,25,22,0.06)]">
              <div className="absolute inset-x-0 top-0 z-[1] h-0.5 bg-gradient-to-r from-transparent via-green-600 to-transparent opacity-45" />

              <div className="relative z-10 flex items-start justify-between border-b border-stone-900/10 bg-[#faf9f6] px-5 pb-4 pt-[18px]">
                <div>
                  <h2 className="[font-family:var(--font-display)] text-[22px] font-normal tracking-[-0.01em] text-stone-900 italic">
                    Chat with your uploads
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="mt-0.5 shrink-0 rounded-full border border-stone-900/10 px-[11px] py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-600 transition hover:border-red-600/35 hover:bg-red-600/5 hover:text-red-600"
                >
                  clear
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-2.5 overflow-hidden px-5 py-[18px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="m-auto flex max-w-sm flex-col items-center gap-2.5 px-5 text-center text-[12px] text-stone-400">
                    <span className="text-[26px] leading-none text-green-600/30">
                      ◆
                    </span>
                    <span className="font-[family:var(--font-display)] text-[16px] font-normal italic text-stone-600">
                      Ask anything from your uploaded library.
                    </span>
                    <span>The app will surface the most relevant context.</span>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[78%] px-[14px] py-[10px] text-[13px] leading-[1.6] ${
                          message.role === "user"
                            ? "rounded-[16px_16px_4px_16px] bg-green-600 text-white shadow-[0_2px_8px_rgba(22,163,74,0.25)]"
                            : "rounded-[16px_16px_16px_4px] border border-stone-900/10 bg-[#f2efe8] text-stone-900 shadow-sm"
                        }`}
                      >
                        {message.parts.map((part, index) =>
                          part.type === "text" ? (
                            <p key={index} className="whitespace-pre-wrap">
                              {part.text}
                            </p>
                          ) : null,
                        )}
                      </div>
                    </div>
                  ))
                )}

                {isThinking && (
                  <div className="flex justify-start">
                    <TextShimmer className="text-sm text-stone-500">
                      Thinking...
                    </TextShimmer>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!input.trim() || status !== "ready") return;
                  sendMessage({ text: input.trim() });
                  setInput("");
                }}
                className="flex items-center gap-2 border-t border-stone-900/10 bg-[#faf9f6] px-[18px] py-[14px]"
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about your uploads..."
                  disabled={isStreaming}
                  className="min-w-0 flex-1 rounded-full border border-stone-900/10 bg-[#f2efe8] px-4 py-[9px] text-[12px] text-stone-900 outline-none placeholder:text-stone-400 focus:border-green-600/40 focus:bg-[#faf9f6]"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={status !== "ready"}
                  className="inline-flex shrink-0 items-center gap-[7px] rounded-full border border-stone-900/10 bg-[#e8e4da] px-[18px] py-[9px] text-[12px] font-medium text-stone-600 transition hover:border-green-600 hover:bg-green-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>Send</span>
                  <span className="text-[14px] leading-none">→</span>
                </button>
              </form>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
