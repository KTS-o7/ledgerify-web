#!/usr/bin/env node
// Enforces the Luxe colour rules in src/:
//   1. No legacy token names (primary, primary-press, accent, surface-hover) in
//      utility classes or var(--color-*) references. Use signal, btn, neg, raised.
//   2. No raw Tailwind palette colours (yellow-400, zinc-800, …).
//   3. No arbitrary hex colours in classes (bg-[#123456]).
// Inline styles that carry user data (category colours) are allowed.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = ["src"];
const EXTS = new Set([".ts", ".tsx", ".html"]);
const UTIL = "(?:text|bg|border|ring|ring-offset|outline|fill|stroke|from|via|to|divide|placeholder|decoration|caret|shadow)";
const RULES = [
  { name: "legacy token", re: new RegExp(`\\b${UTIL}-(?:primary-press|primary|accent|surface-hover)\\b`, "g") },
  { name: "legacy token var", re: /var\(--color-(?:primary-press|primary|accent|surface-hover)\)/g },
  {
    name: "raw palette colour",
    re: new RegExp(`\\b${UTIL}-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}\\b`, "g"),
  },
  { name: "hex colour in class", re: new RegExp(`\\b${UTIL}-\\[#[0-9a-fA-F]{3,8}\\]`, "g") },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.has(extname(p))) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(join(process.cwd(), r))).filter((f) => !f.includes("__tests__"));
let violations = 0;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  text.split("\n").forEach((line, i) => {
    for (const rule of RULES) {
      const hits = line.match(rule.re);
      if (!hits) continue;
      console.error(`${f}:${i + 1}: ${rule.name}: ${[...new Set(hits)].join(", ")}`);
      violations++;
    }
  });
}
console.error(`lint:colors — ${files.length} files, ${violations} violation(s).`);
if (violations > 0) process.exit(1);
