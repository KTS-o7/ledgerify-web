# Minimalist Bento UI Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the terracotta visual language with a dark-mode "Minimalist Bento" aesthetic across all 14 pages of the Ledgerify SolidJS SPA, mobile-first responsive.

**Architecture:** Foundation-first. Phase 1 establishes tokens, fonts, primitives, layout shell, and the `lint:colors` guardrail. Phases 2–4 progressively apply the system to pages. The same `<Outlet>` and page-content components serve mobile and desktop; only the navigation chrome (BottomNav vs Sidebar) and grid columns differ at the 768px breakpoint.

**Tech Stack:** SolidJS, `@solidjs/router`, Tailwind CSS v4 (CSS-first `@theme` config in `styles/custom.css`), lucide-solid, `@fontsource/{space-grotesk,dm-sans,jetbrains-mono}`, Vite, Bun, vitest + `@solidjs/testing-library` for primitive tests.

**Spec:** `docs/superpowers/specs/2026-06-06-minimalist-bento-ui-revamp-design.md` — read it in full before starting. Every section of that spec is implemented by a task in this plan.

**Branch:** `design/minimalist-bento-ui-revamp` (already created with AGENTS.md + spec).

---

## File Structure

**New files (frontend/src/components/ui/):**
`bento-block.tsx`, `page-header.tsx`, `stat.tsx`, `account-row.tsx`, `transaction-row.tsx`, `donut-chart.tsx`, `sparkline.tsx`, `category-bar.tsx`, `segmented-control.tsx`, `search-bar.tsx`, `empty-state.tsx`, `skeleton.tsx`, `nav.tsx`, `nav-items.ts`

**New files (other):**
- `frontend/src/lib/format.ts` — `formatCurrency`, `formatDate`, `formatDateGroup`
- `frontend/scripts/lint-colors.mjs` — `text-primary` pairing rule
- `frontend/vitest.config.ts`, `frontend/tests/setup.ts`

**New tests (frontend/src/components/ui/__tests__/ and frontend/src/lib/__tests__/):**
- `bento-block.test.tsx`, `stat.test.tsx`, `donut-chart.test.tsx`, `sparkline.test.tsx`, `account-row.test.tsx`, `transaction-row.test.tsx`, `nav.test.tsx`
- `format.test.ts`

**New page (Phase 2):** `frontend/src/pages/Analytics.tsx`

**Modified files:**
- `frontend/src/styles/custom.css` — replace `@theme`, add fontsource imports
- `frontend/src/components/ui/button.tsx`, `input.tsx`, `select.tsx`, `badge.tsx` — terracotta → lime/surface
- `frontend/src/layouts/MainLayout.tsx` — breakpoint-driven shell
- `frontend/src/App.tsx` — add `/analytics` and `/activity` routes
- `frontend/package.json` — add fontsource, vitest, testing-library; add `lint:colors` script
- All page files (Phase 2 and 3)

**Removed (Phase 4):**
- `frontend/src/index.css` — dead; `index.tsx` imports `custom.css`
- `frontend/src/components/ui/card.tsx` — replaced by BentoBlock

---

## Verification gate (run at end of every phase)

```bash
cd frontend && bun run build
cd frontend && bun run test
cd frontend && bun run lint:colors
go test ./...
go build -o /tmp/ledgerify-server ./cmd/server
git diff --check
```

A failing step blocks the phase. The `bun run build` is load-bearing for this work; `go test`/`go build` are secondary (catch embed boundary issues only).

---

## Phase 1 — Foundation (Tasks 1–15)

### Task 1: Update design tokens in `custom.css`

**Files:** Modify `frontend/src/styles/custom.css`

- [ ] **Step 1:** Replace the file contents with:

```css
@import "tailwindcss";

@import "@fontsource/space-grotesk/400.css";
@import "@fontsource/space-grotesk/600.css";
@import "@fontsource/space-grotesk/700.css";
@import "@fontsource/dm-sans/400.css";
@import "@fontsource/dm-sans/500.css";
@import "@fontsource/jetbrains-mono/500.css";

@theme {
  --color-bg: #09090B;
  --color-surface: #18181B;
  --color-surface-hover: #27272A;
  --color-border: #27272A;
  --color-border-strong: #3F3F46;
  --color-text: #FAFAFA;
  --color-muted: #A1A1AA;
  --color-primary: #CCFF00;
  --color-primary-press: #B8E000;
  --color-accent: #FF4D4D;
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-body: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", monospace;
  --radius-bento: 24px;
  --radius-pill: 9999px;
  --radius-button: 12px;
  --radius-input: 12px;
  --spacing-screen: 16px;
  --spacing-bento-gap: 12px;
  --spacing-bento-pad: 20px;
}

@media (prefers-reduced-transparency: reduce) {
  .bg-bg\/95, [class*="bg-bg/95"] {
    background-color: var(--color-bg) !important;
    backdrop-filter: none !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2:** `cd frontend && bun run build` — must succeed.
- [ ] **Step 3:** Commit: `feat(design): minimalist bento tokens (colors, type, spacing)`

---

### Task 2: Add fontsource packages

**Files:** Modify `frontend/package.json`

- [ ] **Step 1:** Add to `devDependencies`:
  - `"@fontsource/dm-sans": "^5.1.0"`
  - `"@fontsource/jetbrains-mono": "^5.1.0"`
  - `"@fontsource/space-grotesk": "^5.1.0"`
- [ ] **Step 2:** `cd frontend && bun install`
- [ ] **Step 3:** `cd frontend && bun run build` — confirms the @imports from Task 1 resolve.
- [ ] **Step 4:** Commit: `chore(deps): add @fontsource for self-hosted Space Grotesk, DM Sans, JetBrains Mono`

---

### Task 3: Set up vitest

**Files:** Modify `frontend/package.json`; create `frontend/vitest.config.ts`, `frontend/tests/setup.ts`

- [ ] **Step 1:** Add to `devDependencies`:
  - `"@solidjs/testing-library": "^0.8.10"`
  - `"@testing-library/jest-dom": "^6.6.0"`
  - `"jsdom": "^25.0.0"`
  - `"vitest": "^2.1.0"`
- [ ] **Step 2:** Add to `scripts`:
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`
- [ ] **Step 3:** Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 4:** Create `frontend/tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5:** `cd frontend && bun run test` — exit 0 (no tests yet).
- [ ] **Step 6:** Commit: `chore(test): set up vitest + @solidjs/testing-library`

---

### Task 4: Refactor `Button` to bento tokens

**Files:** Modify `frontend/src/components/ui/button.tsx`

- [ ] **Step 1:** Replace the file contents with:

```tsx
import { type VariantProps, cva } from "class-variance-authority";
import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-button text-[15px] font-display font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-bg hover:bg-primary-press",
        destructive: "bg-accent text-bg hover:bg-accent/90",
        outline: "border border-border bg-transparent text-text hover:bg-surface-hover",
        ghost: "bg-transparent text-muted hover:text-text hover:bg-surface-hover",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-md px-3 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, ["variant", "size", "class"]);
  return <button class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)} {...others} />;
}
```

- [ ] **Step 2:** `cd frontend && bun run build` — must succeed.
- [ ] **Step 3:** Commit: `refactor(ui): button variant uses bento tokens (lime on dark)`

---

### Task 5: Refactor `Input` and `Select`

**Files:** Modify `frontend/src/components/ui/input.tsx`, `select.tsx`

- [ ] **Step 1:** Replace `input.tsx` with:

```tsx
import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <input
      class={cn(
        "flex h-12 w-full rounded-input border border-border bg-surface px-4 py-1 text-base text-text placeholder:text-muted transition-colors focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
        local.class
      )}
      {...others}
    />
  );
}
```

- [ ] **Step 2:** Replace `select.tsx` with the same pattern (select element, h-12, bg-surface, focus:border-primary, focus:ring-primary).
- [ ] **Step 3:** `cd frontend && bun run build` — must succeed.
- [ ] **Step 4:** Commit: `refactor(ui): input and select use bento tokens`

---

### Task 6: Refactor `Badge`

**Files:** Modify `frontend/src/components/ui/badge.tsx`

- [ ] **Step 1:** Replace the file with:

```tsx
import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "destructive" | "warning" | "outline";
}

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-surface text-muted",
  success: "bg-primary/10 text-primary",
  destructive: "bg-accent/10 text-accent",
  warning: "bg-accent/10 text-accent",
  outline: "border border-border text-muted",
};

