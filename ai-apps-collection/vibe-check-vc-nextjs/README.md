# VibeCheck VC 🔥

> **Get your startup idea brutally rated by an AI Silicon Valley VC.**

VibeCheck VC is an AI-powered web app that analyzes your startup idea and delivers a sharp, honest verdict — just like a real venture capitalist would. Paste your idea, get a fundability score, market analysis, moat rating, and savage-but-constructive feedback in seconds.

---

## 🚀 Live Demo

> Drop your startup idea → Get roasted → Build something better.

---

## ✨ Features

- 🧠 **AI-Powered Analysis** — Powered by Claude claude-sonnet-4-6 via OpenRouter for sharp, intelligent responses
- 📊 **Fundability Score** — Animated circular score meter (0–100) with color-coded ratings
- ⚖️ **VC Verdict** — `WRITE THE CHECK` / `INTRIGUED` / `MAYBE` / `PASS` / `HARD PASS`
- 📈 **Market Reality Check** — TAM/SAM/SOM assessment with ratings
- 💰 **Monetization Analysis** — Revenue model & unit economics evaluation
- 🏰 **Moat & Defensibility** — Competitive advantage assessment
- ⚔️ **Competition Landscape** — Honest competitive landscape analysis
- 🚨 **Biggest Red Flag** — The #1 critical risk identified
- 🛠️ **How to Improve** — 4 specific, actionable improvement suggestions
- 🎊 **Confetti Animation** — Fires when your score is above 80 (unicorn territory!)
- ⌨️ **Keyboard Shortcut** — `Cmd/Ctrl + Enter` to submit

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) |
| **UI Library** | [React 19](https://react.dev/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + Inline CSS (Glassmorphism) |
| **AI Model** | [Claude claude-sonnet-4-6](https://openrouter.ai/anthropic/claude-sonnet-4-6) via OpenRouter |
| **AI Integration** | [OpenRouter](https://openrouter.ai/) REST API (direct fetch, no SDK) |
| **Fonts** | [Inter](https://fonts.google.com/specimen/Inter) + [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) (Google Fonts) |
| **Backend** | Next.js API Routes (Serverless) |
| **Linting** | ESLint 9 |

---

## 📁 Project Structure

```
vibe-check-vc/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       ├── route.ts        # POST endpoint — validates input & calls Claude via OpenRouter
│   │       └── types.ts        # Shared TypeScript interfaces for the API
│   ├── globals.css             # Global styles, animations, glassmorphism
│   ├── layout.tsx              # Root layout with metadata & Google Fonts
│   └── page.tsx                # Main UI — input, loading state, results dashboard
├── public/                     # Static assets
├── .env.local                  # Environment variables (API key)
├── next.config.ts              # Next.js configuration
├── postcss.config.mjs          # PostCSS config for Tailwind
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies & scripts
```

---

## ⚙️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- An [OpenRouter API Key](https://openrouter.ai/keys) *(required — get one free at openrouter.ai)*

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/vibe-check-vc.git
cd vibe-check-vc
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
# .env.local

# Get your free API key at: https://openrouter.ai/keys
# Model in use: anthropic/claude-sonnet-4-6
OPENROUTER_API_KEY=your_openrouter_api_key_here

NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> ⚠️ **API key is required.** The app will return a `503` error if `OPENROUTER_API_KEY` is not set.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the production bundle |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |

---

## 🤖 How the AI Works

1. **User submits** a startup idea (10–2000 characters)
2. **API Route** (`/api/analyze`) validates the input and checks for the API key
3. A **system prompt** (VC persona) + **user prompt** (structured JSON schema) are sent to **Claude claude-sonnet-4-6** via the OpenRouter REST API
4. Claude responds with a **structured JSON object** (`response_format: { type: "json_object" }`)
5. The JSON is parsed and typed against `AnalysisResult` (from `types.ts`)
6. Token usage is logged server-side and the result is returned to the frontend

### AI Response Structure

```json
{
  "fundabilityScore": 72,
  "verdictSummary": "...",
  "brutalFeedback": "...",
  "marketReality": { "assessment": "...", "rating": "Solid" },
  "monetization": { "assessment": "...", "rating": "Promising" },
  "moat": { "assessment": "...", "rating": "Picket Fence" },
  "competition": { "assessment": "...", "rating": "Crowded" },
  "biggestRedFlag": "...",
  "howToImprove": ["tip 1", "tip 2", "tip 3", "tip 4"],
  "vcVerdict": "MAYBE"
}
```

### Fundability Score Labels

| Score Range | Label |
|---|---|
| 80 – 100 | 🔥 Unicorn Material |
| 65 – 79 | ⚡ Worth a Meeting |
| 45 – 64 | 🤔 Needs Work |
| 25 – 44 | 😬 Pivot Required |
| 0 – 24 | 💀 Back to Day Job |

---

## 🎨 Design Highlights

- **Dark glassmorphism** UI with `backdrop-filter: blur` cards
- **Animated SVG score meter** with smooth stroke-dashoffset transitions
- **Color-coded verdicts** — green for funded, red for rejected
- **Rotating loading messages** cycling every 1.8s during analysis
- **Confetti explosion** for high-scoring ideas (score > 80)
- **Responsive grid layout** for analysis cards
- **Google Fonts** — Inter for body, Space Grotesk for headings & scores

---

## 🔑 Getting an OpenRouter API Key

1. Go to [openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign in or create a free account
3. Click **"Create Key"**
4. Copy the key and paste it into your `.env.local` as `OPENROUTER_API_KEY`

> OpenRouter gives you access to Claude, GPT, Gemini, and 100+ models through a single API. The free tier includes credits to get started.

---

## 🚧 Roadmap / Ideas

- [ ] Share results as an image / Twitter card
- [ ] History of analyzed ideas (localStorage)
- [ ] Comparison mode — pitch two ideas head-to-head
- [ ] Investor persona selector (YC, a16z, Sequoia style)
- [ ] Export analysis as PDF

---

## ⚠️ Disclaimer

VibeCheck VC is **not actual investment advice**. Our virtual VC has no fiduciary duty, no fund, and no checkbook. This is a fun tool built for founders brave enough to hear the truth. 💜

---

## 📄 License

MIT License — feel free to fork, remix, and build on top of this.


