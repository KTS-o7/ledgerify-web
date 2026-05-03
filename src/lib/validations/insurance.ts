import { z } from 'zod'

export const insuranceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  provider: z.string().optional(),
  policyType: z.enum(['life', 'health', 'vehicle', 'property', 'term', 'other']),
  premiumAmount: z.coerce.number().positive(),
  premiumFrequency: z.enum(['monthly', 'quarterly', 'annual']),
  coverageAmount: z.coerce.number().optional(),
  currency: z.string().length(3),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  renewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nominee: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (d) => !d.endDate || !d.startDate || d.endDate >= d.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] },
)

export const insurancePaymentSchema = z.object({
  policyId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive(),
  status: z.enum(['paid', 'due', 'missed']),
})