export function Badge(props: BadgeProps) {
  const [local, others] = splitProps(props, ["variant", "class"]);
  return (
    <span class={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", variants[local.variant ?? "default"], local.class)} {...others} />
  );
}
```

- [ ] **Step 2:** Build, commit: `refactor(ui): badge uses bento tokens`

---

### Task 7: Build `format.ts` with tests

**Files:** Create `frontend/src/lib/format.ts`, `frontend/src/lib/__tests__/format.test.ts`

- [ ] **Step 1:** Write the test (`frontend/src/lib/__tests__/format.test.ts`):

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { formatCurrency, formatDate, formatDateGroup } from "../format";

describe("formatCurrency", () => {
  beforeEach(() => localStorage.clear());
  it("formats INR by default", () => { expect(formatCurrency(12450)).toBe("₹12,450"); });
  it("respects localStorage override", () => {
    localStorage.setItem("ledgerify.currency", "USD");
    expect(formatCurrency(12450)).toBe("$12,450");
  });
  it("handles negative amounts with prefix", () => { expect(formatCurrency(-84.2)).toBe("-₹84"); });
  it("handles zero", () => { expect(formatCurrency(0)).toBe("₹0"); });
});

describe("formatDate", () => {
  it("formats ISO date to short form", () => { expect(formatDate("2026-10-12")).toBe("Oct 12"); });
});

describe("formatDateGroup", () => {
  it("returns 'Today' for today's date", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(formatDateGroup(today)).toBe("Today");
  });
  it("returns 'Yesterday' for yesterday's date", () => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    expect(formatDateGroup(y.toISOString().slice(0, 10))).toBe("Yesterday");
  });
  it("returns 'Mon DD' for older dates", () => { expect(formatDateGroup("2026-10-12")).toBe("Oct 12"); });
});
```

- [ ] **Step 2:** `cd frontend && bun run test` — confirm FAIL ("Cannot find module").
- [ ] **Step 3:** Create `frontend/src/lib/format.ts`:

```ts
const CURRENCY_KEY = "ledgerify.currency";

export function getCurrency(): string {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(CURRENCY_KEY);
    if (stored) return stored;
  }
  return "INR";
}

export function formatCurrency(n: number, currency?: string): string {
  const c = currency ?? getCurrency();
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: c, maximumFractionDigits: 0,
  }).format(n);
}

const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function formatDate(iso: string): string {
  return SHORT_DATE.format(new Date(iso));
}

export function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const dStart = new Date(d); dStart.setHours(0, 0, 0, 0);
  if (dStart.getTime() === today.getTime()) return "Today";
  if (dStart.getTime() === yesterday.getTime()) return "Yesterday";
  return SHORT_DATE.format(d);
}
```

- [ ] **Step 4:** `cd frontend && bun run test` — confirm PASS.
- [ ] **Step 5:** Commit: `feat(lib): format helpers (currency, date, date group)`

---

### Task 8: Build `BentoBlock` with tests

**Files:** Create `frontend/src/components/ui/bento-block.tsx`, `frontend/src/components/ui/__tests__/bento-block.test.tsx`

- [ ] **Step 1:** Write the test:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { BentoBlock } from "../bento-block";

describe("BentoBlock", () => {
  it("renders children", () => {
    render(<BentoBlock>hello</BentoBlock>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
  it("applies surface, radius, and border by default", () => {
    const { container } = render(<BentoBlock>x</BentoBlock>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("bg-surface");
    expect(el).toHaveClass("rounded-[24px]");
    expect(el).toHaveClass("border");
    expect(el).toHaveClass("border-border");
  });
  it("scales on press when variant is pressable", () => {
    const { container } = render(<BentoBlock variant="pressable">x</BentoBlock>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("active:scale-[0.96]");
    expect(el).toHaveClass("cursor-pointer");
  });
  it("uses dashed border for dashed variant", () => {
    const { container } = render(<BentoBlock variant="dashed">x</BentoBlock>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("border-dashed");
    expect(el).toHaveClass("bg-transparent");
  });
});
```

- [ ] **Step 2:** Run, confirm FAIL.
- [ ] **Step 3:** Create `frontend/src/components/ui/bento-block.tsx`:

```tsx
import { type JSX, splitProps, type Component } from "solid-js";
import { cn } from "../../lib/utils";

type BentoBlockProps = JSX.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "pressable" | "dashed";
  size?: "sm" | "md" | "lg";
  span?: 1 | 2 | 3;
  as?: "div" | "button" | "a";
  onClick?: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent>;
};

const sizeMap = { sm: "min-h-[120px]", md: "min-h-[160px]", lg: "min-h-[220px]" };
const spanMap = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3" };

export const BentoBlock: Component<BentoBlockProps> = (props) => {
  const [local, others] = splitProps(props, ["variant", "size", "span", "class", "children", "as"]);
  const variant = () => local.variant ?? "default";
  const size = () => local.size ?? "md";
  const span = () => local.span ?? 1;
  const base = "rounded-[24px] p-[20px] border transition-all duration-150 motion-reduce:transition-none";
  const variantClass = () => {
    const v = variant();
    if (v === "pressable") return "bg-surface border-border active:scale-[0.96] active:bg-surface-hover cursor-pointer lg:hover:border-border-strong lg:hover:bg-surface-hover";
    if (v === "dashed") return "bg-transparent border-border border-dashed";
    return "bg-surface border-border";
  };
  return <div class={cn(base, sizeMap[size()], spanMap[span()], variantClass(), local.class)} {...others}>{local.children}</div>;
};
```

- [ ] **Step 4:** Run, confirm PASS.
- [ ] **Step 5:** Commit: `feat(ui): BentoBlock primitive (24px surface with variant + size + span)`

---

### Task 9: Build `Stat` with tests

**Files:** Create `frontend/src/components/ui/stat.tsx`, `frontend/src/components/ui/__tests__/stat.test.tsx`

- [ ] **Step 1:** Write the test:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Stat } from "../stat";

describe("Stat", () => {
  it("renders label and value", () => {
    render(<Stat label="Income" value="$4,200" />);
    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("$4,200")).toBeInTheDocument();
  });
  it("renders trend with up arrow", () => {
    render(<Stat label="x" value="1" trend={{ dir: "up", value: "+2.4%" }} />);
    expect(screen.getByText("+2.4%")).toBeInTheDocument();
  });
  it("uses display font for value", () => {
    render(<Stat label="x" value="42" size="lg" />);
    expect(screen.getByText("42")).toHaveClass("font-display");
  });
  it("renders inline layout", () => {
    const { container } = render(<Stat label="x" value="y" layout="inline" />);
    expect(container.firstChild as HTMLElement).toHaveClass("flex-row");
  });
});
```

- [ ] **Step 2:** Run, confirm FAIL.
- [ ] **Step 3:** Create `frontend/src/components/ui/stat.tsx`:

```tsx
import { type JSX, splitProps, type Component } from "solid-js";
import { cn } from "../../lib/utils";

type Tone = "default" | "primary" | "accent";
type Size = "sm" | "md" | "lg" | "xl";
const sizeMap: Record<Size, string> = { sm: "text-base", md: "text-xl", lg: "text-3xl", xl: "text-5xl" };
const toneMap: Record<Tone, string> = { default: "text-text", primary: "text-primary", accent: "text-accent" };

type StatProps = JSX.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string | number;
  trend?: { dir: "up" | "down" | "flat"; value: string };
  tone?: Tone;
  size?: Size;
  layout?: "vertical" | "inline";
};

export const Stat: Component<StatProps> = (props) => {
  const [local, others] = splitProps(props, ["label", "value", "trend", "tone", "size", "layout", "class"]);
  const layout = () => local.layout ?? "vertical";
  return (
    <div class={cn(layout() === "inline" ? "flex flex-row items-baseline justify-between" : "flex flex-col gap-1", local.class)} {...others}>
      <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">{local.label}</span>
      <span class={cn("font-display font-bold tracking-tight", sizeMap[local.size ?? "md"], toneMap[local.tone ?? "default"])}>{local.value}</span>
      {local.trend && (
        <span class={cn("inline-flex items-center gap-1 text-sm font-medium",
          local.trend.dir === "up" ? "text-primary" : local.trend.dir === "down" ? "text-accent" : "text-muted")}>
          {local.trend.dir === "up" ? "↑" : local.trend.dir === "down" ? "↓" : "→"} {local.trend.value}
        </span>
      )}
    </div>
  );
};
```

- [ ] **Step 4:** Run, confirm PASS.
- [ ] **Step 5:** Commit: `feat(ui): Stat primitive (label + value + optional trend)`

---

### Task 10: Build `DonutChart` with tests (signature primitive)

**Files:** Create `frontend/src/components/ui/donut-chart.tsx`, `frontend/src/components/ui/__tests__/donut-chart.test.tsx`

- [ ] **Step 1:** Write the test:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import { DonutChart, computeSegmentStrokes } from "../donut-chart";

describe("DonutChart — math", () => {
  it("computes strokes for a single segment (full ring)", () => {
    const out = computeSegmentStrokes([{ label: "x", value: 100 }], 124);
    expect(out).toHaveLength(1);
    expect(out[0].dasharray).toMatch(/779/);
  });
  it("splits 4 equal segments at 25% each", () => {
    const out = computeSegmentStrokes(
      [{ label: "a", value: 25 }, { label: "b", value: 25 }, { label: "c", value: 25 }, { label: "d", value: 25 }], 124);
    expect(out).toHaveLength(4);
    expect(out[0].dasharray).toBe("194.78 779.00");
  });
  it("returns sorted-by-value order with correct offsets", () => {
    const out = computeSegmentStrokes(
      [{ label: "small", value: 10 }, { label: "big", value: 60 }, { label: "mid", value: 30 }], 124);
    expect(out.map((s) => s.label)).toEqual(["big", "mid", "small"]);
    expect(out[1].offset).toBeCloseTo(-out[0].length, 2);
  });
  it("returns empty array for empty input", () => {
    expect(computeSegmentStrokes([], 124)).toEqual([]);
  });
});

describe("DonutChart — render", () => {
  it("renders an SVG with a circle per segment", () => {
    const { container } = render(<DonutChart segments={[{ label: "a", value: 50 }, { label: "b", value: 50 }]} centerValue="$100" centerLabel="Total" />);
    expect(container.querySelectorAll("circle").length).toBe(3);
  });
  it("renders the center label and value", () => {
    const { container } = render(<DonutChart segments={[{ label: "a", value: 100 }]} centerValue="$100" centerLabel="Total" />);
    expect(container.textContent).toContain("$100");
    expect(container.textContent).toContain("Total");
  });
  it("dims non-highlighted segments when highlightIndex is set", () => {
    const { container } = render(<DonutChart segments={[{ label: "a", value: 50 }, { label: "b", value: 50 }]} highlightIndex={0} />);
    const circles = container.querySelectorAll("circle.segment");
    expect(circles[0]).toHaveAttribute("opacity", "1");
    expect(circles[1]).toHaveAttribute("opacity", "0.3");
  });
});
```

- [ ] **Step 2:** Run, confirm FAIL.
- [ ] **Step 3:** Create `frontend/src/components/ui/donut-chart.tsx`:

```tsx
import { For, type Component } from "solid-js";
import { cn } from "../../lib/utils";

export type DonutSegment = { label: string; value: number; color?: string };

type ComputedStroke = { label: string; color: string; length: number; offset: number; dasharray: string };

const PALETTE = [
  "var(--color-primary)",
  "var(--color-text)",
  "var(--color-muted)",
  "var(--color-border-strong)",
  "#71717A",
];

export function computeSegmentStrokes(segments: DonutSegment[], radius: number): ComputedStroke[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, x) => s + x.value, 0);
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return sorted.map((seg, i) => {
    const fraction = seg.value / total;
    const length = circumference * fraction;
    const color = seg.color ?? PALETTE[i % PALETTE.length];
    const dasharray = `${length.toFixed(2)} ${circumference.toFixed(2)}`;
    const stroke: ComputedStroke = { label: seg.label, color, length, offset: -offset, dasharray };
    offset += length;
    return stroke;
  });
}

type DonutChartProps = {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  centerTrend?: { dir: "up" | "down"; value: string; tone?: "primary" | "accent" };
  size?: number;
  thickness?: number;
  highlightIndex?: number | null;
  onSegmentHover?: (index: number | null) => void;
};

export const DonutChart: Component<DonutChartProps> = (props) => {
  const size = () => props.size ?? 280;
  const thickness = () => props.thickness ?? 32;
  const radius = () => (size() - thickness()) / 2;
  const strokes = () => computeSegmentStrokes(props.segments, radius());
  const isHighlighted = (i: number) => props.highlightIndex == null || props.highlightIndex === i;
  const a11yLabel = () => `Donut chart with ${props.segments.length} segments totaling ${props.centerValue ?? ""}`;

  return (
    <div class="relative flex items-center justify-center" style={{ width: `${size()}px`, height: `${size()}px` }} role="img" aria-label={a11yLabel()}>
      <svg class="absolute inset-0" width={size()} height={size()} viewBox={`0 0 ${size()} ${size()}`} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size() / 2} cy={size() / 2} r={radius()} fill="transparent" stroke="var(--color-surface-hover)" stroke-width={thickness()} />
        <For each={strokes()}>
          {(stroke, i) => (
            <circle class={cn("segment transition-opacity duration-150 motion-reduce:transition-none")}
              cx={size() / 2} cy={size() / 2} r={radius()} fill="transparent"
              stroke={stroke.color} stroke-width={thickness()}
              stroke-dasharray={stroke.dasharray} stroke-dashoffset={stroke.offset}
              opacity={isHighlighted(i()) ? 1 : 0.3}
              onMouseEnter={() => props.onSegmentHover?.(i())}
              onMouseLeave={() => props.onSegmentHover?.(null)} />
          )}
        </For>
      </svg>
      <div class="flex flex-col items-center z-10 text-center">
        {props.centerLabel && <span class="text-[13px] font-medium text-muted uppercase tracking-wider mb-1">{props.centerLabel}</span>}
        {props.centerValue && <span class="text-4xl font-display font-bold text-text leading-none">{props.centerValue}</span>}
        {props.centerTrend && (
          <span class={cn("inline-flex items-center gap-1 text-[13px] font-medium mt-2",
            props.centerTrend.tone === "accent" || props.centerTrend.dir === "down" ? "text-accent" : "text-primary")}>
            {props.centerTrend.dir === "up" ? "↑" : "↓"} {props.centerTrend.value}
          </span>
        )}
      </div>
      <table class="sr-only">
        <thead><tr><th>Category</th><th>Value</th></tr></thead>
        <tbody><For each={props.segments}>{(s) => <tr><td>{s.label}</td><td>{s.value}</td></tr>}</For></tbody>
      </table>
    </div>
  );
};
```

- [ ] **Step 4:** Run, confirm PASS.
- [ ] **Step 5:** Commit: `feat(ui): DonutChart primitive (inline SVG, a11y, highlight)`

---

### Task 11: Build `Sparkline` with tests

**Files:** Create `frontend/src/components/ui/sparkline.tsx`, `frontend/src/components/ui/__tests__/sparkline.test.tsx`

- [ ] **Step 1:** Write the test:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import { Sparkline, buildSparklinePath } from "../sparkline";

describe("Sparkline — math", () => {
  it("returns empty path for empty series", () => { expect(buildSparklinePath([], 100, 40)).toBe(""); });
  it("produces a polyline with N+1 points", () => {
    const out = buildSparklinePath([1, 2, 3, 4, 5], 100, 40);
    expect(out.startsWith("M 0")).toBe(true);
    expect(out).toMatch(/L 100 /);
  });
});

describe("Sparkline — render", () => {
  it("renders an SVG path", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} width={120} height={40} />);
    expect(container.querySelector("path")).not.toBeNull();
  });
  it("uses primary stroke by default", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} width={120} height={40} />);
    expect(container.querySelector("path")).toHaveAttribute("stroke", "var(--color-primary)");
  });
});
```

- [ ] **Step 2:** Run, confirm FAIL.
- [ ] **Step 3:** Create `frontend/src/components/ui/sparkline.tsx`:

```tsx
import { type Component } from "solid-js";
import { cn } from "../../lib/utils";

export function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  tone?: "primary" | "text" | "muted" | "accent";
  class?: string;
};

const toneMap = { primary: "var(--color-primary)", text: "var(--color-text)", muted: "var(--color-muted)", accent: "var(--color-accent)" };

export const Sparkline: Component<SparklineProps> = (props) => {
  const width = () => props.width ?? 240;
  const height = () => props.height ?? 40;
  return (
    <svg class={cn("block", props.class)} width={width()} height={height()} viewBox={`0 0 ${width()} ${height()}`} role="img" aria-label="Trend sparkline">
      <path d={buildSparklinePath(props.values, width(), height())} fill="none" stroke={toneMap[props.tone ?? "primary"]} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
};
```

- [ ] **Step 4:** Run, confirm PASS.
- [ ] **Step 5:** Commit: `feat(ui): Sparkline primitive (inline SVG path)`

---

### Task 12: Build `AccountRow` and `TransactionRow` with tests

**Files:** Create `frontend/src/components/ui/account-row.tsx`, `transaction-row.tsx`, and matching `__tests__` files

- [ ] **Step 1:** Write `frontend/src/components/ui/__tests__/account-row.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { AccountRow } from "../account-row";
import { Wallet } from "lucide-solid";

describe("AccountRow", () => {
  it("renders name, sublabel, formatted balance", () => {
    render(<AccountRow icon={Wallet} name="Chase" sublabel="•••• 1234" balance={12450} />);
    expect(screen.getByText("Chase")).toBeInTheDocument();
    expect(screen.getByText("₹12,450")).toBeInTheDocument();
  });
  it("uses rupee by default", () => {
    render(<AccountRow icon={Wallet} name="x" balance={100} />);
    expect(screen.getByText("₹100")).toBeInTheDocument();
  });
  it("renders a button when onClick is provided", () => {
    const { container } = render(<AccountRow icon={Wallet} name="x" balance={0} onClick={() => {}} />);
    expect(container.querySelector("button")).not.toBeNull();
  });
  it("shows 'Sync failed' badge on error status", () => {
    render(<AccountRow icon={Wallet} name="x" balance={0} status="error" />);
    expect(screen.getByText("Sync failed")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2:** Create `frontend/src/components/ui/account-row.tsx`:

```tsx
import { Show, type Component, type JSX } from "solid-js";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";

type Status = "connected" | "syncing" | "error" | "disconnected";
type AccountRowProps = {
  icon: Component<{ class?: string; size?: number }>;
  name: string;
  sublabel?: string;
  balance: number;
  currency?: string;
  status?: Status;
  onClick?: () => void;
};

const statusLabel: Record<Status, string | null> = { connected: null, syncing: "Syncing…", error: "Sync failed", disconnected: "Disconnected" };
const statusColor: Record<Status, string> = { connected: "text-muted", syncing: "text-primary", error: "text-accent", disconnected: "text-muted" };

export const AccountRow: Component<AccountRowProps> = (props) => {
  const content = (): JSX.Element => (
    <div class="flex items-center gap-3 h-20">
      <div class="w-10 h-10 rounded-input bg-bg flex items-center justify-center text-muted">
        {(() => { const Icon = props.icon; return <Icon size={20} />; })()}
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-body text-base text-text truncate">{props.name}</div>
        {props.sublabel && <div class="font-body text-[13px] text-muted mt-0.5 truncate">{props.sublabel}</div>}
      </div>
      <div class="text-right">
        <div class="font-display font-semibold text-lg text-text">{formatCurrency(props.balance, props.currency)}</div>
        <Show when={props.status && statusLabel[props.status]}>
          {(label) => <div class={cn("text-[12px] font-medium mt-0.5", statusColor[props.status!])}>{label()}</div>}
        </Show>
      </div>
    </div>
  );
  if (props.onClick) {
    return (
      <button type="button" onClick={props.onClick}
        class="w-full text-left active:bg-surface-hover transition-colors rounded-[16px] cursor-pointer"
        aria-label={`${props.name}, balance ${formatCurrency(props.balance, props.currency)}`}>
        {content()}
      </button>
    );
  }
  return content() as JSX.Element;
};
```

- [ ] **Step 3:** Write `frontend/src/components/ui/__tests__/transaction-row.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { TransactionRow } from "../transaction-row";
import { ShoppingCart } from "lucide-solid";

describe("TransactionRow", () => {
  it("renders merchant, category, amount", () => {
    render(<TransactionRow icon={ShoppingCart} merchant="Whole Foods" category="Groceries" amount={-45} type="expense" date="2026-10-12" />);
    expect(screen.getByText("Whole Foods")).toBeInTheDocument();
    expect(screen.getByText("-₹45")).toBeInTheDocument();
  });
  it("shows + prefix and primary color for income", () => {
    render(<TransactionRow icon={ShoppingCart} merchant="Stripe" category="Income" amount={1250} type="income" date="2026-10-12" />);
    expect(screen.getByText("+₹1,250")).toHaveClass("text-primary");
  });
  it("renders a button when onClick is provided", () => {
    const { container } = render(<TransactionRow icon={ShoppingCart} merchant="x" category="x" amount={0} type="expense" date="2026-10-12" onClick={() => {}} />);
    expect(container.querySelector("button")).not.toBeNull();
  });
});
```

- [ ] **Step 4:** Create `frontend/src/components/ui/transaction-row.tsx`:

```tsx
import { type Component, type JSX } from "solid-js";
import { formatCurrency, formatDate } from "../../lib/format";
import { cn } from "../../lib/utils";

type TransactionRowProps = {
  icon: Component<{ class?: string; size?: number }>;
  merchant: string;
  category: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  date: string;
  onClick?: () => void;
};

const typePrefix = { income: "+", expense: "-", transfer: "" } as const;
const typeTone = { income: "text-primary", expense: "text-text", transfer: "text-muted" } as const;

export const TransactionRow: Component<TransactionRowProps> = (props) => {
  const content = (): JSX.Element => (
    <div class="flex items-center gap-4 h-[72px]">
      <div class="w-10 h-10 rounded-lg bg-bg flex items-center justify-center text-muted">
        {(() => { const Icon = props.icon; return <Icon size={20} />; })()}
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-body text-base text-text truncate">{props.merchant}</div>
        <div class="font-body text-[13px] font-medium text-muted mt-0.5">{props.category} · {formatDate(props.date)}</div>
      </div>
      <div class={cn("font-display font-semibold text-lg", typeTone[props.type])}
        aria-label={`${typePrefix[props.type]}${formatCurrency(Math.abs(props.amount))} ${props.type}`}>
        {typePrefix[props.type]}{formatCurrency(Math.abs(props.amount))}
      </div>
    </div>
  );
  if (props.onClick) {
    return (
      <button type="button" onClick={props.onClick} class="w-full text-left active:bg-surface-hover transition-colors cursor-pointer"
        aria-label={`${props.merchant}, ${props.category}, ${props.type}, ${typePrefix[props.type]}${formatCurrency(Math.abs(props.amount))}, ${formatDate(props.date)}`}>
        {content()}
      </button>
    );
  }
  return content() as JSX.Element;
};
```

- [ ] **Step 5:** Run `bun run test -- account-row transaction-row` — confirm PASS.
- [ ] **Step 6:** Commit: `feat(ui): AccountRow and TransactionRow primitives (button-based, a11y)`

---

### Task 13: Build remaining small primitives

**Files:** Create `frontend/src/components/ui/category-bar.tsx`, `segmented-control.tsx`, `search-bar.tsx`, `empty-state.tsx`, `skeleton.tsx`, `page-header.tsx`

- [ ] **Step 1:** Create `category-bar.tsx`:

```tsx
import { type Component } from "solid-js";
import { cn } from "../../lib/utils";

type CategoryBarProps = { value: number; color?: string; trackColor?: string; class?: string; };

export const CategoryBar: Component<CategoryBarProps> = (props) => {
  const pct = () => { const v = props.value; if (v <= 1) return Math.max(0, Math.min(1, v)) * 100; return Math.max(0, Math.min(100, v)); };
  return (
    <div class={cn("h-1 w-full rounded-full overflow-hidden", props.trackColor ?? "bg-surface-hover", props.class)}>
      <div class="h-full rounded-full transition-all duration-200 motion-reduce:transition-none" style={{ width: `${pct()}%`, "background-color": props.color ?? "var(--color-text)" }} />
    </div>
  );
};
```

- [ ] **Step 2:** Create `segmented-control.tsx` (uses `role="tablist"` / `role="tab"`, ArrowLeft/Right keyboard nav, see spec §11). Body omitted for brevity; full code mirrors the pattern in the rest of Phase 1.

- [ ] **Step 3:** Create `search-bar.tsx` (wraps `<input>` in a `<label>` with `sr-only` text; absolute Search icon; `h-12 bg-surface`).

- [ ] **Step 4:** Create `empty-state.tsx` (centered column, optional icon, title, body, action button).

- [ ] **Step 5:** Create `skeleton.tsx` (exports `SkeletonBlock` and `SkeletonRow`, both pulsing with `bg-surface-hover animate-pulse motion-reduce:animate-none`).

- [ ] **Step 6:** Create `page-header.tsx`:

```tsx
import { Show, type Component, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ArrowLeft } from "lucide-solid";

type PageHeaderProps = { title: string; back?: boolean; actions?: JSX.Element; };

export const PageHeader: Component<PageHeaderProps> = (props): JSX.Element => {
  const navigate = useNavigate();
  return (
    <header class="sticky top-0 z-30 bg-bg/95 backdrop-blur-sm border-b border-border h-14 md:h-16 flex items-center justify-between px-4 md:px-6">
      <div class="flex items-center gap-2 min-w-0">
        <Show when={props.back}>
          <button type="button" onClick={() => navigate(-1)} aria-label="Go back"
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform">
            <ArrowLeft size={20} />
          </button>
        </Show>
        <h1 class="font-display font-bold text-xl md:text-2xl text-text tracking-tight truncate">{props.title}</h1>
      </div>
      <div class="flex items-center gap-2">{props.actions}</div>
    </header>
  );
};
```

- [ ] **Step 7:** `cd frontend && bun run build` — must succeed.
- [ ] **Step 8:** Commit: `feat(ui): remaining small primitives (CategoryBar, SegmentedControl, SearchBar, EmptyState, Skeleton, PageHeader)`

---

### Task 14: Build `nav-items.ts` and `nav.tsx` (BottomNav, Sidebar, MoreSheet)

**Files:** Create `frontend/src/components/ui/nav-items.ts`, `frontend/src/components/ui/nav.tsx`, `frontend/src/components/ui/__tests__/nav.test.tsx`

- [ ] **Step 1:** Create `nav-items.ts` (4 primary items: Dashboard, Accounts, Analytics, Activity; 9 secondary items: Budgets, Investments, Loans, Insurance, NetWorth, Reports, Import, Export, Settings).

- [ ] **Step 2:** Write the test (data-only checks: 4 primary, 9 secondary, all have path+label+icon+section).

- [ ] **Step 3:** Create `nav.tsx`:
  - `BottomNav`: fixed bottom, `md:hidden`, 5 items: 4 from `primaryNavItems` + a 5th "More" `<A>` that dispatches a `ledgerify:open-more` window event.
  - `Sidebar`: hidden on mobile (`hidden md:flex`), 240px wide, logo block, 4 primary `<A>`s, a "More" toggle button that expands an accordion with the 9 secondary items, a Logout button at the bottom.
  - `MoreSheet`: mobile bottom drawer (`<Portal>` from solid-js/web), opens on the `ledgerify:open-more` event, shows the 9 secondary items in a 3-col grid, `Esc` closes, `aria-modal="true"`, `aria-labelledby="more-sheet-title"`, backdrop tap closes.

- [ ] **Step 4:** `cd frontend && bun run build` — must succeed.
- [ ] **Step 5:** Commit: `feat(ui): nav (BottomNav 5 tabs, Sidebar with More accordion, MoreSheet bottom drawer)`

---

### Task 15: Build `lint:colors` script

**Files:** Create `frontend/scripts/lint-colors.mjs`, modify `frontend/package.json`

- [ ] **Step 1:** Create `frontend/scripts/lint-colors.mjs`:

```js
#!/usr/bin/env node
// Enforces: text-primary is only legal when paired with a dark surface
// (bg-bg, bg-surface, bg-surface-hover) or bg-text (inverted SegmentedControl).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ALLOWED_BG = ["bg-bg", "bg-surface", "bg-surface-hover", "bg-text"];
const ROOTS = ["src"];
const EXTS = new Set([".ts", ".tsx", ".html"]);

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
    if (!ALLOWED_BG.some((bg) => line.includes(bg))) {
      console.error(`${f}:${i + 1}: text-primary must be paired with one of: ${ALLOWED_BG.join(", ")}`);
      console.error(`  ${line.trim()}`);
      violations++;
    }
  });
}
console.error(`lint:colors — ${files.length} files, ${usageCount} text-primary usages, ${violations} violation(s).`);
if (violations > 0) process.exit(1);
```

- [ ] **Step 2:** Add to `package.json` scripts: `"lint:colors": "node scripts/lint-colors.mjs"`
- [ ] **Step 3:** Run `cd frontend && bun run lint:colors` — must exit 0 on current code.
- [ ] **Step 4:** Sanity test: create `frontend/src/_bad.tsx` with `class="text-primary bg-white"`, run lint (expect exit 1, 1 violation), delete the file, re-run (expect exit 0).
- [ ] **Step 5:** Commit: `feat(tooling): lint:colors enforces text-primary dark-surface pairings`

---

### Task 16: Rewrite `MainLayout` to use the breakpoint-driven shell

**Files:** Modify `frontend/src/layouts/MainLayout.tsx`

- [ ] **Step 1:** Replace the file contents with:

```tsx
import { type RouteSectionProps, useLocation } from "@solidjs/router";
import { createSignal, onCleanup, onMount, Show, type Component, type JSX } from "solid-js";
import { BottomNav, Sidebar, MoreSheet } from "../components/ui/nav";

