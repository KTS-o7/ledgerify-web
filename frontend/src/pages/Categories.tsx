import { createResource, createSignal, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Plus, Tag, Trash2, Pencil, Tags, ShoppingCart, House, Car, Utensils, Zap, Heart, Briefcase, Coffee, Plane, Music, Book, Gift, Smartphone, Dumbbell, Pill, GraduationCap, Wallet, TrendingUp, Film, Bus } from "lucide-solid";
import type { Component } from "solid-js";
import { api } from "../lib/api";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { CategoryForm } from "../components/forms/category-form";
import { A } from "@solidjs/router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  icon: string;
  user_id: string | null;
}

const ICON_MAP: Record<string, Component<{ size?: number; class?: string }>> = {
  "shopping-cart": ShoppingCart,
  "house": House,
  "car": Car,
  "utensils": Utensils,
  "zap": Zap,
  "heart": Heart,
  "briefcase": Briefcase,
  "coffee": Coffee,
  "plane": Plane,
  "music": Music,
  "book": Book,
  "gift": Gift,
  "smartphone": Smartphone,
  "dumbbell": Dumbbell,
  "pill": Pill,
  "graduation-cap": GraduationCap,
  "wallet": Wallet,
  "trending-up": TrendingUp,
  "film": Film,
  "bus": Bus,
};

interface Keyword {
  id: string;
  user_id: string;
  category_id: string;
  keyword: string;
  created_at: string;
  category_name: string;
}

