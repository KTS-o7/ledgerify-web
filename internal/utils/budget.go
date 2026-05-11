package utils

import (
	"math"
	"time"
)

type BudgetPeriodInfo struct {
	Start          time.Time
	End            time.Time
	DaysRemaining  int
	DailyAllowance float64
	IsOverspent    bool
	OverspentBy    float64
	Spent          float64
	Remaining      float64
	SpentPct       float64
}

type BudgetInfo struct {
	ID          string
	Name        string
	Amount      float64
	Currency    string
	Spent       float64
	Remaining   float64
	SpentPct    float64
	PeriodStart string
	PeriodEnd   string
	DaysRemaining int
	DailyAllowance float64
	IsOverspent bool
	OverspentBy float64
}

func GetBudgetPeriod(startDate time.Time, periodType string, anchorDate *time.Time) (start, end time.Time) {
	now := time.Now()
	switch periodType {
	case "monthly":
		if anchorDate != nil {
			start = time.Date(now.Year(), now.Month(), anchorDate.Day(), 0, 0, 0, 0, now.Location())
			if start.After(now) {
				start = start.AddDate(0, -1, 0)
			}
			end = start.AddDate(0, 1, 0).Add(-time.Nanosecond)
		} else {
			start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
			end = time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Nanosecond)
		}
	case "weekly":
		weekday := now.Weekday()
		if weekday == time.Sunday {
			weekday = 7
		}
		start = now.AddDate(0, 0, -int(weekday-time.Monday))
		start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, now.Location())
		end = start.AddDate(0, 0, 7).Add(-time.Nanosecond)
	default:
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		end = time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Nanosecond)
	}
	return start, end
}

func CalculateBudgetHealth(amount, spent float64, start, end time.Time) BudgetPeriodInfo {
	now := time.Now()
	remaining := amount - spent
	daysElapsed := now.Sub(start).Hours() / 24
	daysRemaining := int(math.Ceil(end.Sub(now).Hours() / 24))
	if daysRemaining < 0 {
		daysRemaining = 0
	}

	var dailyAllowance, overspentBy float64
	var isOverspent bool

	if daysRemaining > 0 {
		dailyAllowance = remaining / float64(daysRemaining)
	}
	if spent > amount {
		isOverspent = true
		overspentBy = spent - amount
	}

	spentPct := 0.0
	if amount > 0 {
		spentPct = math.Round((spent / amount) * 100)
	}

	if daysElapsed < 0 {
		daysElapsed = 0
	}

	return BudgetPeriodInfo{
		Start:          start,
		End:            end,
		DaysRemaining:  daysRemaining,
		DailyAllowance: math.Round(dailyAllowance),
		IsOverspent:    isOverspent,
		OverspentBy:    math.Round(overspentBy),
		Spent:          math.Round(spent),
		Remaining:      math.Round(remaining),
		SpentPct:       spentPct,
	}
}