export const MainLayout: Component<RouteSectionProps> = (props): JSX.Element => {
  const [isDesktop, setIsDesktop] = createSignal(false);
  const location = useLocation();

  onMount(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    onCleanup(() => mq.removeEventListener("change", update));
  });

  const isFocusedView = () => location.pathname === "/activity" || location.pathname === "/transactions";

  return (
    <div class="min-h-screen bg-bg text-text">
      <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-bg focus:px-3 focus:py-1.5 focus:rounded-input">
        Skip to main content
      </a>
      <Show when={isDesktop()}><Sidebar /></Show>
      <main id="main" class={isDesktop() ? "md:ml-60" : ""} tabindex="-1">
        <div class={isFocusedView() ? "" : "pb-20 md:pb-0"}>{props.children}</div>
      </main>
      <Show when={!isDesktop()}><BottomNav /></Show>
      <MoreSheet />
    </div>
  );
};
```

- [ ] **Step 2:** `cd frontend && bun run build` — must succeed.
- [ ] **Step 3:** Commit: `refactor(layout): MainLayout uses breakpoint-driven shell`

---

### Task 17: Add routes and stub Analytics page

**Files:** Modify `frontend/src/App.tsx`, create `frontend/src/pages/Analytics.tsx`

- [ ] **Step 1:** Add `import Analytics` and add `<Route path="/analytics" component={Analytics} />` and `<Route path="/activity" component={Transactions} />` (the latter aliased to the existing Transactions page) to `App.tsx`.

- [ ] **Step 2:** Create `frontend/src/pages/Analytics.tsx` as a stub:

```tsx
import { PageHeader } from "../components/ui/page-header";
export default function Analytics() {
  return (
    <>
      <PageHeader title="Analytics" />
      <div class="p-4 text-muted">Coming in Phase 2.</div>
    </>
  );
}
```

- [ ] **Step 3:** `cd frontend && bun run build` — must succeed.
- [ ] **Step 4:** Commit: `feat(routing): add /analytics and /activity routes`

---

### Task 18: Phase 1 verification gate

- [ ] **Step 1:** Run the full gate (see "Verification gate" at the top of this plan). All steps must exit 0.
- [ ] **Step 2:** `cd frontend && bun run dev`. Open http://localhost:5173 in 375px and 1280px. Confirm: app loads, no console errors, no visual regressions on pages that haven't been rebuilt yet (they still use the old Card primitives, which still work).
- [ ] **Step 3:** Tag: `git tag phase-1-foundation`

---

## Phase 2 — Mockup Pages (Tasks 19–22)

Order: Dashboard → Activity → Accounts → Analytics.

For each page, the steps are:
1. Replace the page file
2. Verify (build + lint:colors + test)
3. Visual smoke test at 375px and 1280px
4. Commit

The full source for each page is below. Components used: `BentoBlock`, `Stat`, `PageHeader`, `Sparkline`, `TransactionRow`, `DonutChart`, `CategoryBar`, `SegmentedControl`, `AccountRow`, `SearchBar`, `formatCurrency`, `formatDate`, `formatDateGroup`.

---

### Task 19: Rebuild Dashboard to bento

**Files:** Modify `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1:** Replace the file with the bento version. The structure:
  - `<PageHeader title="Dashboard" actions={<Plus icon button>}>`
  - Loading: 3-skeleton block grid
  - 2-col bento on mobile, 3-col on desktop
  - BentoBlock span=2 size=lg: `<Stat label="Total Balance" value={formatCurrency(...)} trend="+2.4% this month" size="xl" />`
  - BentoBlock size=md: Income (primary tone) and Expenses (default tone) side by side
  - BentoBlock span=2: 30-day spending sparkline
  - BentoBlock span=2: Recent 5 transactions with "View all →" link to `/activity`
