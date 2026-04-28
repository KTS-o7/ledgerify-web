import { z } from 'zod'

export const budgetSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3),
  periodType: z.enum(['monthly', 'weekly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().optional(),
})

export const savingsGoalSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  targetAmount: z.coerce.number().positive(),
  currency: z.string().length(3),
  linkedAccountId: z.string().uuid().optional(),
  deadline: z.string().optional(),
})
