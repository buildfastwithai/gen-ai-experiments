#!/usr/bin/env node
/**
 * Launch MCP — zero-dependency MCP server (stdio, JSON-RPC 2.0).
 * Analyzes a GitHub repository and generates launch content via tools + prompts.
 * Each launch prompt writes its own Markdown file (analysis, blog, X, Reddit,
 * Hacker News, LinkedIn, release notes, changelog). The share card is SVG-only
 * and is returned inline so it never depends on a shared filesystem.
 * Requires Node 18+. Optional: GITHUB_TOKEN env var for rate limits / private repos.
 */
import { createInterface } from "node:readline";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// GitHub client
// ---------------------------------------------------------------------------
const API = "https://api.github.com";

async function gh(path) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "launch-mcp",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GitHub API ${res.status} for ${path}: ${body.slice(0, 300)}` +
        (res.status === 403 ? " (hint: set GITHUB_TOKEN to raise rate limits)" : "")
    );
  }
  return res.json();
}

function parseRepo(input) {
  const m = String(input).match(/(?:github\.com[/:])?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$/);
  if (!m) throw new Error(`Cannot parse repository from "${input}". Use "owner/repo".`);
  return { owner: m[1], repo: m[2] };
}

// ---------------------------------------------------------------------------
// Repository analysis (no release required)
// ---------------------------------------------------------------------------
async function analyzeRepo(repoInput, includeReadme = true, commitLimit = 30) {
  const { owner, repo } = parseRepo(repoInput);
  const info = await gh(`/repos/${owner}/${repo}`);
  const [languages, contributors, commits, tags, readme, latestRelease] = await Promise.all([
    gh(`/repos/${owner}/${repo}/languages`).catch(() => ({})),
    gh(`/repos/${owner}/${repo}/contributors?per_page=10`).catch(() => []),
    gh(`/repos/${owner}/${repo}/commits?per_page=${Math.min(commitLimit, 100)}`).catch(() => []),
    gh(`/repos/${owner}/${repo}/tags?per_page=10`).catch(() => []),
    includeReadme ? gh(`/repos/${owner}/${repo}/readme`).catch(() => null) : null,
    gh(`/repos/${owner}/${repo}/releases/latest`).catch(() => null),
  ]);

  const L = [];
  L.push(`# Repository analysis: ${info.full_name}`, "");
  L.push(`- **Description**: ${info.description ?? "n/a"}`);
  L.push(`- **URL**: ${info.html_url}${info.homepage ? ` — homepage: ${info.homepage}` : ""}`);
  L.push(`- **Stats**: ⭐ ${info.stargazers_count} stars, ${info.forks_count} forks, ${info.subscribers_count ?? "?"} watchers, ${info.open_issues_count} open issues`);
  L.push(`- **License**: ${info.license?.spdx_id ?? "none"} — created ${String(info.created_at).slice(0, 10)}, last push ${String(info.pushed_at).slice(0, 10)}`);
  if (info.topics?.length) L.push(`- **Topics**: ${info.topics.join(", ")}`);
  L.push(`- **Latest release**: ${latestRelease ? `${latestRelease.tag_name} (${String(latestRelease.published_at).slice(0, 10)})` : "none — this repo does not use GitHub releases"}`);
  L.push("");

  const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);
  if (totalBytes > 0) {
    L.push("## Languages", "");
    for (const [lang, bytes] of Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 8))
      L.push(`- ${lang}: ${((bytes / totalBytes) * 100).toFixed(1)}%`);
    L.push("");
  }

  if (contributors.length) {
    L.push("## Top contributors", "");
    for (const c of contributors) L.push(`- @${c.login} (${c.contributions} commits)`);
    L.push("");
  }

  if (commits.length) {
    L.push(`## Recent commits (last ${commits.length})`, "");
    for (const c of commits)
      L.push(`- ${String(c.commit?.author?.date ?? "").slice(0, 10)} ${(c.commit?.message ?? "").split("\n")[0].slice(0, 100)} (@${c.author?.login ?? c.commit?.author?.name ?? "?"})`);
    L.push("");
  }

  if (tags.length) L.push("## Tags", "", tags.map((t) => `- ${t.name}`).join("\n"), "");

  if (readme?.content) {
    const text = Buffer.from(readme.content, "base64").toString("utf8");
    L.push("## README (excerpt)", "", text.slice(0, 8000), "");
    if (text.length > 8000) L.push(`…(README truncated, ${text.length} chars total)`);
  }
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Share card (SVG only — returned inline)
// ---------------------------------------------------------------------------
const THEMES = {
  dark: { bg: "#0d1117", bg2: "#0d1117", fg: "#f0f6fc", muted: "#8b949e", accent: "#58a6ff" },
  light: { bg: "#ffffff", bg2: "#ffffff", fg: "#1f2328", muted: "#59636e", accent: "#0969da" },
  gradient: { bg: "#1a1b3a", bg2: "#3b1d5e", fg: "#ffffff", muted: "#b8b9d1", accent: "#8b7cf8" },
};
const escXml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const trunc = (s, max) => (s.length > max ? s.slice(0, max - 1) + "…" : s);
function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
const fmtStars = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n);