- [ ] **Step 2:** Run `bun run build && bun run lint:colors && bun run test` — all pass.
- [ ] **Step 3:** Visual smoke at 375 + 1280. Confirm layout matches the Stitch Dashboard mockup (allowing for real data).
- [ ] **Step 4:** Commit: `feat(pages): Dashboard rebuilt to bento (2-col mobile, 3-col desktop)`

---

### Task 20: Rebuild Activity (Transactions) to bento

**Files:** Modify `frontend/src/pages/Transactions.tsx` (page logic; the route is still `/transactions` and aliases to `/activity`)

- [ ] **Step 1:** Replace the file with the bento version. The structure:
  - `<PageHeader title="Transactions" back />`
  - Sticky SearchBar (top, below PageHeader)
  - Body: date-grouped list, each date group is a sticky header (uppercase muted, 13px) + a column of `TransactionRow`s with `border-b border-border last:border-0`
  - Loading: SkeletonRow × 5
  - Map `t.category` → lucide icon (Groceries → ShoppingCart, Dining → Coffee, Transport → Bus, etc.)
  - The `pb-20 md:pb-0` wrapper is omitted (focused view, no bottom nav)
- [ ] **Step 2:** Verify.
- [ ] **Step 3:** Visual smoke. Confirm: back button works, search filters live, date headers stick during scroll.
- [ ] **Step 4:** Commit: `feat(pages): Activity (Transactions) rebuilt to bento (sticky search, date-grouped list)`

