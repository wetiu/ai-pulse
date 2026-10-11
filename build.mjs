#!/usr/bin/env node
/**
 * AI Pulse - zero-dependency AI news site generator.
 *
 * Focus: important AI news, weighted toward game development, web development,
 * app development and the AI business.
 *
 * Pipeline: fetch feeds -> parse -> require an AI signal -> classify topic ->
 * score importance -> render site, archives, feeds, PWA and SEO files.
 * Node >= 18 (built-in fetch). No npm dependencies.
 */
import { mkdir, writeFile, readFile, readdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "public");
const ASSETS = join(__dirname, "assets");

// Feature flags
const ADS_ENABLED = false;          // flip to true once you add an ad network
const ARCHIVE_RENDER_DAYS = 60;     // how many past days get an HTML page
const SITE_NAME = "AI Pulse";
const SITE_TAGLINE = "Important AI news for builders - game dev, web dev, app dev and the AI business.";
// Absolute base URL: social crawlers, sitemaps and feeds all REQUIRE absolute URLs.
const SITE_URL = (process.env.AIPULSE_SITE_URL || "https://wetiu.github.io/ai-pulse/").replace(/\/?$/, "/");

const FEEDS = [
  { name: "OpenAI",            url: "https://openai.com/news/rss.xml",            topic: "Models & Labs", weight: 3, native: true },
  { name: "Google DeepMind",   url: "https://deepmind.google/blog/rss.xml",       topic: "Models & Labs", weight: 3, native: true },
  { name: "Google AI Blog",    url: "https://blog.google/technology/ai/rss/",     topic: "Models & Labs", weight: 2.5, native: true },
  { name: "Microsoft AI",      url: "https://news.microsoft.com/source/topics/ai/feed/", topic: "Models & Labs", weight: 2.5, native: true },
  { name: "NVIDIA",            url: "https://blogs.nvidia.com/feed/",             topic: "Models & Labs", weight: 2, native: false },
  { name: "Hugging Face",      url: "https://huggingface.co/blog/feed.xml",       topic: "Open Source", weight: 2, native: true },
  { name: "Simon Willison",    url: "https://simonwillison.net/atom/everything/", topic: "Open Source", weight: 2, native: true },
  { name: "Latent Space",      url: "https://www.latent.space/feed",              topic: "Models & Labs", weight: 2, native: true },
  { name: "smol.ai news",      url: "https://news.smol.ai/rss.xml",               topic: "Models & Labs", weight: 2, native: true },
  { name: "Import AI",         url: "https://importai.substack.com/feed",         topic: "Research", weight: 2, native: true },
  { name: "Google Research",   url: "https://research.google/blog/rss/",          topic: "Research", weight: 2, native: true },
  { name: "arXiv cs.AI",       url: "https://rss.arxiv.org/rss/cs.AI",            topic: "Research", weight: 1, native: true },
  { name: "TechCrunch AI",     url: "https://techcrunch.com/category/artificial-intelligence/feed/", topic: "AI Business", weight: 2, native: true },
  { name: "The Decoder",       url: "https://the-decoder.com/feed/",              topic: "AI Business", weight: 2, native: true },
  { name: "MarkTechPost",      url: "https://www.marktechpost.com/feed/",         topic: "Research", weight: 1.5, native: true },
  { name: "The Verge AI",      url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", topic: "AI Business", weight: 1.5, native: true },
  { name: "MIT Tech Review",   url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", topic: "AI Business", weight: 1.5, native: true },
  { name: "WIRED AI",          url: "https://www.wired.com/feed/tag/ai/latest/rss", topic: "AI Business", weight: 1.5, native: true },
  { name: "HN (AI 100+)",      url: "https://hnrss.org/newest?q=AI&points=100",   topic: "AI Business", weight: 1.5, native: true },
  { name: "Ars Technica",      url: "https://feeds.arstechnica.com/arstechnica/technology-lab", topic: "Models & Labs", weight: 1.5, native: false },
  { name: "TLDR AI",           url: "https://tldr.tech/api/rss/ai",               topic: "AI Business", weight: 1.5, native: true },
  { name: "Crunchbase News",   url: "https://news.crunchbase.com/feed/",          topic: "AI Business", weight: 2, native: false },
  { name: "Sifted",            url: "https://sifted.eu/feed",                     topic: "AI Business", weight: 2, native: false },
  { name: "AI Business",       url: "https://aibusiness.com/rss.xml",             topic: "AI Business", weight: 2, native: true },
  { name: "SiliconANGLE AI",   url: "https://siliconangle.com/category/ai/feed/", topic: "AI Business", weight: 1.5, native: true },
  { name: "PYMNTS AI",         url: "https://www.pymnts.com/category/artificial-intelligence/feed/", topic: "AI Business", weight: 1.5, native: true },
  { name: "Game Developer",    url: "https://www.gamedeveloper.com/rss.xml",      topic: "Game Dev", weight: 2, native: false },
  { name: "GamesIndustry.biz", url: "https://www.gamesindustry.biz/feed",         topic: "Game Dev", weight: 2, native: false },
  { name: "80 Level",          url: "https://80.lv/feed/",                        topic: "Game Dev", weight: 1.5, native: false },
  { name: "Unity",             url: "https://blog.unity.com/feed",                topic: "Game Dev", weight: 2, native: false },
  { name: "Unreal Engine",     url: "https://www.unrealengine.com/en-US/rss",     topic: "Game Dev", weight: 2, native: false },
  { name: "Godot Engine",      url: "https://godotengine.org/rss.xml",            topic: "Game Dev", weight: 1.5, native: false },
  { name: "Vercel",            url: "https://vercel.com/blog/rss.xml",            topic: "Web Dev", weight: 2, native: false },
  { name: "Next.js",           url: "https://nextjs.org/feed.xml",                topic: "Web Dev", weight: 1.5, native: false },
  { name: "web.dev",           url: "https://web.dev/feed.xml",                   topic: "Web Dev", weight: 2, native: false },
  { name: "Chrome Developers", url: "https://developer.chrome.com/blog/feed.xml", topic: "Web Dev", weight: 2, native: false },
  { name: "MDN Blog",          url: "https://developer.mozilla.org/en-US/blog/rss.xml", topic: "Web Dev", weight: 2, native: false },
  { name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/",     topic: "Web Dev", weight: 1.5, native: false },
  { name: "CSS-Tricks",        url: "https://css-tricks.com/feed/",               topic: "Web Dev", weight: 1.5, native: false },
  { name: "GitHub Blog",       url: "https://github.blog/feed/",                  topic: "Web Dev", weight: 2, native: false },
  { name: "Apple Developer",   url: "https://developer.apple.com/news/rss/news.rss", topic: "App Dev", weight: 2, native: false },
  { name: "Android Developers", url: "https://android-developers.googleblog.com/feeds/posts/default", topic: "App Dev", weight: 2, native: false },
  { name: "React Native",      url: "https://reactnative.dev/blog/rss.xml",       topic: "App Dev", weight: 2, native: false },
  { name: "JetBrains",         url: "https://blog.jetbrains.com/feed/",           topic: "App Dev", weight: 1.5, native: false },
  { name: "Microsoft DevBlogs", url: "https://devblogs.microsoft.com/feed/",       topic: "App Dev", weight: 1.5, native: false },
  { name: "PyTorch",           url: "https://pytorch.org/blog/feed.xml",          topic: "Open Source", weight: 2, native: true },
  { name: "TensorFlow",        url: "https://blog.tensorflow.org/feeds/posts/default", topic: "Open Source", weight: 2, native: true },
  { name: "AWS ML Blog",       url: "https://aws.amazon.com/blogs/machine-learning/feed/", topic: "Models & Labs", weight: 1.5, native: true },
];

const FOCUS = ["Game Dev", "Web Dev", "App Dev", "AI Business"];
const TOPICS = FOCUS.concat(["Models & Labs", "Open Source", "Research"]);
const TOP_N = 10;

const UA = "AIPulseBot/1.0 (static AI news aggregator)";
const MAX_ITEMS = 500;
const PER_SOURCE_CAP = 25;
const DAYS_WINDOW = 14;

const AI_SIGNAL = [
  "ai", "a.i.", "artificial intelligence", "machine learning", "deep learning", "neural",
  "llm", "llms", "large language model", "foundation model", "frontier model", "genai",
  "generative ai", "gen ai", "gpt", "chatgpt", "claude", "gemini", "llama", "mistral",
  "deepseek", "grok", "qwen", "phi-3", "copilot", "codex", "cursor", "windsurf",
  "stable diffusion", "midjourney", "dall-e", "sora", "whisper", "diffusion",
  "transformer", "transformers", "attention", "embedding", "embeddings", "rag",
  "fine-tune", "fine-tuning", "finetune", "prompt", "prompting", "agent", "agents",
  "agentic", "inference", "training", "dataset", "benchmark", "hallucination",
  "chatbot", "openai", "anthropic", "deepmind", "hugging face", "nvidia", "tensor",
  "pytorch", "quantization", "distillation", "vision model", "multimodal",
  "text-to-image", "text-to-video", "text-to-speech", "speech recognition", "ml",
  "computer vision", "nlp", "reinforcement learning", "gpu", "mlops", "ai model",
];

const TOPIC_RULES = {
  "Game Dev": [
    "game", "games", "gaming", "gameplay", "game dev", "game development", "unity",
    "unreal", "unreal engine", "godot", "game engine", "npc", "npcs", "non-player character",
    "procedural generation", "level design", "shader", "shaders", "physics engine",
    "roblox", "epic games", "steam", "indie game", "character animation", "mocap",
    "motion capture", "ray tracing", "dlss", "fps", "playtest", "modding", "metaverse",
  ],
  "Web Dev": [
    "web", "website", "web app", "web development", "frontend", "front-end", "backend",
    "javascript", "typescript", "react", "next.js", "vercel", "svelte", "vue", "angular",
    "css", "html", "tailwind", "deno", "bun", "node.js", "nodejs", "browser", "chrome",
    "chromium", "safari", "firefox", "webgpu", "wasm", "webassembly", "dom", "web standards",
    "accessibility", "seo", "web framework", "react server components", "ssr", "static site",
  ],
  "App Dev": [
    "app", "apps", "mobile", "mobile app", "ios", "ipados", "android", "swift", "swiftui",
    "kotlin", "jetpack compose", "flutter", "react native", "xcode", "android studio",
    "app store", "play store", "wear os", "watchos", "visionos", "sdk", "push notification",
    "mobile development", "app development", "on-device", "edge device", "native app",
  ],
  "AI Business": [
    "funding", "raises", "raised", "series a", "series b", "series c", "seed round",
    "valuation", "acquires", "acquisition", "acquired", "ipo", "revenue", "arr",
    "earnings", "startup", "startups", "investment", "investors", "vc", "venture capital",
    "market", "markets", "partnership", "enterprise", "b2b", "monetization", "pricing",
    "layoffs", "hiring", "competition", "antitrust", "regulation", "ipo filing",
    "chips", "data center", "datacenter", "cloud", "capex", "stake", "deal",
  ],
  "Models & Labs": [
    "model", "models", "gpt", "chatgpt", "claude", "gemini", "llama", "llm", "llms",
    "gemma", "phi", "qwen", "deepseek", "grok", "mistral", "frontier model",
    "foundation model", "reasoning model", "multimodal", "openai", "anthropic",
    "deepmind", "meta ai", "copilot", "api", "context window", "tokens", "inference",
    "chatbot", "assistant", "benchmark", "evaluation",
  ],
  "Open Source": [
    "open source", "open-source", "open weights", "open-weights", "hugging face",
    "github", "library", "libraries", "framework", "sdk", "weights", "license",
    "apache", "mit license", "repository", "repo", "npm", "pip", "package",
    "self-host", "self-hosted", "local model", "ollama", "llama.cpp",
  ],
  "Research": [
    "paper", "papers", "research", "study", "arxiv", "benchmark", "state of the art",
    "sota", "novel", "we propose", "researchers", "experiment", "ablation", "dataset release",
  ],
};

const IMPORTANT_WORDS = [
  "launch", "launches", "launched", "release", "releases", "released", "announces",
  "announced", "unveils", "unveiled", "introduces", "introducing", "debuts", "ships",
  "open-sources", "open sources", "open sourced", "open weights", "raises", "raised",
  "acquires", "acquired", "acquisition", "partners", "partnership", "breakthrough",
  "beats", "surpasses", "state of the art", "sota", "first", "major", "biggest",
  "billion", "million", "record", "fastest", "cheaper", "free", "generally available",
  "ga", "preview", "general availability", "api", "beta", "new model", "flagship",
];

const NEGATIVE = [
  "deal of the day", "best deals", "discount", "coupon", "prime day", "black friday",
  "cyber monday", "how to watch", "buying guide", "horoscope", "giveaway", "sweepstakes",
];

function norm(text) {
  return " " + String(text || "").toLowerCase().replace(/[^a-z0-9.#+/-]+/g, " ") + " ";
}
function hits(normalized, list) {
  let n = 0;
  for (const k of list) if (normalized.indexOf(" " + k + " ") >= 0) n++;
  return n;
}
function stripCdata(s) { return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"); }
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(Number(d)); })
    .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function clean(s) {
  if (!s) return "";
  return decodeEntities(stripCdata(s.replace(/<[^>]*>/g, " "))).replace(/\s+/g, " ").trim();
}
// Feeds sometimes leak escaped newlines, JSON fragments or CDATA leftovers into
// titles and summaries. Strip that noise so cards read like prose.
function tidy(s) {
  return String(s || "")
    .replace(/\]\]>/g, " ")
    .replace(/\\[nrt]/g, " ")
    .replace(/\\u[0-9a-fA-F]{4}/g, " ")
    .replace(/"[a-z_0-9]+"\s*:/gi, " ")
    .replace(/\\+/g, " ")
    .replace(/[\"{}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tagOf(block, names) {
  for (const n of names) {
    const re = new RegExp("<" + n + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + n + ">", "i");
    const m = block.match(re);
    if (m && clean(m[1])) return clean(m[1]);
  }
  return "";
}
function linkOf(block) {
  const href = block.match(/<link[^>]*\shref=["']([^"']+)["'][^>]*>/i);
  if (href) return decodeEntities(href[1].trim());
  const m = block.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);
  return m ? clean(m[1]) : "";
}
function parseFeed(xml, feed) {
  const raw = [];
  const re = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) raw.push(m[2]);
  const items = [];
  for (const b of raw) {
    const title = tidy(tagOf(b, ["title"]));
    const url = linkOf(b);
    const dateStr = tagOf(b, ["pubDate", "published", "updated", "dc:date", "date"]);
    const summary = tidy(tagOf(b, ["description", "summary", "content:encoded", "content"]));
    if (!title || !url) continue;
    const d = dateStr ? new Date(dateStr) : null;
    items.push({
      title: title, url: url, summary: trimSummary(summary),
      source: feed.name, feedTopic: feed.topic, weight: feed.weight, native: feed.native,
      date: d && !isNaN(d.getTime()) ? d.toISOString() : null,
    });
  }
  return items;
}
// Cut on a word boundary so excerpts never end mid-word, and mark the cut.
function trimSummary(s) {
  if (!s) return "";
  if (s.length <= 300) return s;
  return s.slice(0, 300).replace(/\s+\S*$/, "") + "\u2026";
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function fetchFeed(feed) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, 25000);
    try {
      const res = await fetch(feed.url, {
        headers: {
          "User-Agent": UA,
          "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
        redirect: "follow", signal: ctrl.signal,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const items = parseFeed(await res.text(), feed);
      console.log(String(items.length).padStart(4) + "  " + feed.name);
      return items;
    } catch (e) {
      if (attempt === 2) { console.error("  ERR  " + feed.name + ": " + e.message); return []; }
      await sleep(1500);
    } finally { clearTimeout(t); }
  }
  return [];
}

function classify(item) {
  const titleN = norm(item.title);
  const all = norm(item.title + " " + item.summary);
  const aiScore = hits(titleN, AI_SIGNAL) * 2 + hits(all, AI_SIGNAL);
  if (!item.native && aiScore < 2) return null; // dev/business feeds must earn their place
  if (hits(all, NEGATIVE) > 0) return null;

  let topic = item.feedTopic;
  let best = 0;
  if (FOCUS.indexOf(item.feedTopic) < 0) {
    for (const t of TOPICS) {
      const rules = TOPIC_RULES[t] || [];
      const s = hits(titleN, rules) * 2 + hits(all, rules);
      if (s > best) { best = s; topic = t; }
    }
  }
  const isFocus = FOCUS.indexOf(topic) >= 0;
  const importance = item.weight * 2
    + (isFocus ? 3 : 0)
    + Math.min(aiScore, 12) * 0.4
    + Math.min(best, 6) * 0.5
    + hits(titleN, IMPORTANT_WORDS) * 1.6
    + hits(all, IMPORTANT_WORDS) * 0.5
    + (item.title.length > 12 ? 0 : -3);
  return { topic: topic, importance: importance, isFocus: isFocus };
}

// ---------------------------------------------------------------- rendering

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
}
function readingTime(item) {
  const words = ((item.summary || "") + " " + item.title).split(/\s+/).length;
  return Math.max(1, Math.round(words / 200)) + " min read";
}
function timeAgo(iso, now) {
  if (!iso) return "";
  const mins = Math.floor(Math.max(0, now - new Date(iso).getTime()) / 60000);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

const STYLE = [
  ":root{--bg:#0a0c11;--panel:#12161f;--panel2:#171c28;--fg:#e9edf5;--mut:#8b97ad;--acc:#6ea8fe;--acc2:#8ef0c0;--gold:#f5c451;--bd:#232b3c;--glow:rgba(110,168,254,.10)}",
  "html[data-theme=light]{--bg:#f6f8fc;--panel:#ffffff;--panel2:#eef2f9;--fg:#0f1520;--mut:#5b6678;--acc:#1f6feb;--acc2:#0f9d6a;--gold:#a5761b;--bd:#dde4ee;--glow:rgba(31,111,235,.08)}",
  "*{box-sizing:border-box}",
  "html{scroll-behavior:smooth}",
  "body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;-webkit-font-smoothing:antialiased}",
  ".bg-glow{position:fixed;inset:-20% -20% auto -20%;height:60vh;background:radial-gradient(closest-side,var(--glow),transparent 70%);pointer-events:none;z-index:0}",
  "a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}",
  ".wrap{max-width:1080px;margin:0 auto;padding:0 20px;position:relative;z-index:1}",
  ".bar{display:flex;align-items:center;justify-content:space-between;padding:16px 0}",
  ".brand{font-weight:800;font-size:1.15rem;color:var(--fg);letter-spacing:-.02em}",
  ".brand .dot{color:var(--acc2)}",
  ".bar nav{display:flex;align-items:center;gap:16px;font-size:.9rem}",
  ".bar nav a{color:var(--mut)}.bar nav a:hover{color:var(--fg);text-decoration:none}",
  "button.icon{background:var(--panel);border:1px solid var(--bd);color:var(--fg);border-radius:10px;width:38px;height:34px;cursor:pointer;font-size:1rem}",
  "button.icon:hover{border-color:var(--acc)}",
  ".hero{padding:26px 0 6px}",
  "h1{margin:0;font-size:clamp(2rem,5.2vw,3.4rem);letter-spacing:-.035em;line-height:1.05}",
  "h1 .dot{color:var(--acc2)}",
  ".tagline{color:var(--mut);margin:.7rem 0 0;font-size:1.05rem;max-width:62ch}",
  ".stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}",
  ".pill{background:var(--panel);border:1px solid var(--bd);border-radius:999px;padding:7px 14px;font-size:.82rem;color:var(--mut)}",
  ".pill b{color:var(--fg)}",
  ".controls{padding:20px 0 6px;position:sticky;top:0;background:linear-gradient(180deg,var(--bg) 78%,transparent);z-index:5;padding-bottom:10px}",
  "input[type=search]{width:100%;padding:14px 16px;border-radius:14px;border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-size:1rem;outline:none}",
  "input[type=search]:focus{border-color:var(--acc);box-shadow:0 0 0 3px var(--glow)}",
  ".chips{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 0}",
  ".chip{padding:6px 12px;border-radius:999px;border:1px solid var(--bd);background:var(--panel);color:var(--mut);cursor:pointer;font-size:.82rem;white-space:nowrap}",
  ".chip:hover{color:var(--fg)}",
  ".chip.active{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:600}",
  ".chip.focus{border-color:var(--gold);color:var(--gold)}",
  ".chip.focus.active{background:var(--gold);border-color:var(--gold);color:#1a1200}",
  "main{padding:14px 0 40px}",
  ".grid{display:grid;grid-template-columns:1fr;gap:14px}",
  "@media(min-width:820px){.grid{grid-template-columns:1fr 1fr}.card.featured{grid-column:1/-1}}",
  ".card{background:var(--panel);border:1px solid var(--bd);border-radius:16px;padding:18px;transition:border-color .15s,transform .15s;display:flex;flex-direction:column}",
  ".card:hover{border-color:var(--acc);transform:translateY(-2px)}",
  ".card.featured{background:linear-gradient(135deg,var(--panel2),var(--panel));border-color:var(--gold)}",
  ".card.featured h3{font-size:clamp(1.2rem,2.6vw,1.6rem)}",
  ".meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.74rem}",
  ".src{display:inline-flex;align-items:center;gap:6px;color:var(--acc2);font-weight:600}",
  ".src img{width:14px;height:14px;border-radius:3px}",
  ".cat{color:var(--mut);border:1px solid var(--bd);border-radius:999px;padding:1px 8px}",
  ".cat.focus{color:var(--gold);border-color:color-mix(in srgb,var(--gold) 40%,transparent)}",
  ".badge{background:var(--acc);color:#fff;border-radius:999px;padding:1px 8px;font-weight:700}",
  ".hot{background:var(--gold);color:#1a1200;border-radius:999px;padding:1px 8px;font-weight:700}",
  ".time{color:var(--mut);margin-left:auto}",
  ".card h3{margin:.5rem 0 .35rem;font-size:1.06rem;line-height:1.35}",
  ".card h3 a{color:var(--fg)}",
  ".card p{margin:.1rem 0 0;color:var(--mut);font-size:.9rem}",
  ".card p + p{margin-top:.75rem}",
  ".foot{margin-top:auto;padding-top:12px;color:var(--mut);font-size:.74rem}",
  ".empty{color:var(--mut);text-align:center;padding:40px 0}",
  ".ad-slot{border:1px dashed var(--bd);border-radius:16px;padding:22px;text-align:center;color:var(--mut);font-size:.85rem;margin:14px 0}",
  "footer{border-top:1px solid var(--bd);padding:26px 0 60px;color:var(--mut);font-size:.85rem}",
  "footer .cols{display:grid;gap:18px;grid-template-columns:1fr}",
  "@media(min-width:700px){footer .cols{grid-template-columns:2fr 1fr 1fr}}",
  "footer a{color:var(--mut)}footer a:hover{color:var(--fg)}",
  "footer h4{color:var(--fg);margin:0 0 8px;font-size:.9rem}",
  "footer ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}",
  ".toTop{position:fixed;right:18px;bottom:18px;background:var(--acc);color:#fff;border:none;border-radius:999px;padding:10px 14px;cursor:pointer;font-size:.85rem;display:none;z-index:9}",
].join("\n");

const SCRIPT = [
  "var root=document.documentElement;",
  "try{var saved=localStorage.getItem('aipulse-theme');if(saved){root.setAttribute('data-theme',saved);}else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches){root.setAttribute('data-theme','light');}}catch(e){}",
  "var tb=document.getElementById('theme');",
  "function paint(){if(tb)tb.textContent=root.getAttribute('data-theme')==='light'?'\\u263e':'\\u2600';}",
  "paint();",
  "if(tb)tb.addEventListener('click',function(){var next=root.getAttribute('data-theme')==='light'?'dark':'light';root.setAttribute('data-theme',next);try{localStorage.setItem('aipulse-theme',next);}catch(e){}paint();});",
  "var state={q:'',topic:'all',source:'all'};",
  "var cards=Array.prototype.slice.call(document.querySelectorAll('.card'));",
  "var empty=document.getElementById('empty');",
  "function apply(){var n=0;for(var i=0;i<cards.length;i++){var c=cards[i];",
  "var ok=(state.topic==='all'||c.dataset.topic===state.topic)&&(state.source==='all'||c.dataset.source===state.source)&&(!state.q||c.dataset.search.indexOf(state.q)>=0);",
  "c.style.display=ok?'':'none';if(ok)n++;}if(empty)empty.style.display=n?'none':'block';}",
  "var qi=document.getElementById('q');if(qi)qi.addEventListener('input',function(e){state.q=e.target.value.trim().toLowerCase();apply();});",
  "['topicChips','srcChips'].forEach(function(id){var box=document.getElementById(id);if(!box)return;box.addEventListener('click',function(e){",
  "var btn=e.target.closest('.chip');if(!btn)return;",
  "var all=e.currentTarget.querySelectorAll('.chip');for(var i=0;i<all.length;i++){all[i].classList.toggle('active',all[i]===btn);}",
  "state[btn.dataset.filter]=btn.dataset.value;apply();});});",
  "var tt=document.getElementById('toTop');",
  "window.addEventListener('scroll',function(){if(tt)tt.style.display=window.scrollY>800?'block':'none';});",
  "if(tt)tt.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});",
  "if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0){navigator.serviceWorker.register(root0+'sw.js').catch(function(){});}",
].join("\n");

const NOFLASH = [
  "<script>",
  "try{var s=localStorage.getItem('aipulse-theme');var d=s||((window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark');document.documentElement.setAttribute('data-theme',d);}catch(e){}",
  "</" + "script>",
].join("\n");

function cardHtml(i, rank, now, featured) {
  const isNew = i.date && now - new Date(i.date).getTime() < 86400000;
  const focus = i.isFocus ? " focus" : "";
  const host = hostOf(i.url);
  const o = [];
  o.push('<article class="card' + (featured ? " featured" : "") + '" data-topic="' + esc(i.topic) + '" data-source="' + esc(i.source) + '" data-search="' + esc((i.title + " " + i.summary + " " + i.source + " " + i.topic).toLowerCase()) + '">');
  o.push('<div class="meta"><span class="src">'
    + (host ? '<img src="https://www.google.com/s2/favicons?domain=' + esc(host) + '&sz=64" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : "")
    + esc(i.source) + '</span><span class="cat' + focus + '">' + esc(i.topic) + "</span>"
    + (rank < TOP_N ? '<span class="hot">TOP ' + (rank + 1) + "</span>" : "")
    + (isNew ? '<span class="badge">NEW</span>' : "")
    + '<span class="time">' + esc(timeAgo(i.date, now)) + "</span></div>");
  o.push('<h3><a href="' + esc(i.url) + '" target="_blank" rel="noopener">' + esc(i.title) + "</a></h3>");
  if (i.summary) o.push("<p>" + esc(i.summary) + "</p>");
  o.push('<div class="foot">' + esc(readingTime(i)) + "</div>");
  o.push("</article>");
  return o.join("\n");
}

function headHtml(opts) {
  const rootPath = opts.root || "./";
  const canonical = SITE_URL + (opts.canonicalPath || "");
  return [
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "<title>" + esc(opts.title) + "</title>",
    '<meta name="description" content="' + esc(opts.description) + '" />',
    '<link rel="canonical" href="' + esc(canonical) + '" />',
    '<meta name="robots" content="index,follow,max-image-preview:large" />',
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="' + SITE_NAME + '" />',
    '<meta property="og:url" content="' + esc(canonical) + '" />',
    '<meta property="og:title" content="' + esc(opts.title) + '" />',
    '<meta property="og:description" content="' + esc(opts.description) + '" />',
    '<meta property="og:image" content="' + SITE_URL + 'icons/og.png" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:title" content="' + esc(opts.title) + '" />',
    '<meta name="twitter:description" content="' + esc(opts.description) + '" />',
    '<meta name="twitter:image" content="' + SITE_URL + 'icons/og.png" />',
    '<meta name="theme-color" content="#0a0c11" />',
    '<link rel="icon" href="' + rootPath + 'icons/icon-192.png" />',
    '<link rel="apple-touch-icon" href="' + rootPath + 'icons/apple-touch-icon.png" />',
    '<link rel="manifest" href="' + rootPath + 'manifest.webmanifest" />',
    '<link rel="alternate" type="application/rss+xml" title="' + SITE_NAME + '" href="' + rootPath + 'feed.xml" />',
    "<style>", STYLE, "</style>",
    NOFLASH,
    "</head>",
  ].join("\n");
}

function shellHtml(opts) {
  const rootPath = opts.root || "./";
  const lines = [];
  lines.push("<!doctype html>");
  lines.push('<html lang="en" data-theme="dark">');
  lines.push(headHtml(opts));
  lines.push("<body>");
  lines.push('<div class="bg-glow"></div>');
  lines.push('<div class="wrap">');
  lines.push('<div class="bar">');
  lines.push('<a class="brand" href="' + rootPath + '">AI Pulse<span class="dot">.</span></a>');
  lines.push("<nav>");
  lines.push('<a href="' + rootPath + 'archive/">Archive</a>');
  lines.push('<a href="' + rootPath + 'feed.xml">RSS</a>');
  lines.push('<button class="icon" id="theme" title="Switch theme" aria-label="Switch theme">&#9788;</button>');
  lines.push("</nav>");
  lines.push("</div>");
  return lines;
}
function shellEnd(rootPath) {
  const r = rootPath || "./";
  return [
    '<footer><div class="cols">',
    "<div><h4>AI Pulse</h4><p>" + SITE_TAGLINE + "</p><p>Ranked by source weight, AI relevance and announcement keywords. Static site, no tracking, no cookies.</p></div>",
    '<div><h4>Explore</h4><ul><li><a href="' + r + 'archive/">Archive</a></li><li><a href="' + r + '">Today</a></li><li><a href="' + r + 'feed.xml">RSS feed</a></li><li><a href="' + r + 'data.json">JSON API</a></li><li><a href="' + r + 'sitemap.xml">Sitemap</a></li></ul></div>',
    '<div><h4>Info</h4><ul><li><a href="' + r + 'about/">About</a></li><li><a href="' + r + 'sponsor/">Sponsor</a></li></ul></div>',
    "</div></footer>",
    "</div>",
    '<button class="toTop" id="toTop">Back to top</button>',
    "<script>", SCRIPT.replace(/root0/g, JSON.stringify(r)), "</" + "script>",
    "</body>",
    "</html>",
  ].join("\n");
}

function renderIndex(items, now, opts) {
  opts = opts || {};
  const rootPath = opts.root || "./";
  const focusCount = items.filter(function (i) { return i.isFocus; }).length;
  const sources = Array.from(new Set(items.map(function (i) { return i.source; }))).sort();
  const counts = {};
  for (const i of items) counts[i.topic] = (counts[i.topic] || 0) + 1;
  const stamp = new Date(now).toLocaleString("en-GB", { timeZone: "Asia/Saigon", hour12: false });
  const lines = shellHtml({
    root: rootPath,
    title: opts.title || (SITE_NAME + " - AI news for builders"),
    description: SITE_TAGLINE + " Updated daily.",
    canonicalPath: opts.canonicalPath || "",
  });
  lines.push('<section class="hero">');
  lines.push("<h1>AI Pulse<span class=\"dot\">.</span></h1>");
  lines.push('<p class="tagline">' + esc(SITE_TAGLINE) + ' Ranked by importance, refreshed every day.</p>');
  lines.push('<div class="stats">');
  lines.push('<span class="pill"><b>' + items.length + "</b> stories</span>");
  lines.push('<span class="pill"><b>' + sources.length + "</b> sources</span>");
  lines.push('<span class="pill"><b>' + Math.round((focusCount / Math.max(1, items.length)) * 100) + "%</b> in the four focus areas</span>");
  lines.push('<span class="pill">Updated ' + esc(stamp) + " (UTC+7)</span>");
  lines.push("</div>");
  lines.push("</section>");
  lines.push('<div class="controls">');
  lines.push('<input id="q" type="search" placeholder="Search headlines, sources, topics..." autocomplete="off" />');
  lines.push('<div class="chips" id="topicChips">');
  lines.push('<button class="chip active" data-filter="topic" data-value="all">All topics (' + items.length + ")</button>");
  for (const t of TOPICS) {
    if (!counts[t]) continue;
    lines.push('<button class="chip' + (FOCUS.indexOf(t) >= 0 ? " focus" : "") + '" data-filter="topic" data-value="' + esc(t) + '">' + esc(t) + " (" + counts[t] + ")</button>");
  }
  lines.push("</div>");
  lines.push('<div class="chips" id="srcChips">');
  lines.push('<button class="chip active" data-filter="source" data-value="all">All sources</button>');
  for (const s of sources) lines.push('<button class="chip" data-filter="source" data-value="' + esc(s) + '">' + esc(s) + "</button>");
  lines.push("</div>");
  lines.push("</div>");
  lines.push("<main>");
  if (ADS_ENABLED) lines.push('<div class="ad-slot">Sponsor slot - 970x90</div>');
  lines.push('<div class="grid">');
  items.forEach(function (i, rank) { lines.push(cardHtml(i, rank, now, rank === 0)); });
  lines.push("</div>");
  lines.push('<p class="empty" id="empty" style="display:none">No stories match that filter.</p>');
  if (ADS_ENABLED) lines.push('<div class="ad-slot">Sponsor slot - 970x250</div>');
  lines.push("</main>");
  lines.push(shellEnd(rootPath));
  return lines.join("\n") + "\n";
}

function renderArchiveIndex(days, now) {
  const lines = shellHtml({
    root: "./",
    title: "Archive - " + SITE_NAME,
    description: "Every daily edition of AI Pulse.",
    canonicalPath: "archive/",
  });
  lines.push('<section class="hero"><h1>Archive<span class="dot">.</span></h1>');
  lines.push('<p class="tagline">Every daily edition, newest first.</p></section>');
  lines.push("<main><div class=\"grid\">");
  for (const d of days) {
    lines.push('<article class="card"><div class="meta"><span class="src">' + esc(d.date) + '</span><span class="time">' + d.count + " stories</span></div>");
    lines.push('<h3><a href="./' + esc(d.date) + '.html">' + esc(d.date) + " edition</a></h3>");
    lines.push("<ul>");
    for (const t of d.top) lines.push("<li>" + esc(t) + "</li>");
    lines.push("</ul></article>");
  }
  lines.push("</div></main>");
  lines.push(shellEnd("./"));
  return lines.join("\n") + "\n";
}

function renderRss(items, now) {
  const head = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n'
    + "  <title>" + SITE_NAME + "</title>\n  <link>" + SITE_URL + "</link>\n"
    + "  <atom:link href=\"" + SITE_URL + "feed.xml\" rel=\"self\" type=\"application/rss+xml\" />\n"
    + "  <description>" + esc(SITE_TAGLINE) + "</description>\n"
    + "  <lastBuildDate>" + new Date(now).toUTCString() + "</lastBuildDate>\n";
  const body = items.slice(0, 80).map(function (i) {
    return "  <item>\n    <title>" + esc(i.title) + "</title>\n    <link>" + esc(i.url) + "</link>\n"
      + '    <guid isPermaLink="true">' + esc(i.url) + "</guid>\n"
      + (i.date ? "    <pubDate>" + new Date(i.date).toUTCString() + "</pubDate>\n" : "")
      + "    <category>" + esc(i.topic) + "</category>\n"
      + "    <description>" + esc(i.summary) + "</description>\n  </item>";
  }).join("\n");
  return head + body + "\n</channel>\n</rss>\n";
}

const MANIFEST = JSON.stringify({
  name: SITE_NAME, short_name: "AI Pulse",
  description: SITE_TAGLINE, start_url: "./", scope: "./", display: "standalone",
  background_color: "#0a0c11", theme_color: "#0a0c11",
  icons: [
    { src: "./icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "./icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "./icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2) + "\n";

const SW = [
  "var CACHE='aipulse-v1';",
  "self.addEventListener('install',function(e){self.skipWaiting();});",
  "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});",
  "self.addEventListener('fetch',function(e){",
  "if(e.request.method!=='GET')return;var u=new URL(e.request.url);",
  "if(u.origin!==location.origin)return;",
  "if(/\\.(html|json|xml|webmanifest)$/.test(u.pathname)||u.pathname.endsWith('/')){",
  "e.respondWith(fetch(e.request).then(function(r){var c=r.clone();caches.open(CACHE).then(function(cc){cc.put(e.request,c);});return r;}).catch(function(){return caches.match(e.request);}));",
  "}});",
].join("\n") + "\n";

function renderPage(opts) {
  const rootPath = opts.root || "./";
  const lines = shellHtml({
    root: rootPath,
    title: opts.title,
    description: opts.description,
    canonicalPath: opts.canonicalPath,
  });
  lines.push('<section class="hero"><h1>' + esc(opts.heading) + "</h1>");
  if (opts.lede) lines.push('<p class="tagline">' + esc(opts.lede) + "</p>");
  lines.push("</section>");
  lines.push('<main><div class="grid"><article class="card">');
  for (const para of opts.paragraphs) lines.push("<p>" + esc(para) + "</p>");
  lines.push("</article></div></main>");
  lines.push(shellEnd(rootPath));
  return lines.join("\n") + "\n";
}

const ABOUT = renderPage({
  root: "../",
  title: "About - " + SITE_NAME,
  description: "What AI Pulse is and how stories are ranked.",
  canonicalPath: "about/",
  heading: "About AI Pulse",
  lede: "Important AI news for people who build with AI.",
  paragraphs: [
    "AI Pulse collects important AI news for people who build with AI, with a bias toward game development, web development, app development and the AI business.",
    "Every story is scored by source weight, AI relevance and announcement keywords (launch, raises, acquires, open-sources), and the four focus areas are kept in the majority of the list.",
    "The site is a static page rebuilt automatically every day from about 48 public feeds. No tracking, no cookies, no accounts.",
    "Stories link straight to their original publishers. Headlines and short excerpts are shown for orientation only.",
  ],
});

const SPONSOR = renderPage({
  root: "../",
  title: "Sponsor - " + SITE_NAME,
  description: "Reach developers who ship with AI.",
  canonicalPath: "sponsor/",
  heading: "Sponsor AI Pulse",
  lede: "Reach developers who ship with AI.",
  paragraphs: [
    "AI Pulse reaches developers who build with AI - game, web and app developers, and the people building AI businesses.",
    "Placements: top banner, in-feed card, or a sponsored story clearly labelled as sponsored.",
    "Get in touch: open an issue on the AI Pulse GitHub repository, or reply to any edition.",
  ],
});

async function main() {
  const now = Date.now();
  console.log("Fetching " + FEEDS.length + " feeds...");
  const raw = (await Promise.all(FEEDS.map(fetchFeed))).flat();
  console.log("Raw items: " + raw.length);

  const seen = new Set();
  const items = [];
  let dropped = 0;
  for (const it of raw) {
    const key = it.url.replace(/[#?].*$/, "") || it.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!it.date) continue;
    if (new Date(it.date).getTime() < now - DAYS_WINDOW * 86400000) continue;
    const c = classify(it);
    if (!c) { dropped++; continue; }
    items.push(Object.assign({}, it, { topic: c.topic, importance: c.importance, isFocus: c.isFocus }));
  }
  console.log("Kept: " + items.length + "  (filtered out " + dropped + " off-topic)");

  items.sort(function (a, b) {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  const perSource = {};
  let kept = items.filter(function (i) {
    perSource[i.source] = (perSource[i.source] || 0) + 1;
    return perSource[i.source] <= PER_SOURCE_CAP;
  });
  const focusItems = kept.filter(function (i) { return i.isFocus; });
  const otherItems = kept.filter(function (i) { return !i.isFocus; })
    .slice(0, Math.max(40, Math.round(focusItems.length * 0.66)));
  kept = focusItems.concat(otherItems).slice(0, MAX_ITEMS);
  kept.sort(function (a, b) {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  await mkdir(OUT, { recursive: true });
  await mkdir(join(OUT, "icons"), { recursive: true });
  await mkdir(join(OUT, "archive"), { recursive: true });
  await mkdir(join(OUT, "about"), { recursive: true });
  await mkdir(join(OUT, "sponsor"), { recursive: true });

  for (const f of ["icon-192.png", "icon-512.png", "apple-touch-icon.png", "og.png"]) {
    try { await copyFile(join(ASSETS, "icons", f), join(OUT, "icons", f)); }
    catch (e) { console.error("icon copy failed: " + f); }
  }

  await writeFile(join(OUT, "index.html"), renderIndex(kept, now, { root: "./" }));
  await writeFile(join(OUT, "feed.xml"), renderRss(kept, now));
  await writeFile(join(OUT, "data.json"), JSON.stringify({
    generatedAt: new Date(now).toISOString(),
    count: kept.length,
    focusCount: focusItems.length,
    topics: TOPICS,
    items: kept,
  }, null, 2));
  await writeFile(join(OUT, "manifest.webmanifest"), MANIFEST);
  await writeFile(join(OUT, "sw.js"), SW);
  await writeFile(join(OUT, "about", "index.html"), ABOUT);
  await writeFile(join(OUT, "sponsor", "index.html"), SPONSOR);
  await writeFile(join(OUT, ".nojekyll"), "");
  await writeFile(join(OUT, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: " + SITE_URL + "sitemap.xml\n");

  const day = new Date(now).toISOString().slice(0, 10);
  await writeFile(join(OUT, "archive", day + ".json"), JSON.stringify({ date: day, items: kept }));

  let files = [];
  try { files = await readdir(join(OUT, "archive")); } catch (e) { files = []; }
  const dates = files.filter(function (f) { return /^\d{4}-\d{2}-\d{2}\.json$/.test(f); })
    .map(function (f) { return f.replace(".json", ""); }).sort().reverse();

  const days = [];
  for (const d of dates) {
    try {
      const data = JSON.parse(await readFile(join(OUT, "archive", d + ".json"), "utf8"));
      days.push({ date: d, count: data.items.length, top: data.items.slice(0, 3).map(function (i) { return i.title; }) });
      if (days.length <= ARCHIVE_RENDER_DAYS) {
        await writeFile(join(OUT, "archive", d + ".html"), renderIndex(data.items, new Date(d + "T20:00:00Z").getTime(), {
          root: "../",
          title: SITE_NAME + " - " + d + " edition",
          canonicalPath: "archive/" + d + ".html",
        }));
      }
    } catch (e) { /* skip unreadable archive */ }
  }
  await writeFile(join(OUT, "archive", "index.html"), renderArchiveIndex(days, now));

  const urls = ["", "archive/"].concat(days.slice(0, ARCHIVE_RENDER_DAYS).map(function (d) { return "archive/" + d.date + ".html"; }));
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(function (u) { return "  <url><loc>" + SITE_URL + u + "</loc></url>"; }).join("\n")
    + "\n</urlset>\n";
  await writeFile(join(OUT, "sitemap.xml"), sitemap);

  console.log("Wrote " + kept.length + " items (" + focusItems.length + " focus) and " + days.length + " archive days.");
  if (kept.length === 0) { console.error("WARNING: zero items collected."); process.exitCode = 1; }
}
main();