export default function Categories() {
  const [categories, { refetch }] = createResource(() => api.get<Category[]>("/v1/categories"));
  const [keywords, { refetch: refetchKeywords }] = createResource(() =>
    api.get<Keyword[]>("/v1/keywords")
  );
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [editCategory, setEditCategory] = createSignal<Category | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);

  // Add keyword form state
  const [newKeyword, setNewKeyword] = createSignal("");
  const [newCategoryId, setNewCategoryId] = createSignal("");
  const [addingKeyword, setAddingKeyword] = createSignal(false);

  function openSheet() { setSheetOpen(true); }
  function closeSheet() { setSheetOpen(false); }
  function handleSuccess() { closeSheet(); refetch(); }

  function closeEdit() { setEditSheetOpen(false); setEditCategory(null); }
  function handleEditSuccess() { closeEdit(); refetch(); }

  const userCategories = () => (categories() ?? []).filter((c) => c.user_id !== null);

  async function handleAddKeyword(e: SubmitEvent) {
    e.preventDefault();
    if (!newKeyword().trim() || !newCategoryId()) return;
    setAddingKeyword(true);
    try {
      await api.post("/v1/keywords", {
        keyword: newKeyword().trim(),
        category_id: newCategoryId(),
      });
      setNewKeyword("");
      setNewCategoryId("");
      refetchKeywords();
    } catch {
      // swallow; let user retry
    } finally {
      setAddingKeyword(false);
    }
  }

  async function handleDeleteKeyword(id: string) {
    try {
      await api.delete(`/v1/keywords/${id}`);
      refetchKeywords();
    } catch {
      // swallow
    }
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Transactions in this category will lose their category.`)) return;
    try {
      await api.delete(`/v1/categories/${id}`);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete category.");
    }
  }

  const iconBtn = "w-8 h-8 flex items-center justify-center rounded-[8px] text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

  return (
    <>
      <PageHeader
        title="Categories"
        meta={userCategories().length > 0 ? String(userCategories().length) : undefined}
        actions={
          <>
            <A href="/tags" class="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] border border-border-strong text-[13px] font-semibold text-text hover:bg-raised transition-colors duration-[160ms]">
              <Tags size={15} /> Tags
            </A>
            <Button size="sm" class="h-9" onClick={openSheet} aria-label="Add category">
              <Plus size={16} /> <span class="hidden md:inline">New category</span>
            </Button>
          </>
        }
      />
      <div class="px-5 md:px-7 py-5 md:py-6 flex flex-col gap-6">
        <A href="/tags" class="md:hidden inline-flex items-center gap-1.5 text-[13.5px] font-medium self-start">
          <Tags size={15} /> Manage tags
        </A>

        <section aria-labelledby="cat-heading" class="flex flex-col gap-3">
          <h2 id="cat-heading" class="font-mono font-medium text-[11px] leading-none uppercase tracking-[0.1em] text-muted">Your categories</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Show when={categories.loading}>
              <SkeletonBlock class="h-[64px]" />
              <SkeletonBlock class="h-[64px]" />
              <SkeletonBlock class="h-[64px]" />
              <SkeletonBlock class="h-[64px]" />
            </Show>
            <Show when={!categories.loading && userCategories().length === 0}>
              <div class="col-span-full">
                <EmptyState
                  icon={Tag}
                  title="No categories yet"
                  body="Create categories to organize your transactions."
                  action={{ label: "Add category", onClick: openSheet }}
                />
              </div>
            </Show>
            <For each={userCategories()}>
              {(cat) => (
                <BentoBlock class="group flex items-center gap-3 py-3.5 px-4">
                  <span
                    class="w-[34px] h-[34px] rounded-[10px] bg-raised flex items-center justify-center shrink-0"
                    style={{ color: cat.color }}
                    aria-hidden="true"
                  >
                    <Show when={cat.icon && ICON_MAP[cat.icon]} fallback={<span class="w-2.5 h-2.5 rounded-full" style={{ "background-color": cat.color }} />}>
                      <Dynamic component={ICON_MAP[cat.icon]!} size={16} />
                    </Show>
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="text-[14.5px] font-medium text-text truncate">{cat.name}</div>
                    <div class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted mt-0.5">{cat.type}</div>
                  </div>
                  <div class="flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity duration-[160ms]">
                    <button type="button" onClick={() => { setEditCategory(cat); setEditSheetOpen(true); }} aria-label={`Edit ${cat.name}`} class={iconBtn}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => handleDeleteCategory(cat.id, cat.name)} aria-label={`Delete ${cat.name}`} class={`${iconBtn} hover:text-neg`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </BentoBlock>
              )}
            </For>
          </div>
        </section>

        {/* Auto-categorization rules */}
        <BentoBlock class="max-w-2xl">
          <div class="mb-4">
            <h2 class="font-display text-[24px] leading-none text-text">Auto-categorization rules</h2>
            <p class="text-[13.5px] text-muted mt-2 text-pretty">
              Keywords matched against transaction titles before AI categorization.
            </p>
          </div>

          <Show when={keywords.loading}>
            <SkeletonBlock class="h-10 mb-2" />
            <SkeletonBlock class="h-10 mb-2" />
          </Show>
          <Show when={!keywords.loading}>
            <div class="mb-4">
              <Show
                when={(keywords() ?? []).length > 0}
                fallback={<p class="text-[13.5px] text-muted py-3">No rules yet. Add one below.</p>}
              >
                <ul>
                  <For each={keywords() ?? []}>
                    {(kw) => (
                      <li class="flex items-center gap-3 h-11 border-b border-border last:border-0">
                        <span class="flex-1 min-w-0 truncate font-mono text-[13px] text-text">{kw.keyword}</span>
                        <span class="text-[13px] text-muted truncate">→ {kw.category_name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteKeyword(kw.id)}
                          class={`${iconBtn} hover:text-neg`}
                          aria-label={`Delete rule for ${kw.keyword}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </div>
          </Show>

          <form onSubmit={handleAddKeyword} class="flex items-center gap-2 flex-wrap">
            <label class="sr-only" for="kw-input">Keyword</label>
            <Input
              id="kw-input"
              type="text"
              value={newKeyword()}
              onInput={(e) => setNewKeyword(e.currentTarget.value)}
              placeholder="Keyword, e.g. swiggy"
              class="flex-1 min-w-[140px] h-9 text-[14px] font-mono"
            />
            <label class="sr-only" for="kw-category">Category</label>
            <Select
              id="kw-category"
              value={newCategoryId()}
              onChange={(e) => setNewCategoryId(e.currentTarget.value)}
              class="w-auto h-9 text-[14px]"
            >
              <option value="">Select category…</option>
              <For each={categories() ?? []}>
                {(cat) => <option value={cat.id}>{cat.name}</option>}
              </For>
            </Select>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              class="h-9"
              disabled={addingKeyword() || !newKeyword().trim() || !newCategoryId()}
            >
              {addingKeyword() ? "Adding…" : "Add rule"}
            </Button>
          </form>
        </BentoBlock>
      </div>

      <Sheet open={sheetOpen()} onClose={closeSheet} title="New category">
        <CategoryForm onSuccess={handleSuccess} onClose={closeSheet} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit category">
        <Show when={editCategory()}>
          {(cat) => (
            <CategoryForm
              existing={{
                id: cat().id,
                name: cat().name,
                type: cat().type as "income" | "expense",
                color: cat().color,
                icon: cat().icon,
              }}
              onSuccess={handleEditSuccess}
              onClose={closeEdit}
            />
          )}
        </Show>
      </Sheet>
    </>
  );
}