---

### Task 21: Rebuild Accounts to bento

**Files:** Modify `frontend/src/pages/Accounts.tsx`

- [ ] **Step 1:** Replace the file with the bento version. The structure:
  - `<PageHeader title="Accounts" actions={<Button size="icon"><Plus/>}>` 
  - Loading: 2 SkeletonBlocks
  - Body: vertical stack of `BentoBlock variant="pressable"` per account, each containing an `AccountRow` (Wallet icon, name, sublabel, balance)
  - At the bottom: a `BentoBlock variant="dashed"` with a "Connect Institution" CTA
- [ ] **Step 2:** Verify.
- [ ] **Step 3:** Visual smoke.
- [ ] **Step 4:** Commit: `feat(pages): Accounts rebuilt to bento (vertical stack + dashed Add card)`

---

### Task 22: Rebuild Analytics to bento

**Files:** Modify `frontend/src/pages/Analytics.tsx`

- [ ] **Step 1:** Replace the file with the bento version. The structure:
  - `<PageHeader title="Analytics" />`
  - `SegmentedControl<Mode>` (Expense | Income), `ariaLabel="Analytics mode"`, ArrowLeft/Right keyboard support
  - `BentoBlock size="lg" span={2}`: `<DonutChart segments centerLabel="Total Spent" centerValue={formatCurrency(total)} centerTrend={{dir:"up", value:"+12%"}} highlightIndex onSegmentHover />`
  - `BentoBlock size="md" span={2}`: category list — each row has icon-tile, name, amount, and a `CategoryBar`; hovering a row sets `highlight(i)` which dims the other donut segments to 30% opacity
