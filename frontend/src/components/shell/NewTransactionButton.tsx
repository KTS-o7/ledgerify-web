import { type Component } from "solid-js";
import { Plus } from "lucide-solid";
import { openQuickAdd } from "../../lib/events";
import { Kbd } from "../ui/kbd";

/** Desktop header primary action: "New transaction" with an N keycap. Hidden on mobile (the tab bar has +). */
export const NewTransactionButton: Component = () => (
  <button
    type="button"
    onClick={() => openQuickAdd("expense")}
    aria-keyshortcuts="n"
    class="hidden md:inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-[10px] bg-btn text-btn-text text-[13.5px] font-semibold hover:opacity-90 active:scale-[0.97] transition-[opacity,transform] duration-[90ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
  >
    <Plus size={16} />
    New transaction
    <Kbd class="bg-btn-text/15 text-btn-text">N</Kbd>
  </button>
);
