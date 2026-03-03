# 🍌 Nano Banana 2 — Interactive Cookbook

An interactive guide to every feature of **Gemini 3.1 Flash Image Preview** (`gemini-3.1-flash-image-preview`). Try each feature live and get the Python code for it.

## What's inside

| #   | Feature                 | Description                                                                    |
| --- | ----------------------- | ------------------------------------------------------------------------------ |
| 01  | **Generate Images**     | Text to image with combined text + image response                              |
| 02  | **Edit Images**         | Pass an image + prompt, maintains character consistency                        |
| 03  | **Aspect Ratio**        | Control dimensions including NB2-exclusive extreme ratios (1:4, 4:1, 1:8, 8:1) |
| 04  | **Resolution**          | 512px fast mode (NB2 exclusive) → 1K → 2K → 4K                                 |
| 05  | **Chat Mode**           | Multi-turn conversation with image context memory                              |
| 06  | **Thinking**            | Model reasons before generating — Minimal or High level                        |
| 07  | **Search Grounding**    | Real-time Google Search data in image generation                               |
| 08  | **Image Grounding**     | Search for reference images on Google (NB2 exclusive)                          |
| 09  | **Mix Multiple Images** | Combine up to 6 images in high fidelity                                        |
| 10  | **Generate Stories**    | Multiple images in one request for comics, guides, narratives                  |

## Files

```
nano-banana-2-cookbook/
├── interactive_cookbook.html   # Open in browser, no setup needed
├── nano_banana_2_cookbook.ipynb  # Colab notebook
└── README.md
```

## Quickstart

**HTML file** — just open it in your browser, paste your Google API key, and start experimenting.

**Colab notebook** — click the badge below to run in Google Colab.

[![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/buildfastwithai/gen-ai-experiments/blob/main/nano-banana-2-cookbook/nano_banana_2_cookbook.ipynb)

**Install the SDK**

```bash
pip install google-genai>=1.65.0
```

**Get your API key** from [Google AI Studio](https://aistudio.google.com/apikey)

## Model

```
gemini-3.1-flash-image-preview
```

Capabilities: Image generation · Image editing · Thinking · Search grounding · Image grounding · Up to 4K resolution · 512px fast mode