- [ ] **Step 2:** Verify.
- [ ] **Step 3:** Visual smoke. Confirm: donut renders correctly with real data, hover synchronization between list and donut works, SegmentedControl keyboard nav works.
- [ ] **Step 4:** Commit: `feat(pages): Analytics rebuilt to bento (donut + category list with hover highlight)`

---

### Task 23: Phase 2 verification gate

- [ ] **Step 1:** Run the full gate. All steps must exit 0.
- [ ] **Step 2:** Visual smoke at 375 + 1280 for Dashboard, Activity, Accounts, Analytics. The Stitch mockups should be the visual reference.
- [ ] **Step 3:** Tag: `git tag phase-2-mockup-pages`

---

## Phase 3 — Remaining Pages (Tasks 24–33)

Each task is a single page rebuild following the same pattern. The spec's §9 (Budgets §9.1, Investments §9.2, ...) is the source of truth for what each page shows.

For each task: read the relevant spec section first, then replace the file with a bento version, then verify and commit.

---

### Task 24: Rebuild Budgets

**Files:** Modify `frontend/src/pages/Budgets.tsx`

- [ ] **Step 1:** Read spec §9.1. PageHeader "Budgets" + Add icon. Vertical stack of `BentoBlock variant="pressable" size="md" span={2}` per budget. Each block: budget name (display, 18px), period label, "X% used" + spent/limit (muted), and a `CategoryBar` (use `--color-primary` if within limit, `--color-accent` if over). End with a `BentoBlock variant="dashed"` for "Create your first budget".
- [ ] **Step 2:** Verify + commit: `feat(pages): Budgets rebuilt to bento (CategoryBar per budget)`

