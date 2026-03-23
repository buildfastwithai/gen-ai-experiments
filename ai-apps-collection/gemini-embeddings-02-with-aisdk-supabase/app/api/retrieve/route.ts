import { NextResponse } from "next/server";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { sanitizeStoredItem, searchStoredItems } from "@/lib/content-store";

export const runtime = "nodejs";

const EMBEDDING_DIMENSIONS = 1536;

export async function POST(req: Request) {
  const { query } = (await req.json()) as { query?: string };

  if (!query?.trim()) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const { embedding: queryEmbedding } = await embed({
    model: google.embedding("gemini-embedding-2-preview"),
    value: query.trim(),
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: "RETRIEVAL_QUERY",
      },
    },
  });

  const matches = await searchStoredItems(queryEmbedding, 4);

  return NextResponse.json({
    matches: matches.map((match) => ({
      score: match.score,
      willInlineFile: match.item.kind === "file",
      item: sanitizeStoredItem(match.item),
    })),
  });
}
