import { NextResponse } from "next/server";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import {
  createStoredItemId,
  insertStoredItem,
  removeStoredFile,
  sanitizeStoredItem,
  truncateText,
  type StoredItem,
  toDataUrl,
  uploadFileToStorage,
} from "@/lib/content-store";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 20000;
const EMBEDDING_DIMENSIONS = 1536;

function isTextMimeType(mimeType: string) {
  return mimeType.startsWith("text/");
}

function allowedMimeType(mimeType: string) {
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("text/") ||
    mimeType === "application/pdf"
  );
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const textInput = formData.get("text");
  const files = formData.getAll("files");
  const createdItems: StoredItem[] = [];

  if (typeof textInput === "string" && textInput.trim().length > 0) {
    const trimmed = textInput.trim();
    const { text, truncated } = truncateText(trimmed, MAX_TEXT_CHARS);
    const { embedding } = await embed({
      model: google.embedding("gemini-embedding-2-preview"),
      value: text,
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
          taskType: "RETRIEVAL_DOCUMENT",
        },
      },
    });

    const insertedItem = await insertStoredItem({
      id: createStoredItemId(),
      kind: "text",
      createdAt: new Date().toISOString(),
      embedding,
      text,
      truncated,
      metadata: {
        source: "text-input",
      },
    });

    createdItems.push(insertedItem);
  }

  for (const file of files) {
    if (!(file instanceof File)) continue;
    if (file.size === 0) continue;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File ${file.name} exceeds 10MB limit.` },
        { status: 400 },
      );
    }
    if (!allowedMimeType(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const itemId = createStoredItemId();

    let embedding: number[] | undefined;
    let extractedText: string | undefined;
    let truncated = false;

    if (isTextMimeType(file.type)) {
      const rawText = buffer.toString("utf8");
      const truncatedResult = truncateText(rawText, MAX_TEXT_CHARS);
      extractedText = truncatedResult.text;
      truncated = truncatedResult.truncated;
      const embedResult = await embed({
        model: google.embedding("gemini-embedding-2-preview"),
        value: extractedText,
        providerOptions: {
          google: {
            outputDimensionality: EMBEDDING_DIMENSIONS,
            taskType: "RETRIEVAL_DOCUMENT",
          },
        },
      });
      embedding = embedResult.embedding;
    } else {
      const dataUrl = toDataUrl(buffer, file.type);
      const embedResult = await embed({
        model: google.embedding("gemini-embedding-2-preview"),
        value: file.name,
        providerOptions: {
          google: {
            outputDimensionality: EMBEDDING_DIMENSIONS,
            taskType: "RETRIEVAL_DOCUMENT",
            content: [
              {
                type: "file",
                data: dataUrl,
                mediaType: file.type,
              },
            ],
          },
        },
      });
      embedding = embedResult.embedding;
    }

    let storagePath: string | undefined;

    try {
      const uploadedFile = await uploadFileToStorage(itemId, buffer, file.name, file.type);
      storagePath = uploadedFile.storagePath;

      const insertedItem = await insertStoredItem({
        id: itemId,
        kind: "file",
        createdAt: new Date().toISOString(),
        embedding: embedding ?? [],
        filename: uploadedFile.storedName,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        storagePath: uploadedFile.storagePath,
        fileUrl: uploadedFile.fileUrl,
        text: extractedText,
        truncated,
        metadata: {
          source: "upload",
        },
      });

      createdItems.push(insertedItem);
    } catch (error) {
      if (storagePath) {
        try {
          await removeStoredFile(storagePath);
        } catch {
          // Best-effort cleanup if the DB insert fails after upload.
        }
      }

      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to ingest uploaded file.",
        },
        { status: 500 },
      );
    }
  }

  if (createdItems.length === 0) {
    return NextResponse.json(
      { error: "No text or files provided." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    added: createdItems.map((item) => sanitizeStoredItem(item)),
  });
}