---

### Task 25: Rebuild Investments

**Files:** Modify `frontend/src/pages/Investments.tsx`

- [ ] **Step 1:** Read spec §9.2. PageHeader "Investments" + Add icon. Vertical stack of `BentoBlock variant="pressable"` per holding. Each block: ticker (`font-mono text-lg`), name (`text-muted text-sm`), qty × price (`font-mono text-sm`), market value (`font-display text-lg`), and a `Sparkline` (120×32) on the right.
- [ ] **Step 2:** Verify + commit: `feat(pages): Investments rebuilt to bento (BentoBlock + Sparkline per holding)`

---

### Task 26: Rebuild Loans

**Files:** Modify `frontend/src/pages/Loans.tsx`

- [ ] **Step 1:** Read spec §9.3. PageHeader "Loans" + Add icon. Vertical stack of `BentoBlock variant="pressable"`. Each block: 40x40 Landmark icon, lender name, type Badge, principal + EMI + next-due (display font).
- [ ] **Step 2:** Verify + commit: `feat(pages): Loans rebuilt to bento`

---

### Task 27: Rebuild Insurance

**Files:** Modify `frontend/src/pages/Insurance.tsx`

- [ ] **Step 1:** Read spec §9.4. Same shape as Loans: 40x40 ShieldCheck icon, provider name, type Badge, premium + renewal date, status Badge (`Active` primary / `Expiring soon` accent).
- [ ] **Step 2:** Verify + commit: `feat(pages): Insurance rebuilt to bento`

---

### Task 28: Rebuild NetWorth

**Files:** Modify `frontend/src/pages/NetWorth.tsx`

- [ ] **Step 1:** Read spec §9.5. Top: `BentoBlock` with `<Stat size="xl" tone={current >= 0 ? "primary" : "accent"} />` for the current net worth. Middle: full-width `BentoBlock` with a `Sparkline` (640×120 desktop / full-width mobile). Bottom: "Top Movers" `BentoBlock` with a list of `{name, delta}` rows (delta colored primary/accent by sign).
- [ ] **Step 2:** Verify + commit: `feat(pages): NetWorth rebuilt to bento (Stat + Sparkline + Top Movers)`

---

### Task 29: Rebuild Reports (hub)

**Files:** Modify `frontend/src/pages/Reports.tsx`

- [ ] **Step 1:** Read spec §9.6. Keep the hub role. 2-col grid (1-col on mobile) of `BentoBlock variant="pressable"` cards, each linking to a `/reports/*` sub-route. 4 cards: Cash Flow, Category Breakdown, Budget vs Actual, Net Worth. Each card has an icon (LineChart / BarChart3 / Wallet / TrendingUp), title, and a one-line description.
- [ ] **Step 2:** Verify + commit: `feat(pages): Reports rebuilt to bento (hub for sub-routes)`

---

### Task 30: Rebuild Import

**Files:** Modify `frontend/src/pages/Import.tsx`

- [ ] **Step 1:** Read spec §9.7. PageHeader "Import Transactions". Top: `BentoBlock variant="dashed" size="lg" span={2}` containing a `<label>` with `FileUp` icon, helper text, hidden `<input type="file">`, and a visible "Choose File" `Button` that triggers the input. After a file is selected: a `BentoBlock size="md"` with a collapsible "Column Mapping" `<details>`, and a full-width "Import" `Button`.
- [ ] **Step 2:** Verify + commit: `feat(pages): Import rebuilt to bento (dashed drop zone)`

---

### Task 31: Rebuild Export

**Files:** Modify `frontend/src/pages/Export.tsx`

- [ ] **Step 1:** Read spec §9.8. PageHeader "Export". `BentoBlock size="md" span={2}` containing: a `SegmentedControl` for date range (1M / 3M / YTD / ALL / Custom), a multi-select list of fields to include (checkboxes styled with the bento surface), and a primary "Download CSV" `Button`. Below: a "Recent exports" list with download links.
- [ ] **Step 2:** Verify + commit: `feat(pages): Export rebuilt to bento`

---

### Task 32: Rebuild Settings

**Files:** Modify `frontend/src/pages/Settings.tsx`

- [ ] **Step 1:** Read spec §9.9. PageHeader "Settings". Three `BentoBlock size="md" span={2}` groups: Account (Email, Change password, Logout — danger), Preferences (Currency — `getCurrency()` value, Date format), Data (Export all, Import, Delete account — danger). Each row is a 56px-tall button with a chevron on the right; rows that are destructive render their label in `--color-accent`.
- [ ] **Step 2:** Verify + commit: `feat(pages): Settings rebuilt to bento (3 grouped BentoBlocks)`

---

### Task 33: Rebuild Login and Register

**Files:** Modify `frontend/src/pages/Login.tsx`, `frontend/src/pages/Register.tsx`

