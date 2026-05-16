package templates

import (
	"fmt"
	"html/template"
	"strings"
	"time"
)

var funcMap = template.FuncMap{
	"formatCurrency":      formatCurrency,
	"formatCurrencyShort": formatCurrencyShort,
	"formatDate":          formatDate,
	"formatDateShort":     formatDateShort,
	"formatPercent":       formatPercent,
	"formatAmount":        formatAmount,
	"amountClass":         amountClass,
	"dict":                dict,
	"safeHTML":            safeHTML,
	"safeAttr":            safeAttr,
	"add":                 add,
	"sub":                 sub,
	"mul":                 mul,
	"div":                 div,
	"eqStr":               eqStr,
	"contains":            strings.Contains,
	"hasPrefix":           strings.HasPrefix,
	"now":                 time.Now,
	"since":               time.Since,
	"until":               time.Until,
	"defaultStr":          defaultStr,
	"ternary":             ternary,
}

// formatCurrency formats a float as currency (e.g., $1,234.56).
func formatCurrency(amount float64, currency string) string {
	symbol := currencySymbol(currency)
	absAmount := amount
	sign := ""
	if absAmount < 0 {
		sign = "-"
		absAmount = -absAmount
	}
	return fmt.Sprintf("%s%s%s", sign, symbol, withSeparators(fmt.Sprintf("%.2f", absAmount)))
}

// withSeparators inserts thousands commas into a formatted number string.
func withSeparators(s string) string {
	parts := strings.SplitN(s, ".", 2)
	intPart := parts[0]
	n := len(intPart)
	if n <= 3 {
		return s
	}
	var b strings.Builder
	b.Grow(n + n/3 + len(parts) - 1)
	for i, ch := range intPart {
		if i > 0 && (n-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteByte(byte(ch))
	}
	if len(parts) > 1 {
		b.WriteByte('.')
		b.WriteString(parts[1])
	}
	return b.String()
}

// formatCurrencyShort formats a float as compact currency (e.g., $1.2K).
func formatCurrencyShort(amount float64, currency string) string {
	symbol := currencySymbol(currency)
	sign := ""
	absAmount := amount
	if absAmount < 0 {
		sign = "-"
		absAmount = -absAmount
	}
	if absAmount >= 1_000_000 {
		return fmt.Sprintf("%s%s%.1fM", sign, symbol, absAmount/1_000_000)
	}
	if absAmount >= 1_000 {
		return fmt.Sprintf("%s%s%.1fK", sign, symbol, absAmount/1_000)
	}
	return fmt.Sprintf("%s%s%s", sign, symbol, withSeparators(fmt.Sprintf("%.0f", absAmount)))
}

func currencySymbol(currency string) string {
	switch strings.ToUpper(currency) {
	case "USD":
		return "$"
	case "EUR":
		return "€"
	case "GBP":
		return "£"
	case "INR":
		return "₹"
	case "JPY":
		return "¥"
	case "CNY":
		return "¥"
	default:
		return currency + " "
	}
}

// formatDate formats a time as "Jan 2, 2006".
func formatDate(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format("Jan 2, 2006")
}

// formatDateShort formats a time as "01/15".
func formatDateShort(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format("01/02")
}

// formatPercent formats a float as percentage (e.g., "67%").
func formatPercent(pct float64) string {
	return fmt.Sprintf("%.0f%%", pct)
}

// formatAmount returns a signed amount string.
func formatAmount(amount float64, currency string) string {
	if amount >= 0 {
		return "+" + formatCurrency(amount, currency)
	}
	return formatCurrency(amount, currency)
}

// amountClass returns "positive" or "negative" css class.
func amountClass(amount float64) string {
	if amount >= 0 {
		return "positive"
	}
	return "negative"
}

// dict creates a map from alternating key-value pairs. Useful in templates.
func dict(values ...any) (map[string]any, error) {
	if len(values)%2 != 0 {
		return nil, fmt.Errorf("dict: odd number of arguments")
	}
	m := make(map[string]any, len(values)/2)
	for i := 0; i < len(values); i += 2 {
		key, ok := values[i].(string)
		if !ok {
			return nil, fmt.Errorf("dict: key %d is not a string", i)
		}
		m[key] = values[i+1]
	}
	return m, nil
}

func safeHTML(s string) template.HTML {
	return template.HTML(s)
}

func safeAttr(s string) template.HTMLAttr {
	return template.HTMLAttr(s)
}

func add(a, b any) float64 {
	af := toFloat(a)
	bf := toFloat(b)
	return af + bf
}

func sub(a, b any) float64 {
	af := toFloat(a)
	bf := toFloat(b)
	return af - bf
}

func mul(a, b any) float64 {
	af := toFloat(a)
	bf := toFloat(b)
	return af * bf
}

func div(a, b any) float64 {
	af := toFloat(a)
	bf := toFloat(b)
	if bf == 0 {
		return 0
	}
	return af / bf
}

func eqStr(a, b string) bool {
	return a == b
}

func defaultStr(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}

func ternary(cond bool, a, b any) any {
	if cond {
		return a
	}
	return b
}

func toFloat(v any) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case int32:
		return float64(val)
	case time.Duration:
		return float64(val)
	default:
		return 0
	}
}
