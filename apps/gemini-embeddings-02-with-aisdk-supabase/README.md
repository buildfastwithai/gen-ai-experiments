# Gemini Library

A small multimodal RAG app built with Next.js, the Vercel AI SDK, Supabase Storage, Postgres, and `pgvector`.

The core idea is simple: upload notes, images, audio, video, or PDFs, embed them with `gemini-embedding-2-preview`, store the vectors in Supabase, and chat over the most relevant matches.

## Why Gemini Embedding 2

This project is centered on **Gemini Embedding 2**, Google’s natively multimodal embedding model. According to Google, the model maps text, images, audio, video, and documents into a **shared embedding space**, which makes it a strong fit for retrieval systems that need to search across mixed media instead of text alone.

That matters here because the app is not limited to text notes:

- text inputs are embedded directly
- text files are embedded from extracted content
- images, audio, video, and PDFs are stored as files and indexed for retrieval
- user queries are embedded separately with the retrieval-query task type

In this codebase, embeddings are generated with:

- model: `gemini-embedding-2-preview`
- output dimensionality: `1536`
- document task type for stored content
- query task type for search

Using 1536 dimensions keeps vector storage and retrieval practical while still aligning with Google’s recommended dimension options for Gemini Embedding 2.

Reference: [Gemini Embedding 2 blog post](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-embedding-2/)

## How It Works

1. Upload text or files through the UI.
2. The server generates embeddings with Gemini Embedding 2.
3. Metadata and vectors are stored in Supabase/Postgres with `pgvector`.
4. At chat time, the latest user message is embedded as a retrieval query.
5. The top matches are added as context and answered with `gemini-2.5-flash`.

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/20260317_uploaded_items.sql`.
3. Copy `.env.example` to `.env`.
4. Set these environment variables:
   - `GOOGLE_GENERATIVE_AI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET` (defaults to `uploads`)
5. Start the app with `npm run dev`.

## Notes

- Retrieval is backed by a Postgres RPC function, `match_uploaded_items`.
- File binaries live in Supabase Storage.
- Embeddings and metadata live in Postgres.
- Chat history stays client-side.
