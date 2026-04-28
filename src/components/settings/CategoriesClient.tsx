'use client'
import { useTransition, useActionState } from 'react'
import { createCategory, deleteCategory } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Plus, Trash2 } from 'lucide-react'
import type { Category } from '@/lib/db/schema'

interface CategoriesClientProps {
  incomeCategories: Category[]
  expenseCategories: Category[]
  userId: string
}

function AddCategoryForm() {
  const [state, action, pending] = useActionState(createCategory, null)

  return (
    <form action={action} className="space-y-4 px-4 mt-4">
      <div className="space-y-1">
        <Label htmlFor="cat-name">Name</Label>
        <Input id="cat-name" name="name" required placeholder="e.g. Groceries" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cat-type">Type</Label>
        <select
          id="cat-type"
          name="type"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          defaultValue="expense"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cat-color">Color (optional)</Label>
        <Input id="cat-color" name="color" placeholder="#3b82f6" maxLength={7} />
      </div>
      {state && 'error' in state && state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Adding…' : 'Add Category'}
      </Button>
    </form>
  )
}

function DeleteCategoryButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      onClick={() => startTransition(() => void deleteCategory(id))}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  )
}

function CategoryRow({ category, userId }: { category: Category; userId: string }) {
  const isOwned = category.userId === userId
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3">
        {category.color && (
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
        )}
        <p className="text-sm font-medium">{category.name}</p>
        {!isOwned && <Badge variant="outline" className="text-xs">system</Badge>}
      </div>
      {isOwned && <DeleteCategoryButton id={category.id} />}
    </div>
  )
}

export function CategoriesClient({ incomeCategories, expenseCategories, userId }: CategoriesClientProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Sheet>
          <SheetTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>New Category</SheetTitle>
            </SheetHeader>
            <AddCategoryForm />
          </SheetContent>
        </Sheet>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Income</h3>
        {incomeCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No income categories.</p>
        ) : (
          <div className="space-y-2">
            {incomeCategories.map(cat => (
              <CategoryRow key={cat.id} category={cat} userId={userId} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Expense</h3>
        {expenseCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expense categories.</p>
        ) : (
          <div className="space-y-2">
            {expenseCategories.map(cat => (
              <CategoryRow key={cat.id} category={cat} userId={userId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