function buildCardSvg(o) {
  const theme = THEMES[o.theme ?? "gradient"];
  const accent = o.accentColor ?? theme.accent;
  const title = trunc(o.title ?? "New release", 48);
  const titleSize = title.length <= 30 ? 62 : title.length <= 38 ? 50 : 42;
  const highlights = (o.highlights ?? []).slice(0, 4).map((h) => trunc(h, 64));
  const font = `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
  const bulletY = 330;
  const bullets = highlights
    .map(
      (h, i) => `
    <circle cx="88" cy="${bulletY + i * 56 - 7}" r="5" fill="${accent}"/>
    <text x="112" y="${bulletY + i * 56}" font-family="${font}" font-size="28" fill="${theme.fg}" fill-opacity="0.92">${escXml(h)}</text>`
    )
    .join("");
  const stars =
    o.stars != null
      ? `<g transform="translate(1040, 76)">
          <path d="M12 1.5l3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3 1.2-6.9-5-4.9 6.9-1z" fill="#e3b341" transform="scale(1.15)"/>
          <text x="34" y="20" font-family="${font}" font-size="26" fill="${theme.muted}">${fmtStars(o.stars)}</text>
        </g>`
      : "";
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.bg}"/><stop offset="100%" stop-color="${theme.bg2}"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}"/><stop offset="100%" stop-color="${accent}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="10" fill="url(#bar)"/>
  <circle cx="1060" cy="520" r="260" fill="${mix(theme.bg2, accent, 0.07)}"/>
  <circle cx="1160" cy="600" r="160" fill="${mix(theme.bg2, accent, 0.09)}"/>
  <text x="80" y="96" font-family="${font}" font-size="30" fill="${theme.muted}">${escXml(trunc(o.repoName, 40))}</text>
  <rect x="76" y="130" rx="22" ry="22" width="${52 + o.version.length * 19}" height="46" fill="${mix(theme.bg, accent, 0.16)}"/>
  <text x="100" y="162" font-family="${font}" font-size="30" font-weight="600" fill="${accent}">${escXml(o.version)}</text>
  <text x="78" y="256" font-family="${font}" font-size="${titleSize}" font-weight="700" fill="${theme.fg}">${escXml(title)}</text>
  ${bullets}
  ${stars}
  <text x="80" y="580" font-family="${font}" font-size="24" fill="${theme.muted}">github.com/${escXml(trunc(o.repoName, 48))}</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// Bundled skills — expert writing playbooks shipped with the plugin.
// The server injects the relevant SKILL.md into the matching prompt so the
// content is generated using the skill automatically, no separate install.
// ---------------------------------------------------------------------------
const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");
const _skillCache = new Map();

// Read a bundled skill's SKILL.md, strip YAML frontmatter, cache the body.
function loadSkill(name) {
  if (_skillCache.has(name)) return _skillCache.get(name);
  let body = "";
  try {
    const raw = readFileSync(join(SKILLS_DIR, name, "SKILL.md"), "utf8");
    body = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  } catch {
    body = "";
  }
  _skillCache.set(name, body);
  return body;
}

// Render the "apply this skill" block appended to a prompt.
function skillBlock(name) {
  const body = loadSkill(name);
  if (!body) return "";
  const refDir = join(SKILLS_DIR, name, "references");
  const refNote = existsSync(refDir)
    ? ` Deeper reference material lives in \`${refDir}\` if you need it.`
    : "";
  return (
    `\n\n---\n\nApply the bundled **${name}** skill below when writing this content. ` +
    `Follow its guidance directly.${refNote}\n\n` +
    `<skill name="${name}">\n${body}\n</skill>`
  );
}

