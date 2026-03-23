import {
  embed,
  streamText,
  convertToModelMessages,
  type UIMessage,
  smoothStream,
} from "ai";
import { google } from "@ai-sdk/google";
import { downloadStoredFile, searchStoredItems } from "@/lib/content-store";

export const runtime = "nodejs";

const MAX_FILE_CONTEXT_BYTES = 20 * 1024 * 1024;
const EMBEDDING_DIMENSIONS = 1536;

function extractLatestUserText(messages: UIMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "user") {
      const text = message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join(" ")
        .trim();
      if (text) return text;
    }
  }
  return "";
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const query = extractLatestUserText(messages);

  let contextMessage: {
    role: "user";
    content: Array<
      | { type: "text"; text: string }
      | { type: "file"; data: Buffer; mediaType: string }
    >;
  } | null = null;

  if (query) {
    const { embedding: queryEmbedding } = await embed({
      model: google.embedding("gemini-embedding-2-preview"),
      value: query,
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
          taskType: "RETRIEVAL_QUERY",
        },
      },
    });

    const matches = await searchStoredItems(queryEmbedding, 4);
    if (matches.length > 0) {
      const content: Array<
        | { type: "text"; text: string }
        | { type: "file"; data: Buffer; mediaType: string }
      > = [
        {
          type: "text",
          text: "Context from the uploaded library. Use only when relevant.",
        },
      ];

      for (const match of matches) {
        const item = match.item;
        if (item.kind === "text" && item.text) {
          content.push({
            type: "text",
            text: `Text note (${item.id}): ${item.text}${item.truncated ? "..." : ""}`,
          });
          continue;
        }

        if (
          item.kind === "file" &&
          item.storagePath &&
          item.mimeType &&
          item.originalName
        ) {
          if ((item.size ?? 0) <= MAX_FILE_CONTEXT_BYTES) {
            const fileBuffer = await downloadStoredFile(item.storagePath);
            content.push({
              type: "text",
              text: `File (${item.id}): ${item.originalName}`,
            });
            content.push({
              type: "file",
              data: fileBuffer,
              mediaType: item.mimeType,
            });
          } else {
            content.push({
              type: "text",
              text: `File (${item.id}): ${item.originalName} (${item.mimeType}) is too large to inline. Refer to its metadata.`,
            });
          }
        }
      }

      contextMessage = { role: "user", content };
    }
  }

  const modelMessages = await convertToModelMessages(messages);
  const systemMessage = {
    role: "system",
    content:
      "You answer questions using the provided uploaded content. If the context is insufficient, say what is missing.",
  } as const;

  const response = streamText({
    model: google("gemini-2.5-flash"),
    experimental_transform: smoothStream({ delayInMs: 30, chunking: "word" }),
    messages: [
      systemMessage,
      ...(contextMessage ? [contextMessage] : []),
      ...modelMessages,
    ],
  });

  return response.toUIMessageStreamResponse();
}
