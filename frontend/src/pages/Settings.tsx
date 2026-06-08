import { createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ChevronRight, LogOut, Trash2, FileDown, FileUp, KeyRound, Mail, Globe, Calendar, Sparkles, User2 } from "lucide-solid";
import { useAuth } from "../lib/store";
import { api } from "../lib/api";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Select } from "../components/ui/select";
import { Sheet } from "../components/ui/sheet";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { getCurrency, getDateFormat } from "../lib/format";

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
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [currency, setCurrency] = createSignal(getCurrency());
  const [dateFormat, setDateFormat] = createSignal(getDateFormat());

  // Change password sheet state
  const [pwSheetOpen, setPwSheetOpen] = createSignal(false);
  const [currentPw, setCurrentPw] = createSignal("");
  const [newPw, setNewPw] = createSignal("");
  const [confirmPw, setConfirmPw] = createSignal("");
  const [pwError, setPwError] = createSignal("");
  const [pwSuccess, setPwSuccess] = createSignal(false);
  const [pwSubmitting, setPwSubmitting] = createSignal(false);

  // Edit name sheet state
  const [nameSheetOpen, setNameSheetOpen] = createSignal(false);
  const [nameValue, setNameValue] = createSignal("");
  const [nameError, setNameError] = createSignal("");
  const [nameSubmitting, setNameSubmitting] = createSignal(false);

  // Categorization state
  type CatState = { mode: "fix" | "all" | null; total: number; done: number; categorised: number };
  const [catState, setCatState] = createSignal<CatState>({ mode: null, total: 0, done: 0, categorised: 0 });

  async function runCategorization(mode: "fix" | "all") {
    const txns = await api.get<Array<{ id: string; category_id: string | null }>>("/v1/transactions?limit=500");
    const targets = mode === "fix"
      ? txns.filter((t) => !t.category_id)
      : txns;

    if (targets.length === 0) {
      alert("All transactions are already categorized.");
      return;
    }

    setCatState({ mode, total: targets.length, done: 0, categorised: 0 });
    const force = mode === "all" ? "?force=true" : "";
    let totalCategorised = 0;

    for (let i = 0; i < targets.length; i++) {
      try {
        const res = await api.post<{ categorised: number }>(`/v1/transactions/categorise${force}`, {
          transaction_ids: [targets[i].id],
        });
        totalCategorised += res.categorised;
      } catch {
        // silently skip failed transactions
      }
      setCatState({ mode, total: targets.length, done: i + 1, categorised: totalCategorised });
    }

    setTimeout(() => setCatState({ mode: null, total: 0, done: 0, categorised: 0 }), 3000);
  }

  async function handleFixUncategorized() {
    await runCategorization("fix");
  }

  async function handleRecategorizeAll() {
    if (!confirm("This will overwrite all existing categories using AI. Continue?")) return;
    await runCategorization("all");
  }

  onMount(() => {
    setCurrency(getCurrency());
    setDateFormat(getDateFormat());
  });

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

  async function handleUpdateName(e: SubmitEvent) {
    e.preventDefault();
    setNameError("");
    if (!nameValue().trim()) {
      setNameError("Name cannot be empty.");
      return;
    }
    setNameSubmitting(true);
    try {
      await api.put("/v1/auth/me", {
        name: nameValue().trim(),
        default_currency: user()?.default_currency || "INR",
        timezone: user()?.timezone || "UTC",
      });
      updateUser({ name: nameValue().trim() });
      setNameSheetOpen(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update name.");
    } finally {
      setNameSubmitting(false);
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
            <Row icon={User2} label={user()?.name || "Set your name"} onClick={() => { setNameValue(user()?.name || ""); setNameSheetOpen(true); }} />
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
              <Select id="settings-date-format" class="w-32" value={dateFormat()} onChange={(e) => {
                const v = (e.currentTarget as HTMLSelectElement).value;
                setDateFormat(v);
                if (typeof localStorage !== "undefined") localStorage.setItem("ledgerify.dateformat", v);
              }}>
                <option value="MMM DD">MMM DD</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </Select>
            </div>
          </BentoBlock>
        </div>

        {/* Right column */}
        <BentoBlock>
          <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Data</span>
          <Row icon={FileDown} label="Export all data" onClick={() => navigate("/export")} />
          <Row icon={FileUp} label="Import" onClick={() => navigate("/import")} />
          <Row
            icon={Sparkles}
            label={
              catState().mode === "fix"
                ? `Categorizing ${catState().done} / ${catState().total}…`
                : catState().mode === null && catState().categorised > 0
                ? `Done. ${catState().categorised} categorized.`
                : "Fix uncategorized"
            }
            onClick={catState().mode === null ? handleFixUncategorized : undefined}
          />
          <Row
            icon={Sparkles}
            label={
              catState().mode === "all"
                ? `Re-categorizing ${catState().done} / ${catState().total}…`
                : "Re-categorize all"
            }
            onClick={catState().mode === null ? handleRecategorizeAll : undefined}
          />
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

      {/* Edit Name Sheet */}
      <Sheet open={nameSheetOpen()} onClose={() => setNameSheetOpen(false)} title="Edit Name">
        <form onSubmit={handleUpdateName} class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted" for="name-input">Display Name</label>
            <Input
              id="name-input"
              type="text"
              required
              value={nameValue()}
              onInput={(e) => setNameValue(e.currentTarget.value)}
              autocomplete="name"
            />
          </div>
          <Show when={nameError()}>
            <p class="text-accent text-sm">{nameError()}</p>
          </Show>
          <Button type="submit" disabled={nameSubmitting()} class="w-full mt-2">
            {nameSubmitting() ? "Saving…" : "Save Name"}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
