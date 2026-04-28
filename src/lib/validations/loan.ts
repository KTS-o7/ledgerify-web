import { z } from 'zod'

export const loanSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  loanType: z.enum(['home', 'personal', 'vehicle', 'education', 'other']),
  principal: z.coerce.number().positive(),
  interestRate: z.coerce.number().positive(),
  tenureMonths: z.coerce.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  emiAmount: z.coerce.number().positive(),
  currency: z.string().length(3),
})

export const loanPaymentSchema = z.object({
  loanId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive(),
  principalComponent: z.coerce.number().optional(),
  interestComponent: z.coerce.number().optional(),
  status: z.enum(['scheduled', 'paid', 'missed', 'partial']),
})