// Resolve a task's skills to an array (supports `skill: "x"` or `skills: [...]`).
function taskSkills(task) {
  if (Array.isArray(task.skills)) return task.skills;
  if (task.skill) return [task.skill];
  return [];
}

// ---------------------------------------------------------------------------
// Tool & prompt definitions
// ---------------------------------------------------------------------------
const REPO_DESC = 'GitHub repository as "owner/repo" or a full GitHub URL';
const DIR_DESC = "Directory where the launch files should be written (defaults to the current working directory)";

const TOOLS = [
  {
    name: "analyze_repo",
    description:
      "Analyze a GitHub repository: metadata, stars/forks, languages, topics, top contributors, recent commit activity, tags, and README excerpt. Run this first — its Markdown output is the source material for every launch prompt.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: REPO_DESC },
        include_readme: { type: "boolean", description: "Include a README excerpt (default true)" },
        commit_limit: { type: "integer", minimum: 1, maximum: 100, description: "Recent commits to include (default 30)" },
      },
      required: ["repo"],
    },
  },
  {
    name: "generate_share_card",
    description:
      "Generate a 1200x630 social share-card as SVG announcing a project or release. Provide a short title and up to 4 highlight bullets — typically distilled from analyze_repo output. Returns the SVG markup inline (save it as share-card.svg); optionally also writes it to output_dir.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: REPO_DESC },
        version: { type: "string", description: "Version or label shown on the card, e.g. v2.1.0" },
        title: { type: "string", description: "Headline (max ~46 chars shown)" },
        highlights: { type: "array", items: { type: "string" }, maxItems: 4, description: "Up to 4 short highlight bullets" },
        stars: { type: "integer", description: "Star count badge (from analyze_repo)" },
        theme: { type: "string", enum: ["dark", "light", "gradient"], description: "Card theme (default gradient)" },
        accent_color: { type: "string", description: "Accent hex color, e.g. #8b7cf8" },
        output_dir: { type: "string", description: "Optional directory to also write the .svg file (the SVG is always returned inline regardless)" },
      },
      required: ["repo", "version"],
    },
  },
];

