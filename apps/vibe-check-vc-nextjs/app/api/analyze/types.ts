// ─── Shared Types for /api/analyze ────────────────────────────────────────────

export interface MarketSection {
    assessment: string;
    rating: string;
}

export interface AnalysisResult {
    fundabilityScore: number;
    verdictSummary: string;
    brutalFeedback: string;
    marketReality: MarketSection;
    monetization: MarketSection;
    moat: MarketSection;
    competition: MarketSection;
    biggestRedFlag: string;
    howToImprove: string[];
    vcVerdict: "PASS" | "HARD PASS" | "MAYBE" | "INTRIGUED" | "WRITE THE CHECK";
}

export interface OpenRouterMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface OpenRouterRequestBody {
    model: string;
    messages: OpenRouterMessage[];
    temperature: number;
    max_tokens: number;
    response_format: { type: "json_object" };
}

export interface OpenRouterResponse {
    id: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
