import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, Tag } from "lucide-solid";
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

export default function Categories() {
  const [categories, { refetch }] = createResource(() => api.get<Category[]>("/v1/categories"));
  const [sheetOpen, setSheetOpen] = createSignal(false);

  function openSheet() { setSheetOpen(true); }
  function closeSheet() { setSheetOpen(false); }
  function handleSuccess() { closeSheet(); refetch(); }

  const userCategories = () => (categories() ?? []).filter((c) => c.user_id !== null);

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
      <div class="p-4 md:p-6">
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
      </div>

      <Sheet open={sheetOpen()} onClose={closeSheet} title="Add Category">
        <CategoryForm onSuccess={handleSuccess} onClose={closeSheet} />
      </Sheet>
    </>
  );
}
