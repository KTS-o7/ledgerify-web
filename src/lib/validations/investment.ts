import { z } from 'zod'

export const investmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  assetType: z.enum(['stock', 'mf', 'crypto', 'fd', 'ppf', 'nps', 'gold', 'silver', 'real_estate', 'savings', 'other']),
  currency: z.string().length(3),
  quantity: z.coerce.number().optional(),
  buyPrice: z.coerce.number().optional(),
  currentPrice: z.coerce.number().optional(),
  maturityDate: z.string().optional(),
  interestRate: z.coerce.number().optional(),
})

export const investmentTxSchema = z.object({
  investmentId: z.string().uuid(),
  type: z.enum(['buy', 'sell', 'dividend', 'interest', 'bonus']),
  quantity: z.coerce.number().optional(),
  price: z.coerce.number().optional(),
  amount: z.coerce.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
})
