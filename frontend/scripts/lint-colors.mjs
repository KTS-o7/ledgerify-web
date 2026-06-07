#!/usr/bin/env node
// Enforces: text-primary must not be paired with a light/ambiguous background.
// A line containing text-primary is OK when:
//   - it has no bg-* class at all (the parent element provides the dark surface), OR
//   - every bg-* class on the line is in ALLOWED_BG.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ALLOWED_BG = [
  "bg-bg",
  "bg-surface",
  "bg-surface-hover",
  "bg-text",
  "bg-primary",
  "bg-accent",
];
const ROOTS = ["src"];
const EXTS = new Set([".ts", ".tsx", ".html"]);
const BG_REGEX = /\bbg-[a-z0-9-]+(?:\/\d+)?\b/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.has(extname(p))) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(join(process.cwd(), r)));
let violations = 0;
let usageCount = 0;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  text.split("\n").forEach((line, i) => {
    if (!/text-primary/.test(line)) return;
    usageCount++;
    const bgMatches = line.match(BG_REGEX) ?? [];
    if (bgMatches.length === 0) return;
    const bad = bgMatches.filter((bg) => {
      const base = bg.split("/")[0];
      return !ALLOWED_BG.includes(base);
    });
    if (bad.length > 0) {
      console.error(
        `${f}:${i + 1}: text-primary paired with disallowed background(s): ${bad.join(", ")}`
      );
      console.error(`  ${line.trim()}`);
      violations++;
    }
  });
}
console.error(
  `lint:colors — ${files.length} files, ${usageCount} text-primary usages, ${violations} violation(s).`
);
if (violations > 0) process.exit(1);
