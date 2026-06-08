import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, Tag, Trash2 } from "lucide-solid";
import { api } from "../lib/api";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { CategoryForm } from "../components/forms/category-form";

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  user_id: string | null;
}

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

  // Add keyword form state
  const [newKeyword, setNewKeyword] = createSignal("");
  const [newCategoryId, setNewCategoryId] = createSignal("");
  const [addingKeyword, setAddingKeyword] = createSignal(false);

  function openSheet() { setSheetOpen(true); }
  function closeSheet() { setSheetOpen(false); }
  function handleSuccess() { closeSheet(); refetch(); }

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

  return (
    <>
      <PageHeader
        title="Categories"
        actions={
          <button
            type="button"
            aria-label="Add category"
            onClick={openSheet}
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Plus size={20} />
          </button>
        }
      />
      <div class="p-4 md:p-6 space-y-6">
        {/* Categories grid */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Show when={categories.loading}>
            <SkeletonBlock class="min-h-[80px]" />
            <SkeletonBlock class="min-h-[80px]" />
            <SkeletonBlock class="min-h-[80px]" />
            <SkeletonBlock class="min-h-[80px]" />
          </Show>
          <Show when={!categories.loading && userCategories().length === 0}>
            <div class="col-span-1 md:col-span-2 lg:col-span-4">
              <EmptyState
                icon={Tag}
                title="No categories yet"
                body="Create categories to organize your transactions."
                action={{ label: "Add Category", onClick: openSheet }}
              />
            </div>
          </Show>
          <For each={userCategories()}>
            {(cat) => (
              <BentoBlock variant="default">
                <div class="flex items-center gap-3">
                  <span
                    class="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ "background-color": cat.color }}
                  />
                  <span class="font-display font-semibold text-text flex-1">{cat.name}</span>
                  <span class="text-[12px] font-body uppercase tracking-wide text-muted">
                    {cat.type}
                  </span>
                </div>
              </BentoBlock>
            )}
          </For>
        </div>

        {/* Auto-categorization rules */}
        <BentoBlock variant="default" class="max-w-2xl">
          <div class="mb-4">
            <h2 class="font-display font-semibold text-text text-base">Auto-categorization Rules</h2>
            <p class="text-sm text-muted mt-0.5">
              Keywords matched against transaction titles before AI categorization.
            </p>
          </div>

          {/* Keyword list */}
          <Show when={keywords.loading}>
            <SkeletonBlock class="h-10 mb-2" />
            <SkeletonBlock class="h-10 mb-2" />
          </Show>
          <Show when={!keywords.loading}>
            <div class="mb-4">
              <Show
                when={(keywords() ?? []).length > 0}
                fallback={
                  <p class="text-sm text-muted py-3">No rules yet. Add one below.</p>
                }
              >
                <For each={keywords() ?? []}>
                  {(kw) => (
                    <div class="flex items-center gap-3 h-12 border-b border-border last:border-0">
                      <span class="flex-1 font-mono text-sm text-text">{kw.keyword}</span>
                      <span class="text-sm text-muted">{kw.category_name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteKeyword(kw.id)}
                        class="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-accent transition-colors"
                        aria-label={`Delete rule for ${kw.keyword}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </Show>

          {/* Add keyword form */}
          <form onSubmit={handleAddKeyword} class="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={newKeyword()}
              onInput={(e) => setNewKeyword(e.currentTarget.value)}
              placeholder="Keyword"
              class="flex-1 min-w-[120px] h-9 px-3 rounded-lg border border-border bg-bg text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={newCategoryId()}
              onChange={(e) => setNewCategoryId(e.currentTarget.value)}
              class="h-9 px-3 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select category…</option>
              <For each={categories() ?? []}>
                {(cat) => (
                  <option value={cat.id}>{cat.name}</option>
                )}
              </For>
            </select>
            <button
              type="submit"
              disabled={addingKeyword() || !newKeyword().trim() || !newCategoryId()}
              class="h-9 px-4 rounded-lg bg-surface border border-border text-sm font-medium text-text hover:bg-surface-hover active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Show when={addingKeyword()} fallback="Add">
                Adding…
              </Show>
            </button>
          </form>
        </BentoBlock>
      </div>

      <Sheet open={sheetOpen()} onClose={closeSheet} title="Add Category">
        <CategoryForm onSuccess={handleSuccess} onClose={closeSheet} />
      </Sheet>
    </>
  );
}
