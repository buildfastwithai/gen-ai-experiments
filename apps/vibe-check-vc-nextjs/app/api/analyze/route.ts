import { NextRequest, NextResponse } from "next/server";
import type {
    AnalysisResult,
    OpenRouterRequestBody,
    OpenRouterResponse,
} from "./types";

// ─── Config ────────────────────────────────────────────────────────────────────

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-sonnet-4-6";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_NAME = "VibeCheck VC";

// ─── Prompts ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a brutally honest Silicon Valley VC partner at a top-tier firm (think Sequoia, a16z, Benchmark).
You have reviewed thousands of pitches and have a razor-sharp eye for what works and what does not.
You speak with authority, wit, and just the right amount of savage honesty — always constructive, never cruel.

Rules:
- Be specific to the idea — never give generic boilerplate feedback.
- Use Silicon Valley lingo naturally.
- Think deeply about market size, business model, defensibility, and founder signals.
- Respond ONLY with a valid JSON object. No markdown, no code blocks, no extra text.`;

function buildUserPrompt(idea: string): string {
    return `Analyze this startup idea as a top-tier VC partner and return a JSON evaluation.

Startup Idea:
"${idea}"

Return this exact JSON structure (no extra fields, no markdown):
{
  "fundabilityScore": <integer 0-100, be realistic and harsh>,
  "verdictSummary": "<2-3 sentence sharp verdict — witty, direct, memorable>",
  "brutalFeedback": "<3-4 sentences of honest feedback on the idea, business model, and founder signals>",
  "marketReality": {
    "assessment": "<2-3 sentences on TAM/SAM/SOM — is the market real, growing, and accessible?>",
    "rating": "<one of: Massive | Solid | Niche | Questionable | Delusional>"
  },
  "monetization": {
    "assessment": "<2-3 sentences on revenue model, unit economics, pricing power, path to profitability>",
    "rating": "<one of: Crystal Clear | Promising | Fuzzy | Wishful Thinking | What Revenue?>"
  },
  "moat": {
    "assessment": "<2-3 sentences on defensibility, network effects, switching costs, IP, data advantages>",
    "rating": "<one of: Fortress | Solid Wall | Picket Fence | Wet Paper Bag | Nonexistent>"
  },
  "competition": {
    "assessment": "<2-3 sentences on competitive landscape, incumbents, well-funded rivals, differentiation>",
    "rating": "<one of: Blue Ocean | Differentiated | Crowded | Bloodbath | You Missed It>"
  },
  "biggestRedFlag": "<1-2 sentences on the single most critical risk or flaw that could kill this company>",
  "howToImprove": [
    "<concrete, actionable improvement #1>",
    "<concrete, actionable improvement #2>",
    "<concrete, actionable improvement #3>",
    "<concrete, actionable improvement #4>"
  ],
  "vcVerdict": "<one of: PASS | HARD PASS | MAYBE | INTRIGUED | WRITE THE CHECK>"
}`;
}

// ─── OpenRouter Client ─────────────────────────────────────────────────────────

async function analyzeWithClaude(idea: string): Promise<AnalysisResult> {
    const requestBody: OpenRouterRequestBody = {
        model: MODEL,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(idea) },
        ],
        temperature: 0.8,
        max_tokens: 1500,
        response_format: { type: "json_object" },
    };

    const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": SITE_URL,
            "X-Title": SITE_NAME,
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
    }

    const data: OpenRouterResponse = await response.json();

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error("OpenRouter returned an empty response.");
    }

    console.info(
        `[VibeCheck] Tokens — prompt: ${data.usage?.prompt_tokens}, ` +
        `completion: ${data.usage?.completion_tokens}, ` +
        `total: ${data.usage?.total_tokens}`
    );

    return JSON.parse(content) as AnalysisResult;
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    // 1. Parse request body
    const body = await req.json();
    const idea: string = body?.idea ?? "";

    // 2. Validate input
    if (!idea || idea.trim().length < 10) {
        return NextResponse.json(
            { error: "Please provide a more detailed startup idea (at least 10 characters)." },
            { status: 400 }
        );
    }

    if (idea.trim().length > 2000) {
        return NextResponse.json(
            { error: "Startup idea is too long. Keep it under 2000 characters." },
            { status: 400 }
        );
    }

    // 3. Ensure API key is configured
    if (!OPENROUTER_API_KEY) {
        return NextResponse.json(
            { error: "Server is not configured. Please set OPENROUTER_API_KEY." },
            { status: 503 }
        );
    }

    // 4. Call Claude via OpenRouter
    const result = await analyzeWithClaude(idea.trim());

    // 5. Return the analysis
    return NextResponse.json(result);
}
