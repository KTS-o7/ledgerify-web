import { z } from 'zod'

const optionalPositiveNumber = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().positive().optional(),
)

export const investmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  assetType: z.enum(['stock', 'mf', 'crypto', 'fd', 'ppf', 'nps', 'gold', 'silver', 'real_estate', 'savings', 'other']),
  currency: z.string().length(3),
  quantity: optionalPositiveNumber,
  buyPrice: optionalPositiveNumber,
  currentPrice: optionalPositiveNumber,
  maturityDate: z.string().optional(),
  interestRate: optionalPositiveNumber,
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

export type InvestmentInput = z.infer<typeof investmentSchema>
export type InvestmentTxInput = z.infer<typeof investmentTxSchema>
