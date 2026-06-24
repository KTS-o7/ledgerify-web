package recurring

import (
	"fmt"
	"time"
)

func ComputeNext(last time.Time, frequency string, intervalValue *int, intervalUnit *string) time.Time {
	switch frequency {
	case "weekly":
		return last.AddDate(0, 0, 7)
	case "monthly":
		return addMonths(last, 1)
	case "custom":
		if intervalValue == nil || intervalUnit == nil || *intervalValue <= 0 {
			return last
		}
		switch *intervalUnit {
		case "day":
			return last.AddDate(0, 0, *intervalValue)
		case "week":
			return last.AddDate(0, 0, *intervalValue*7)
		case "month":
			return addMonths(last, *intervalValue)
		}
	}
	return last
}

func addMonths(t time.Time, n int) time.Time {
	y, m, d := t.Date()
	totalMonths := int(m) + n
	newYear := y + (totalMonths-1)/12
	newMonth := time.Month(((totalMonths-1)%12)+1)
	target := time.Date(newYear, newMonth, 1, 0, 0, 0, 0, t.Location())
	lastDay := time.Date(target.Year(), target.Month()+1, 0, 0, 0, 0, 0, t.Location()).Day()
	if d > lastDay {
		d = lastDay
	}
	return time.Date(target.Year(), target.Month(), d, 0, 0, 0, 0, t.Location())
}

func GenerateOccurrences(start, asOf time.Time, frequency string, intervalValue *int, intervalUnit *string, endDate *time.Time) []time.Time {
	start = startOnly(start)
	asOf = startOnly(asOf)
	var dates []time.Time
	cur := start
	safety := 0
	for !cur.After(asOf) {
		if safety > 10000 {
			return dates
		}
		if endDate != nil && cur.After(startOnly(*endDate)) {
			break
		}
		dates = append(dates, cur)
		cur = ComputeNext(cur, frequency, intervalValue, intervalUnit)
		safety++
	}
	return dates
}

func startOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func StringFrequency(s string) (string, error) {
	switch s {
	case "weekly", "monthly", "custom":
		return s, nil
	}
	return "", fmt.Errorf("invalid frequency %q (want weekly|monthly|custom)", s)
}
