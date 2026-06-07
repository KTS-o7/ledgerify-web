import { createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ChevronRight, LogOut, Trash2, FileDown, FileUp, KeyRound, Mail, Globe, Calendar } from "lucide-solid";
import { useAuth } from "../lib/store";
import { api } from "../lib/api";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Select } from "../components/ui/select";
import { Sheet } from "../components/ui/sheet";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
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

  // Change password sheet state
  const [pwSheetOpen, setPwSheetOpen] = createSignal(false);
  const [currentPw, setCurrentPw] = createSignal("");
  const [newPw, setNewPw] = createSignal("");
  const [confirmPw, setConfirmPw] = createSignal("");
  const [pwError, setPwError] = createSignal("");
  const [pwSuccess, setPwSuccess] = createSignal(false);
  const [pwSubmitting, setPwSubmitting] = createSignal(false);

  onMount(() => setCurrency(getCurrency()));

  const onCurrencyChange = (e: Event) => {
    const v = (e.currentTarget as HTMLSelectElement).value;
    setCurrency(v);
    if (typeof localStorage !== "undefined") localStorage.setItem("ledgerify.currency", v);
  };

  function openPwSheet() {
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwError("");
    setPwSuccess(false);
    setPwSheetOpen(true);
  }

  async function handleChangePassword(e: SubmitEvent) {
    e.preventDefault();
    setPwError("");
    if (newPw().length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw() !== confirmPw()) {
      setPwError("New passwords do not match.");
      return;
    }
    setPwSubmitting(true);
    try {
      await api.post("/v1/auth/change-password", {
        current_password: currentPw(),
        new_password: newPw(),
      });
      setPwSuccess(true);
      setTimeout(() => setPwSheetOpen(false), 1500);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setPwSubmitting(false);
    }
  }

  function handleDeleteAccount() {
    if (confirm("Delete your account? This cannot be undone.")) {
      alert("Not available yet");
    }
  }

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
            <Row icon={KeyRound} label="Change password" onClick={openPwSheet} />
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
          <Row icon={Trash2} label="Delete account" danger onClick={handleDeleteAccount} />
        </BentoBlock>

      </div>

      {/* Change Password Sheet */}
      <Sheet open={pwSheetOpen()} onClose={() => setPwSheetOpen(false)} title="Change Password">
        <form onSubmit={handleChangePassword} class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted" for="cp-current">Current Password</label>
            <Input
              id="cp-current"
              type="password"
              required
              value={currentPw()}
              onInput={(e) => setCurrentPw(e.currentTarget.value)}
              autocomplete="current-password"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted" for="cp-new">New Password</label>
            <Input
              id="cp-new"
              type="password"
              minLength={8}
              required
              value={newPw()}
              onInput={(e) => setNewPw(e.currentTarget.value)}
              autocomplete="new-password"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted" for="cp-confirm">Confirm New Password</label>
            <Input
              id="cp-confirm"
              type="password"
              required
              value={confirmPw()}
              onInput={(e) => setConfirmPw(e.currentTarget.value)}
              autocomplete="new-password"
            />
          </div>

          <Show when={pwError()}>
            <p class="text-accent text-sm">{pwError()}</p>
          </Show>
          <Show when={pwSuccess()}>
            <p class="text-primary text-sm font-medium">Password updated.</p>
          </Show>

          <Button type="submit" disabled={pwSubmitting()} class="w-full mt-2">
            {pwSubmitting() ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