// Each prompt owns one output file. `analysis` saves the raw analyze_repo
// output; the rest transform it into channel-specific content.
const TASKS = {
  analysis: {
    file: "analysis.md",
    description: "Save the raw repository analysis",
    instructions:
      "Save the analyze_repo Markdown output verbatim (this is the shared source material for the other launch files). Do not rewrite or summarize it.",
  },
  "release-notes": {
    file: "release-notes.md",
    description: "Write polished release notes",
    instructions:
      "Write polished release notes in Markdown. Structure: a 2-3 sentence overview of what the project/release is about; sections for New Features, Improvements, Bug Fixes, and Breaking Changes with migration guidance (omit empty sections); a Contributors thank-you list. Tone: clear, professional, developer-facing. Rewrite raw commit messages into user-benefit language.",
  },
  changelog: {
    file: "changelog.md",
    description: "Generate a Keep-a-Changelog entry",
    instructions:
      'Produce a changelog entry following the Keep a Changelog format (https://keepachangelog.com): a "## [version] - YYYY-MM-DD" heading, then "### Added / Changed / Deprecated / Removed / Fixed / Security" subsections as applicable. Terse, one line per change, imperative mood, reference PR numbers like (#123) only when present in the analysis.',
  },
  "blog-post": {
    file: "blog.md",
    description: "Write a launch blog post",
    instructions:
      "Write a launch blog post (500-800 words) in Markdown. Open with a hook about the problem this project solves, walk through the 2-4 most significant capabilities with concrete usage examples where the data supports them, mention notable fixes briefly, close with getting-started/upgrade instructions and a link to the repo. Tone: enthusiastic but substantive. Include a suggested title and 3 alternative titles at the top.",
  },
  x: {
    file: "x.md",
    description: "Write an X / Twitter thread",
    skill: "x-algo-tweet-writer",
    instructions:
      'Write an X (Twitter) post/thread announcing the project. Tweet 1: the announcement with the single most exciting point and the repo link. Middle tweets: one key feature or fix each, concrete and specific. Final tweet: call to action and thanks to contributors. Number the tweets "1/", "2/", etc. Minimal hashtags (max 2 total), no emoji spam. Also include the launch plan the skill specifies.',
  },
  reddit: {
    file: "reddit.md",
    description: "Write a Reddit post",
    instructions:
      "Write a Reddit post. First line: a suggested title (plain, non-clickbait, no emoji). Then a 150-300 word body in the honest, conversational tone Reddit rewards: what the project is, why you built it, how it compares to alternatives, and an explicit invitation for feedback. Suggest 1-2 relevant subreddits at the very top as a comment line. Avoid marketing language and hashtags.",
  },
  hackernews: {
    file: "hackernews.md",
    description: "Write a Show HN post",
    instructions:
      'Write a "Show HN" submission. First line: the title in the form "Show HN: <project> – <concise description>" (under 80 chars, no hype). Then a first-comment body (100-200 words) explaining what it does, the technical approach, what is genuinely novel, current limitations, and what feedback you are looking for. Plain text, no markdown headers, no emoji, no marketing adjectives — HN readers are technical and skeptical.',
  },
  linkedin: {
    file: "linkedin.md",
    description: "Write a LinkedIn post",
    skill: "writing-linkedin-posts",
    instructions:
      "Write a LinkedIn post (120-200 words). Professional but warm tone. Lead with the impact of the project, summarize 2-3 headline points in plain language a non-user could follow, credit the contributor community, end with a link to the repo and a question inviting engagement. No hashtag walls (max 3).",
  },
  "demo-site": {
    file: "demo.html",
    description: "Build an HTML demo website",
    skills: ["demo-site-builder", "ui-ux-pro-max"],
    instructions:
      "Build a single self-contained demo.html website that showcases the repository's functionality: a hero with the project name/tagline/badges and a link to the repo, a features grid, a live (or clearly-labelled simulated) interactive demo, the real install/usage code from the README, a tech-stack section, and a footer. Everything inline (HTML+CSS+JS), no build step, must render from file://. Ground every feature and code sample in the analysis — do not invent capabilities. Apply the ui-ux-pro-max design rules (accessibility, contrast, typography, spacing rhythm, interaction states, responsive layout, animation timing) to the HTML/CSS; its optional Python/CSV backend is not bundled, so use the embedded Quick Reference and checklists directly rather than running any CLI.",
  },
};

// full-launch-kit orchestrates every task above plus the share card.
const FULL_KIT = {
  description: "Generate the complete launch kit: analysis, release notes, changelog, blog, X/Reddit/HN/LinkedIn posts, and an HTML demo site, each as its own file, plus a share card",
  instructions:
    "Produce the complete launch kit, writing EACH deliverable as its own file in the output directory:\n" +
    Object.entries(TASKS)
      .map(([, t]) => `- ${t.file}: ${t.description.toLowerCase()}`)
      .join("\n") +
    "\nFollow the per-channel guidance from the individual prompts for each file. " +
    "For x.md apply the bundled x-algo-tweet-writer skill, for linkedin.md the writing-linkedin-posts skill, and for demo.html apply both the demo-site-builder and ui-ux-pro-max skills (all included below). " +
    "Then call the generate_share_card tool with a punchy title and the top 3-4 highlights, and save the returned SVG markup as share-card.svg in the same directory.",
};

