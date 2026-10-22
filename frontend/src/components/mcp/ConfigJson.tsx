import { For, type Component } from "solid-js";

type Tok = { text: string; cls: string };

const TOKEN_RE = /("(?:[^"\\]|\\.)*")(\s*:)?|([{}[\],])|(\s+)|([^\s"{}[\],:]+)/g;

/** Split one line of pretty-printed JSON into coloured tokens. */
export function tokenizeJsonLine(line: string): Tok[] {
  const out: Tok[] = [];
  for (const m of line.matchAll(TOKEN_RE)) {
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        out.push({ text: m[1], cls: "text-signal" });
        out.push({ text: m[2], cls: "text-muted" });
      } else out.push({ text: m[1], cls: "text-pos" });
    } else if (m[3] !== undefined) out.push({ text: m[3], cls: "text-muted" });
    else if (m[4] !== undefined) out.push({ text: m[4], cls: "" });
    else if (m[5] !== undefined) out.push({ text: m[5], cls: "text-text" });
  }
  return out;
}

/** Syntax-coloured JSON: keys in signal, strings in pos, punctuation muted. */
export const ConfigJson: Component<{ json: string; class?: string; label?: string }> = (props) => (
  <pre
    class={`font-mono text-[12.5px] leading-[1.6] whitespace-pre overflow-x-auto ${props.class ?? ""}`}
    aria-label={props.label ?? "Client configuration"}
    tabindex="0"
  >
    <code>
      <For each={props.json.split("\n")}>
        {(line) => (
          <div>
            <For each={tokenizeJsonLine(line)}>{(t) => <span class={t.cls}>{t.text}</span>}</For>
          </div>
        )}
      </For>
    </code>
  </pre>
);
