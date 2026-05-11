package handlers

import "github.com/KTS-o7/ledgerify-web/internal/db"

// ParseTransactionType converts a string to db.TransactionType.
func ParseTransactionType(s string) (db.TransactionType, error) {
	switch s {
	case "income":
		return db.TransactionTypeIncome, nil
	case "expense":
		return db.TransactionTypeExpense, nil
	case "transfer":
		return db.TransactionTypeTransfer, nil
	case "credit_payment":
		return db.TransactionTypeCreditPayment, nil
	default:
		return "", errInvalid("transaction type", "income, expense, transfer, credit_payment")
	}
}

// ParseLoanType converts a string to db.LoanType.
func ParseLoanType(s string) (db.LoanType, error) {
	switch s {
	case "home":
		return db.LoanTypeHome, nil
	case "personal":
		return db.LoanTypePersonal, nil
	case "vehicle":
		return db.LoanTypeVehicle, nil
	case "education":
		return db.LoanTypeEducation, nil
	case "other":
		return db.LoanTypeOther, nil
	default:
		return "", errInvalid("loan type", "home, personal, vehicle, education, other")
	}
}

// ParseGoalStatus converts a string to db.GoalStatus.
func ParseGoalStatus(s string) (db.GoalStatus, error) {
	switch s {
	case "active":
		return db.GoalStatusActive, nil
	case "achieved":
		return db.GoalStatusAchieved, nil
	case "abandoned":
		return db.GoalStatusAbandoned, nil
	default:
		return "", errInvalid("goal status", "active, achieved, abandoned")
	}
}

// ParsePaymentStatus converts a string to db.PaymentStatus.
func ParsePaymentStatus(s string) (db.PaymentStatus, error) {
	switch s {
	case "scheduled":
		return db.PaymentStatusScheduled, nil
	case "paid":
		return db.PaymentStatusPaid, nil
	case "missed":
		return db.PaymentStatusMissed, nil
	case "partial":
		return db.PaymentStatusPartial, nil
	default:
		return "", errInvalid("payment status", "scheduled, paid, missed, partial")
	}
}

// ParseInvestmentTxType converts a string to db.InvestmentTxType.
func ParseInvestmentTxType(s string) (db.InvestmentTxType, error) {
	switch s {
	case "buy":
		return db.InvestmentTxTypeBuy, nil
	case "sell":
		return db.InvestmentTxTypeSell, nil
	case "dividend":
		return db.InvestmentTxTypeDividend, nil
	case "interest":
		return db.InvestmentTxTypeInterest, nil
	case "bonus":
		return db.InvestmentTxTypeBonus, nil
	default:
		return "", errInvalid("investment transaction type", "buy, sell, dividend, interest, bonus")
	}
}

// ParseInsurancePaymentStatus converts a string to db.InsurancePaymentStatus.
func ParseInsurancePaymentStatus(s string) (db.InsurancePaymentStatus, error) {
	switch s {
	case "paid":
		return db.InsurancePaymentStatusPaid, nil
	case "due":
		return db.InsurancePaymentStatusDue, nil
	case "missed":
		return db.InsurancePaymentStatusMissed, nil
	default:
		return "", errInvalid("insurance payment status", "paid, due, missed")
	}
}

// errInvalid returns an error message for invalid enum values.
func errInvalid(field, allowed string) error {
	return &validationError{field: field, allowed: allowed}
}

type validationError struct {
	field   string
	allowed string
}

func (e *validationError) Error() string {
	return "invalid " + e.field + ". Must be one of: " + e.allowed
}
