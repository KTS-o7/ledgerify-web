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
  const [color, setColor] = createSignal(props.existing?.color ?? "#CDAE78");
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
        <label for="tag-name" class="text-[12.5px] font-medium text-muted mb-1.5 block">
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
        <label for="tag-color" class="text-[12.5px] font-medium text-muted mb-1.5 block">
          Color
        </label>
        <input
          id="tag-color"
          type="color"
          class="h-11 w-full rounded-input cursor-pointer border border-border-strong bg-surface p-1"
          value={color()}
          onInput={(e) => setColor(e.currentTarget.value)}
        />
      </div>

      <Show when={error()}>
        <p role="alert" class="text-neg text-[13.5px]">{error()}</p>
      </Show>

      <Button type="submit" size="lg" class="w-full" disabled={submitting()}>
        {submitting() ? "Saving…" : props.existing ? "Save changes" : "Save"}
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
        back
        meta={(tags() ?? []).length > 0 ? String((tags() ?? []).length) : undefined}
        actions={
          <Button size="sm" class="h-9" onClick={openSheet} aria-label="Add tag">
            <Plus size={16} /> <span class="hidden md:inline">New tag</span>
          </Button>
        }
      />
      <div class="px-5 md:px-7 py-5 md:py-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Show when={tags.loading}>
            <SkeletonBlock class="h-[60px]" />
            <SkeletonBlock class="h-[60px]" />
            <SkeletonBlock class="h-[60px]" />
            <SkeletonBlock class="h-[60px]" />
          </Show>
          <Show when={!tags.loading && (tags() ?? []).length === 0}>
            <div class="col-span-full">
              <EmptyState
                icon={TagsIcon}
                title="No tags yet"
                body="Create tags to label and filter your transactions."
                action={{ label: "Add tag", onClick: openSheet }}
              />
            </div>
          </Show>
          <For each={tags() ?? []}>
            {(tag) => (
              <BentoBlock class="group flex items-center gap-3 py-3.5 px-4">
                <span
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ "background-color": tag.color || "var(--color-muted)" }}
                  aria-hidden="true"
                />
                <span class="text-[14.5px] font-medium text-text flex-1 min-w-0 truncate">{tag.name}</span>
                <div class="flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity duration-[160ms]">
                  <button type="button" onClick={() => { setEditTag(tag); setEditSheetOpen(true); }} aria-label={`Edit ${tag.name}`} class="w-8 h-8 flex items-center justify-center rounded-[8px] text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => handleDelete(tag.id, tag.name)} aria-label={`Delete ${tag.name}`} class="w-8 h-8 flex items-center justify-center rounded-[8px] text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal hover:text-neg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </BentoBlock>
            )}
          </For>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={closeSheet} title="New tag">
        <TagForm onSuccess={handleSuccess} onClose={closeSheet} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit tag">
        <Show when={editTag()}>
          {(tag) => (
            <TagForm
              existing={{
                id: tag().id,
                name: tag().name,
                color: tag().color || "#A39B8B",
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