const ALL_PROMPTS = { ...TASKS, "full-launch-kit": FULL_KIT };

const PROMPTS = Object.entries(ALL_PROMPTS).map(([name, t]) => ({
  name,
  description: t.description,
  arguments: [
    { name: "repo", description: REPO_DESC, required: true },
    { name: "output_dir", description: DIR_DESC, required: false },
  ],
}));

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------
async function callTool(name, args = {}) {
  if (name === "analyze_repo") {
    return analyzeRepo(args.repo, args.include_readme !== false, args.commit_limit ?? 30);
  }
  if (name === "generate_share_card") {
    const { owner, repo } = parseRepo(args.repo);
    if (!args.version) throw new Error("version is required");
    const svg = buildCardSvg({
      repoName: `${owner}/${repo}`,
      version: args.version,
      title: args.title,
      highlights: args.highlights,
      stars: args.stars,
      theme: args.theme,
      accentColor: args.accent_color,
    });
    let written = "";
    if (args.output_dir) {
      const path = join(args.output_dir, `${repo}-${String(args.version).replace(/[^\w.-]/g, "_")}-card.svg`);
      try {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, svg, "utf8");
        written = `\n\n(Also written to ${path})`;
      } catch (e) {
        written = `\n\n(Could not write to output_dir: ${e.message} — use the inline SVG above.)`;
      }
    }
    return (
      "Share card (SVG). Save the markup below as `share-card.svg`:\n\n" +
      "```svg\n" +
      svg +
      "\n```" +
      written
    );
  }
  throw new Error(`Unknown tool: ${name}`);
}

function getPrompt(name, args = {}) {
  const task = ALL_PROMPTS[name];
  if (!task) throw new Error(`Unknown prompt: ${name}`);
  if (!args.repo) throw new Error("repo argument is required");
  const dir = args.output_dir || "the current working directory";
  const fileLine =
    name === "full-launch-kit"
      ? `Write each file into ${dir}.`
      : `Save the result as \`${task.file}\` in ${dir}.`;
  let skillNames;
  if (name === "full-launch-kit") {
    // Kit writes x.md, linkedin.md and demo.html — attach every relevant skill.
    skillNames = ["x-algo-tweet-writer", "writing-linkedin-posts", "demo-site-builder", "ui-ux-pro-max"];
  } else {
    skillNames = taskSkills(task);
  }
  const skills = skillNames.map(skillBlock).join("");
  const text =
    `First call the launch-mcp tool \`analyze_repo\` with repo="${args.repo}". ` +
    `Then use its output to complete this task:\n\n${task.instructions}\n\n` +
    `${fileLine}\n\n` +
    `Ground every claim in the analysis data. Do not invent features, numbers, or quotes. ` +
    `Link to the repository URL where appropriate.` +
    skills;
  return { messages: [{ role: "user", content: { type: "text", text } }] };
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 over stdio (newline-delimited)
// ---------------------------------------------------------------------------
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const replyError = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(req) {
  const { id, method, params = {} } = req;
  try {
    switch (method) {
      case "initialize":
        return reply(id, {
          protocolVersion: params.protocolVersion || "2024-11-05",
          capabilities: { tools: {}, prompts: {} },
          serverInfo: { name: "launch-mcp", version: "0.4.0" },
        });
      case "ping":
        return reply(id, {});
      case "tools/list":
        return reply(id, { tools: TOOLS });
      case "tools/call": {
        try {
          const text = await callTool(params.name, params.arguments);
          return reply(id, { content: [{ type: "text", text }] });
        } catch (err) {
          return reply(id, { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true });
        }
      }
      case "prompts/list":
        return reply(id, { prompts: PROMPTS });
      case "prompts/get":
        return reply(id, getPrompt(params.name, params.arguments));
      case "resources/list":
        return reply(id, { resources: [] });
      default:
        if (id !== undefined) replyError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    if (id !== undefined) replyError(id, -32603, err.message || String(err));
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  line = line.trim();
  if (!line) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  handle(req);
});
rl.on("close", () => process.exit(0));
console.error("launch-mcp server running on stdio (zero-dependency build)");
