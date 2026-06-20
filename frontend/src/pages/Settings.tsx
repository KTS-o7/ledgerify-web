import { createResource, createSignal, createEffect, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ChevronRight, LogOut, Trash2, FileDown, FileUp, KeyRound, Mail, Globe, Calendar, Sparkles, User2, Plug, Clock } from "lucide-solid";
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

interface MeResponse {
  id: string;
  name: string;
  email: string;
  default_currency: string;
  timezone: string;
}

export default function Settings() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [currency, setCurrency] = createSignal(getCurrency());
  const [dateFormat, setDateFormat] = createSignal(getDateFormat());
  const [timezone, setTimezone] = createSignal("UTC");

  // Fetch fresh profile data from backend
  const [profile] = createResource(() => api.get<MeResponse>("/v1/auth/me").catch(() => null));

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

    try {
      const ids = targets.map((t) => t.id);
      const res = await api.post<{ categorised: number }>(`/v1/transactions/categorise${force}`, {
        transaction_ids: ids,
      });
      setCatState({ mode, total: targets.length, done: targets.length, categorised: res.categorised });
    } catch {
      setCatState({ mode, total: targets.length, done: targets.length, categorised: 0 });
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

  // Sync timezone from profile when it loads
  createEffect(() => {
    const tz = profile()?.timezone;
    if (tz) setTimezone(tz);
  });

  // Delete account state
  const [deleteSheetOpen, setDeleteSheetOpen] = createSignal(false);
  const [deleteConfirmText, setDeleteConfirmText] = createSignal("");
  const [deleteError, setDeleteError] = createSignal("");
  const [deleteSubmitting, setDeleteSubmitting] = createSignal(false);

  function openDeleteSheet() {
    setDeleteConfirmText("");
    setDeleteError("");
    setDeleteSheetOpen(true);
  }

  async function handleDeleteAccount(e: SubmitEvent) {
    e.preventDefault();
    if (deleteConfirmText() !== "DELETE") {
      setDeleteError('Type "DELETE" to confirm.');
      return;
    }
    setDeleteSubmitting(true);
    setDeleteError("");
    try {
      await api.delete("/v1/users/me");
      logout();
      if (typeof localStorage !== "undefined") localStorage.clear();
      navigate("/login");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account.");
      setDeleteSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await api.post("/v1/auth/logout", {});
    } catch {
      // Ignore errors — always log out locally
    }
    logout();
    navigate("/login");
  }

  const onCurrencyChange = async (e: Event) => {
    const v = (e.currentTarget as HTMLSelectElement).value;
    setCurrency(v);
    if (typeof localStorage !== "undefined") localStorage.setItem("ledgerify.currency", v);
    // Persist to backend
    try {
      const currentName = profile()?.name || user()?.name || "";
      const currentTimezone = timezone();
      await api.put("/v1/auth/me", {
        name: currentName,
        default_currency: v,
        timezone: currentTimezone,
      });
    } catch {
      // Silently fail — localStorage update already done
    }
  };

  const onTimezoneChange = async (e: Event) => {
    const v = (e.currentTarget as HTMLSelectElement).value;
    setTimezone(v);
    try {
      const currentName = profile()?.name || user()?.name || "";
      const currentCurrency = currency();
      await api.put("/v1/auth/me", {
        name: currentName,
        default_currency: currentCurrency,
        timezone: v,
      });
    } catch {
      // Silently fail
    }
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
        default_currency: profile()?.default_currency || user()?.default_currency || "INR",
        timezone: timezone(),
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
            <Row icon={User2} label={profile()?.name || user()?.name || "Set your name"} onClick={() => { setNameValue(profile()?.name || user()?.name || ""); setNameSheetOpen(true); }} />
            <Row icon={Mail} label={profile()?.email || user()?.email || "Email"} />
            <Row icon={KeyRound} label="Change password" onClick={openPwSheet} />
            <Row icon={LogOut} label="Logout" danger onClick={handleLogout} />
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
            <div class="flex items-center gap-3 h-14">
              <Clock size={18} class="text-muted" />
              <label for="settings-timezone" class="flex-1 font-body text-base text-text">Timezone</label>
              <Select id="settings-timezone" class="w-44" value={timezone()} onChange={onTimezoneChange}>
                <option value="UTC">UTC</option>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
                <option value="Australia/Sydney">Australia/Sydney</option>
              </Select>
            </div>
          </BentoBlock>
        </div>

        {/* Right column */}
        <BentoBlock>
          <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Data</span>
          <Row icon={FileDown} label="Export all data" onClick={() => navigate("/export")} />
          <Row icon={FileUp} label="Import" onClick={() => navigate("/import")} />
          <Row icon={Plug} label="MCP Connect" onClick={() => navigate("/mcp")} />
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
          <Row icon={Trash2} label="Delete account" danger onClick={openDeleteSheet} />
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

      {/* Delete Account Sheet */}
      <Sheet open={deleteSheetOpen()} onClose={() => setDeleteSheetOpen(false)} title="Delete Account">
        <form onSubmit={handleDeleteAccount} class="flex flex-col gap-4">
          <p class="text-sm text-text">
            This will permanently delete your account and all associated data. This action <strong>cannot be undone</strong>.
          </p>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted" for="delete-confirm">
              Type <span class="font-mono font-bold text-accent">DELETE</span> to confirm
            </label>
            <Input
              id="delete-confirm"
              type="text"
              required
              value={deleteConfirmText()}
              onInput={(e) => setDeleteConfirmText(e.currentTarget.value)}
              autocomplete="off"
            />
          </div>
          <Show when={deleteError()}>
            <p class="text-accent text-sm">{deleteError()}</p>
          </Show>
          <Button
            type="submit"
            disabled={deleteSubmitting() || deleteConfirmText() !== "DELETE"}
            class="w-full mt-2 bg-accent text-white hover:opacity-90 disabled:opacity-50"
          >
            {deleteSubmitting() ? "Deleting…" : "Delete My Account"}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
