import { createResource, createSignal, For, Show } from "solid-js";
import { Tags as TagsIcon, Plus, Pencil, Trash2 } from "lucide-solid";
import { api } from "../lib/api";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

interface Tag {
  id: string;
  name: string;
  color: string;
  user_id: string;
}

function TagForm(props: {
  onSuccess: () => void;
  onClose: () => void;
  existing?: { id: string; name: string; color: string };
}) {
  const [name, setName] = createSignal(props.existing?.name ?? "");
  const [color, setColor] = createSignal(props.existing?.color ?? "#CCFF00");
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError("");
    if (!name().trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const body = { name: name().trim(), color: color() };
      if (props.existing) {
        await api.put(`/v1/tags/${props.existing.id}`, body);
      } else {
        await api.post("/v1/tags", body);
      }
      props.onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      <div>
        <label for="tag-name" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Name
        </label>
        <Input
          id="tag-name"
          type="text"
          placeholder="e.g. Work, Personal"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          required
        />
      </div>

      <div>
        <label for="tag-color" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Color
        </label>
        <input
          id="tag-color"
          type="color"
          class="h-12 w-full rounded-input cursor-pointer border border-border bg-surface"
          value={color()}
          onInput={(e) => setColor(e.currentTarget.value)}
        />
      </div>

      <Show when={error()}>
        <p class="text-accent text-sm">{error()}</p>
      </Show>

      <Button type="submit" class="w-full" disabled={submitting()}>
        {submitting() ? "Saving…" : props.existing ? "Save Changes" : "Save"}
      </Button>
    </form>
  );
}

export default function Tags() {
  const [tags, { refetch }] = createResource(() => api.get<Tag[]>("/v1/tags"));
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [editTag, setEditTag] = createSignal<Tag | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);

  function openSheet() { setSheetOpen(true); }
  function closeSheet() { setSheetOpen(false); }
  function handleSuccess() { closeSheet(); refetch(); }

  function closeEdit() { setEditSheetOpen(false); setEditTag(null); }
  function handleEditSuccess() { closeEdit(); refetch(); }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete tag "${name}"?`)) return;
    try {
      await api.delete(`/v1/tags/${id}`);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete tag.");
    }
  }

  return (
    <>
      <PageHeader
        title="Tags"
        actions={
          <button
            type="button"
            aria-label="Add tag"
            onClick={openSheet}
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Plus size={20} />
          </button>
        }
      />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Show when={tags.loading}>
            <SkeletonBlock class="min-h-[80px]" />
            <SkeletonBlock class="min-h-[80px]" />
            <SkeletonBlock class="min-h-[80px]" />
            <SkeletonBlock class="min-h-[80px]" />
          </Show>
          <Show when={!tags.loading && (tags() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2 lg:col-span-4">
              <EmptyState
                icon={TagsIcon}
                title="No tags yet"
                body="Create tags to label and filter your transactions."
                action={{ label: "Add Tag", onClick: openSheet }}
              />
            </div>
          </Show>
          <For each={tags() ?? []}>
            {(tag) => (
              <div class="group relative">
                <BentoBlock variant="default">
                  <div class="flex items-center gap-3">
                    <span
                      class="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ "background-color": tag.color || "#888888" }}
                    />
                    <span class="font-display font-semibold text-text flex-1">{tag.name}</span>
                  </div>
                </BentoBlock>
                <div class="absolute top-3 right-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditTag(tag); setEditSheetOpen(true); }}
                    aria-label={`Edit ${tag.name}`}
                    class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(tag.id, tag.name); }}
                    aria-label={`Delete ${tag.name}`}
                    class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={closeSheet} title="New Tag">
        <TagForm onSuccess={handleSuccess} onClose={closeSheet} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit Tag">
        <Show when={editTag()}>
          {(tag) => (
            <TagForm
              existing={{
                id: tag().id,
                name: tag().name,
                color: tag().color || "#888888",
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
