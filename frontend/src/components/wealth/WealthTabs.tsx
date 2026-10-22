import { useLocation, useNavigate } from "@solidjs/router";
import { type Component } from "solid-js";
import { SegmentedControl } from "../ui/segmented-control";
import { withViewTransition } from "../../lib/pwa";
import { cn } from "../../lib/utils";

type WealthTab = "/networth" | "/investments" | "/loans";

const OPTIONS: { value: WealthTab; label: string }[] = [
  { value: "/networth", label: "Net worth" },
  { value: "/investments", label: "Holdings" },
  { value: "/loans", label: "Loans" },
];

/** Net worth / Holdings / Loans switcher shared by the three Wealth pages. */
export const WealthTabs: Component<{ class?: string }> = (props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const current = (): WealthTab =>
    (OPTIONS.find((o) => location.pathname.startsWith(o.value))?.value ?? "/networth");
  return (
    <SegmentedControl
      options={OPTIONS}
      value={current()}
      onChange={(v) => { if (v !== current()) withViewTransition(() => navigate(v)); }}
      ariaLabel="Wealth sections"
      class={cn("md:max-w-[360px]", props.class)}
    />
  );
};
