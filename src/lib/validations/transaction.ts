import { z } from 'zod'

export const transactionSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3),
  categoryId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isRecurring: z.coerce.boolean().default(false),
  recurrenceRule: z.string().optional(),
  tagIds: z.string().optional(), // comma-separated UUIDs from form
})

export type TransactionInput = z.infer<typeof transactionSchema>