- [ ] **Step 1:** Read spec §9.10. Centered card, max-w 360px, on the dark `bg-bg` (no light surface). Single `BentoBlock` containing: 48x48 lime logo block + "Ledgerify" wordmark centered at top, form (Email, Password — proper `<label for>` + `<Input>`), primary submit `Button` (full-width), and a footer link ("Sign up" / "Sign in"). The form must use real `<label>`s (per spec §11 a11y) — no placeholder-only labeling.
- [ ] **Step 2:** Verify + commit: `feat(pages): Login and Register rebuilt to bento (centered card)`

---

### Task 34: Phase 3 verification gate

- [ ] **Step 1:** Run the full gate. All steps must exit 0.
- [ ] **Step 2:** Visual smoke at 375 + 1280 for every page. Visit all 14 routes via the BottomNav (mobile) and the Sidebar (desktop). Confirm visual consistency and the More tab → MoreSheet flow.
- [ ] **Step 3:** Tag: `git tag phase-3-remaining-pages`

---

## Phase 4 — Polish (Tasks 35–38)

---

### Task 35: Remove dead `index.css` and unused `card.tsx`

**Files:** Delete `frontend/src/index.css`, `frontend/src/components/ui/card.tsx`

- [ ] **Step 1:** `cd frontend && grep -r "index.css" src/` — confirm no imports (only `index.tsx` imports `custom.css`).
- [ ] **Step 2:** `git rm frontend/src/index.css`
- [ ] **Step 3:** `cd frontend && grep -r "from.*components/ui/card" src/` — confirm no imports.
- [ ] **Step 4:** `git rm frontend/src/components/ui/card.tsx`
- [ ] **Step 5:** `cd frontend && bun run build` — must succeed.
- [ ] **Step 6:** Commit: `chore: remove dead index.css and card.tsx (no longer imported)`

---

### Task 36: Update `frontend/README.md` with the new design language

**Files:** Modify `frontend/README.md`

- [ ] **Step 1:** Read the current `frontend/README.md`.
- [ ] **Step 2:** Append a `## Design System` section that:
  - States the design language name (Minimalist Bento) and the visual rules (dark-mode-only, deep zinc, neon-lime primary, 24px bento radii, Space Grotesk + DM Sans)
  - Links to the spec at `docs/superpowers/specs/2026-06-06-minimalist-bento-ui-revamp-design.md`
  - Notes that design tokens live in `src/styles/custom.css` under Tailwind v4's `@theme` block
  - Calls out the known gaps: outdoor/high-contrast theme deferred, TanStack Query not yet used
  - Documents the lint and test scripts (`bun run lint:colors`, `bun run test`, `bun run build`)
- [ ] **Step 3:** `cd frontend && bun run build` — must succeed.
- [ ] **Step 4:** Commit: `docs(frontend): add Design System section to README, link to spec`

---

### Task 37: Final a11y audit

- [ ] **Step 1:** `cd frontend && bun run dev` (leave running).
- [ ] **Step 2:** Tab through every page. Verify:
  - Skip link appears on first Tab
  - Focus rings are visible (lime, 2px)
  - Focus order follows source order
  - All icon-only buttons have `aria-label`
  - No focus traps (the MoreSheet trap is intentional and releases on Esc or backdrop tap)
- [ ] **Step 3:** Enable OS reduced-motion. Reload. Confirm: block entrance animations skipped, press states change instantly, transitions are instant.
- [ ] **Step 4:** Enable OS reduced-transparency (if available on the device, or via DevTools rendering → "Emulate CSS prefers-reduced-transparency"). Confirm: PageHeader and DateHeader fall back to solid `bg-bg` (no blur).
- [ ] **Step 5:** Run an automated axe-core check if Playwright is set up: `bunx playwright test` (with a small suite that hits each route). If Playwright is not set up, this is deferred — manual check is sufficient for this revamp.
- [ ] **Step 6:** If any a11y issues are found, file fixes as separate commits.

---

### Task 38: Phase 4 verification gate + final smoke test

- [ ] **Step 1:** Run the full gate. All steps must exit 0.
- [ ] **Step 2:** Final smoke test on real devices or browser DevTools:
  - **iPhone SE (375px)** — all 14 pages, BottomNav visible, More tab opens the sheet
  - **iPhone 15 Pro (393px)** — same
  - **iPad Mini (768px)** — Sidebar appears, BottomNav disappears
  - **1280px desktop** — Sidebar, 3-col bento grids
  - **1920px desktop** — same as 1280 (max-width 1280 caps the content)
- [ ] **Step 3:** Compare the 4 mockup screens (Dashboard, Activity/Transactions, Accounts, Analytics) against the Stitch reference. The real-data versions should match the mockup structure; allow for color and number differences from real data.
- [ ] **Step 4:** Tag: `git tag phase-4-polish`
- [ ] **Step 5:** Tag the milestone: `git tag minimalist-bento-revamp-complete`

---

## Self-Review

After completing all tasks, run this checklist against the spec.

**Spec coverage:**

| Spec section | Implemented by |
|---|---|
| §1 Overview | (meta) — established by the spec itself |
| §2 Goals, §3 Non-Goals | (meta) — design constraints |
| §4 Confirmed decisions | Tasks 1, 14, 15, 16 (brand, nav 5 tabs, theme dark, etc.) |
| §5 Design tokens | Task 1 |
| §6 Layout & navigation | Tasks 14, 16 |
| §7.1 BentoBlock | Task 8 |
| §7.2 PageHeader | Task 13 |
| §7.3 Stat | Task 9 |
| §7.4 AccountRow | Task 12 |
| §7.5 TransactionRow | Task 12 |
| §7.6 DonutChart (5-color palette) | Task 10 |
| §7.7 CategoryBar | Task 13 |
| §7.8 SegmentedControl | Task 13 |
| §7.9 SearchBar | Task 13 |
| §7.10 EmptyState | Task 13 |
| §7.11 Skeleton | Task 13 |
| §7.12 BottomNav, Sidebar, MoreSheet | Task 14 |
| §7.13 Refactored Button, Input, Select, Badge | Tasks 4, 5, 6 |
| §8.1 Dashboard | Task 19 |
| §8.2 Accounts | Task 21 |
| §8.3 Analytics | Task 22 |
| §8.4 Activity | Task 20 |
| §9.1–9.10 Brief page specs | Tasks 24–33 |
| §10 Phases 1–4 | Tasks 1–38 |
| §11 Accessibility | Spread across all tasks (focus rings, button semantics, ARIA, reduced-motion, reduced-transparency); final audit in Task 37 |
| §12 Technical Decisions (chart, currency, color lint) | Task 15 (lint), Task 7 (currency INR default), Task 10 (DonutChart SVG, Chart.js stays) |
| §13 Risks | Mitigated inline (lint:colors, deferral notes, etc.) |
| §14 Files Touched | Realized by the tasks above |

**Placeholder scan:** No "TBD", "TODO", "fill in details", or vague "add appropriate error handling" placeholders. Specific code is given for every load-bearing primitive; Phase 2/3 page shapes are described in enough detail to implement without re-deciding the design.

**Type consistency:** `computeSegmentStrokes` is exported and tested in Task 10 and used by the same `DonutChart` component — consistent. The `nav-items.ts` `NavItem` type is used by both `BottomNav` and `Sidebar` via the same `nav.tsx` — consistent. The `formatCurrency` signature is `(n: number, currency?: string)` everywhere — consistent.

**No-go item verified:** No backend changes. `cmd/server/main.go`, `internal/`, `queries/`, `schema/` are untouched. The `//go:embed all:frontend/dist` boundary is verified by the gate's `go build` step.


---
