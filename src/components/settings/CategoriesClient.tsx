'use client'
import { useTransition, useActionState } from 'react'
import { createCategory, deleteCategory } from '@/app/actions/settings'
import {
  EmptyState,
  IconBadge,
  SectionHeader,
  StatusPill,
  TonalWidget,
} from '@/components/shared/quiet-ledger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ArrowDownRight, ArrowUpRight, FolderTree, Plus, Trash2 } from 'lucide-react'
import type { Category } from '@/lib/db/schema'

interface CategoriesClientProps {
  incomeCategories: Category[]
  expenseCategories: Category[]
  userId: string
}

function AddCategoryForm() {
  const [state, action, pending] = useActionState(createCategory, null)

  return (
    <form action={action} className="mt-5 space-y-5 px-4">
      <div className="space-y-1">
        <Label htmlFor="cat-name">Name</Label>
        <Input id="cat-name" name="name" required placeholder="Groceries, salary, school" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cat-type">Type</Label>
        <select
          id="cat-type"
          name="type"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          defaultValue="expense"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cat-color">Color</Label>
        <Input id="cat-color" name="color" placeholder="#3b82f6" maxLength={7} />
      </div>
      {state && 'error' in state && state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full rounded-2xl">
        {pending ? 'Adding…' : 'Add category'}
      </Button>
    </form>
  )
}

function DeleteCategoryButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(() => void deleteCategory(id))
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-2xl text-muted-foreground hover:text-destructive"
            aria-label="Delete category"
          />
        }
      >
        <Trash2 className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete category?</DialogTitle>
          <DialogDescription>
            This category will be removed. Existing transactions will keep their category label but you won&apos;t be able to select it for new ones. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryRow({ category, userId }: { category: Category; userId: string }) {
  const isOwned = category.userId === userId
  const tone = category.type === 'income' ? 'positive' : 'negative'
  const Icon = category.type === 'income' ? ArrowUpRight : ArrowDownRight

  return (
    <TonalWidget tone={tone} className="flex items-center justify-between gap-3 p-4 sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <IconBadge icon={Icon} tone={tone} className="size-11" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {category.color && (
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: category.color }}
              />
            )}
            <p className="truncate text-sm font-semibold">{category.name}</p>
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <StatusPill tone={tone} className="capitalize">
              {category.type}
            </StatusPill>
            {!isOwned && <StatusPill>System</StatusPill>}
          </div>
        </div>
      </div>
      {isOwned && <DeleteCategoryButton id={category.id} />}
    </TonalWidget>
  )
}

export function CategoriesClient({ incomeCategories, expenseCategories, userId }: CategoriesClientProps) {
  return (
    <section className="space-y-6">
      <SectionHeader
        title="Categories"
        description="Simple labels make spending and income easier for everyone to understand."
        action={
        <Sheet>
          <SheetTrigger render={<Button size="sm" className="rounded-2xl" />}>
            <Plus className="h-4 w-4 mr-1" />
            Add category
          </SheetTrigger>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>New category</SheetTitle>
              <SheetDescription>
                Add only labels you will recognize later while reviewing money movement.
              </SheetDescription>
            </SheetHeader>
            <AddCategoryForm />
          </SheetContent>
        </Sheet>
        }
      />

      {incomeCategories.length === 0 && expenseCategories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="Create your first category"
          description="Categories turn a transaction list into a readable family money story."
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <SectionHeader
            title="Income"
            description={`${incomeCategories.length} source${incomeCategories.length === 1 ? '' : 's'} of money.`}
          />
          {incomeCategories.length === 0 ? (
            <p className="rounded-3xl border border-dashed bg-card/60 p-6 text-sm text-muted-foreground">
              No income categories yet.
            </p>
          ) : (
            <div className="space-y-3">
              {incomeCategories.map((category) => (
                <CategoryRow key={category.id} category={category} userId={userId} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <SectionHeader
            title="Expense"
            description={`${expenseCategories.length} spending label${expenseCategories.length === 1 ? '' : 's'}.`}
          />
          {expenseCategories.length === 0 ? (
            <p className="rounded-3xl border border-dashed bg-card/60 p-6 text-sm text-muted-foreground">
              No expense categories yet.
            </p>
          ) : (
            <div className="space-y-3">
              {expenseCategories.map((category) => (
                <CategoryRow key={category.id} category={category} userId={userId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
