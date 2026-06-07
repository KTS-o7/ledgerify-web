import { createSignal, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ChevronRight, LogOut, Trash2, FileDown, FileUp, KeyRound, Mail, Globe, Calendar } from "lucide-solid";
import { useAuth } from "../lib/store";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Select } from "../components/ui/select";
import { getCurrency } from "../lib/format";

function Row(props: { icon: any; label: string; danger?: boolean; onClick?: () => void; trailing?: any }) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      onClick={props.onClick}
      class="w-full h-14 flex items-center gap-3 px-2 -mx-2 rounded-input text-left hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <Icon size={18} class={props.danger ? "text-accent" : "text-muted"} />
      <span class={`flex-1 font-body text-base ${props.danger ? "text-accent" : "text-text"}`}>{props.label}</span>
      {props.trailing}
      <ChevronRight size={16} class="text-muted" />
    </button>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currency, setCurrency] = createSignal(getCurrency());

  onMount(() => setCurrency(getCurrency()));

  const onCurrencyChange = (e: Event) => {
    const v = (e.currentTarget as HTMLSelectElement).value;
    setCurrency(v);
    if (typeof localStorage !== "undefined") localStorage.setItem("ledgerify.currency", v);
  };

  return (
    <>
      <PageHeader title="Settings" />
      {/* Desktop: 2-col — left has account + prefs stacked, right has data */}
      <div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">

        {/* Left column */}
        <div class="flex flex-col gap-3">
          <BentoBlock>
            <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Account</span>
            <Row icon={Mail} label={user()?.email || "Email"} />
            <Row icon={KeyRound} label="Change password" />
            <Row icon={LogOut} label="Logout" danger onClick={() => { logout(); navigate("/login"); }} />
          </BentoBlock>
          <BentoBlock>
            <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Preferences</span>
            <div class="flex items-center gap-3 h-14">
              <Globe size={18} class="text-muted" />
              <label for="settings-currency" class="flex-1 font-body text-base text-text">Currency</label>
              <Select id="settings-currency" value={currency()} onChange={onCurrencyChange} class="w-32">
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </Select>
            </div>
            <div class="flex items-center gap-3 h-14">
              <Calendar size={18} class="text-muted" />
              <label for="settings-date-format" class="flex-1 font-body text-base text-text">Date format</label>
              <Select id="settings-date-format" class="w-32" value="MMM DD">
                <option>MMM DD</option>
                <option>DD/MM/YYYY</option>
                <option>YYYY-MM-DD</option>
              </Select>
            </div>
          </BentoBlock>
        </div>

        {/* Right column */}
        <BentoBlock>
          <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Data</span>
          <Row icon={FileDown} label="Export all data" onClick={() => navigate("/export")} />
          <Row icon={FileUp} label="Import" onClick={() => navigate("/import")} />
          <Row icon={Trash2} label="Delete account" danger />
        </BentoBlock>

      </div>
    </>
  );
}
