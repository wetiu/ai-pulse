#!/usr/bin/env node
/**
 * AI Pulse digest - picks the most important recent stories and formats them
 * for a chat message (Telegram-friendly plain text).
 *
 * Usage:
 *   node notify.mjs                  # last 24h, top 5
 *   node notify.mjs --hours 48 --limit 8
 *   node notify.mjs --topic "Game Dev"
 *   node notify.mjs --json           # machine-readable
 *
 * Zero dependencies.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const HOURS = Number(arg("hours", 24));
const LIMIT = Number(arg("limit", 5));
const TOPIC = arg("topic", "");
const AS_JSON = process.argv.indexOf("--json") >= 0;
const SITE = "https://wetiu.github.io/ai-pulse/";

// Order matters: this is the priority order for a builder digest.
const FOCUS = ["Game Dev", "Web Dev", "App Dev", "AI Business"];

function digest(items, now) {
  const cutoff = now - HOURS * 3600000;
  let pool = items.filter(function (i) { return i.date && new Date(i.date).getTime() >= cutoff; });
  if (TOPIC) pool = pool.filter(function (i) { return i.topic === TOPIC; });
  else pool = pool.filter(function (i) { return FOCUS.indexOf(i.topic) >= 0; });
  pool.sort(function (a, b) {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  if (TOPIC) return pool.slice(0, LIMIT);

  // Round-robin across the focus areas so one busy topic cannot swamp the
  // digest - each round takes the best remaining story from each area.
  const queues = FOCUS.map(function (t) {
    return pool.filter(function (i) { return i.topic === t; });
  });
  const out = [];
  for (let round = 0; out.length < LIMIT; round++) {
    let took = false;
    for (const q of queues) {
      if (out.length >= LIMIT) break;
      if (q[round]) { out.push(q[round]); took = true; }
    }
    if (!took) break;
  }
  return out;
}

function line(i, n) {
  return (n + 1) + ". [" + i.topic + "] " + i.title + "\n   " + i.url;
}

async function main() {
  const data = JSON.parse(await readFile(join(__dirname, "public", "data.json"), "utf8"));
  const now = Date.now();
  const picked = digest(data.items, now);

  if (AS_JSON) {
    console.log(JSON.stringify({ generatedAt: new Date(now).toISOString(), hours: HOURS, count: picked.length, items: picked }, null, 2));
    return;
  }
  if (picked.length === 0) {
    console.log("AI Pulse: no new focus stories in the last " + HOURS + "h. Site: " + SITE);
    return;
  }
  const out = [];
  out.push("AI Pulse - " + picked.length + " important AI stories");
  out.push("");
  picked.forEach(function (i, n) { out.push(line(i, n)); });
  out.push("");
  out.push("Everything else: " + SITE);
  console.log(out.join("\n"));
}
main();
