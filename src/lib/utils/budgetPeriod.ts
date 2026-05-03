import { addDays, addMonths, addWeeks, startOfDay, isAfter, differenceInDays } from 'date-fns'
import type { Budget } from '@/lib/db/schema'

export interface BudgetPeriod {
  start: Date
  end: Date
  totalDays: number
  daysElapsed: number
  daysRemaining: number
  progressPct: number  // 0-100 time-elapsed pct
}

export function getBudgetPeriod(budget: Budget, today = new Date()): BudgetPeriod {
  const anchor = budget.periodAnchorDate
    ? startOfDay(new Date(budget.periodAnchorDate))
    : startOfDay(new Date(budget.startDate))

  let periodStart = anchor
  let periodEnd: Date

  if (budget.periodType === 'monthly') {
    // Advance forward month by month until we find the window containing today
    // If anchor is in the future, step backward
    while (true) {
      periodEnd = addDays(addMonths(periodStart, 1), -1)
      if (!isAfter(periodStart, today) && !isAfter(today, periodEnd)) break
      if (isAfter(periodStart, today)) {
        periodStart = addMonths(periodStart, -1)
        periodEnd = addDays(addMonths(periodStart, 1), -1)
        break
      }
      periodStart = addMonths(periodStart, 1)
    }
  } else {
    // weekly
    while (true) {
      periodEnd = addDays(addWeeks(periodStart, 1), -1)
      if (!isAfter(periodStart, today) && !isAfter(today, periodEnd)) break
      if (isAfter(periodStart, today)) {
        periodStart = addWeeks(periodStart, -1)
        periodEnd = addDays(addWeeks(periodStart, 1), -1)
        break
      }
      periodStart = addWeeks(periodStart, 1)
    }
  }

  const totalDays = differenceInDays(periodEnd, periodStart) + 1
  const daysElapsed = Math.max(0, differenceInDays(today, periodStart) + 1)
  const daysRemaining = Math.max(0, differenceInDays(periodEnd, today))

  return {
    start: periodStart,
    end: periodEnd,
    totalDays,
    daysElapsed,
    daysRemaining,
    progressPct: Math.min(100, (daysElapsed / totalDays) * 100),
  }
}

export function getDailyAllowance(budget: Budget, spent: number, today = new Date()) {
  const period = getBudgetPeriod(budget, today)
  const remaining = Number(budget.amount) - spent
  const isOverspent = remaining < 0
  return {
    dailyAllowance: period.daysRemaining > 0 ? Math.max(0, remaining / period.daysRemaining) : 0,
    daysRemaining: period.daysRemaining,
    isOverspent,
    overspentBy: isOverspent ? Math.abs(remaining) : 0,
  }
}
