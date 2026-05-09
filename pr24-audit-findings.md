# PR #24 – Structural & Handler Audit Findings

## pr24-structure: Route-to-Handler Mapping ✅ COMPLETE

**58 routes verified** — every route in `cmd/server/main.go` maps to an existing exported handler method with a correct HTTP handler signature (`func(w http.ResponseWriter, r *http.Request)`).

### Issue #1: Savings.Get uses O(n) list-all-iterate pattern
- **File:** `internal/handlers/savings.go` (Get method)
- **Problem:** Fetches ALL savings goals, then iterates to find one matching ID. This is O(n) vs the expected O(1) for a direct query.
- **Root cause:** No `GetSavingsGoalByID` query exists in the generated DB layer. The handler works around it.
- **Impact:** Performance degrades linearly with the number of savings goals.

### Issue #2: Route path `/savings` but doc comments say `/savings-goals`
- **File:** `internal/handlers/savings.go` (doc comments on all methods)
- **Problem:** Comments say `// GET /api/v1/savings-goals/{id}` etc. but the actual route registered in main.go line 164 is `/api/v1/savings`.
- **Impact:** Cosmetic — doesn't affect functionality, but confusing for maintainers.

### Issue #3: Missing GET-by-ID endpoints
| Resource | GET /{id} | DB query exists | Route registered |
|---|---|---|---|
| Categories | ❌ | ✅ GetCategoryByID | ❌ |
| Tags | ❌ | ❌ No GetTagByID | ❌ |
| Budgets | ❌ | ✅ GetBudgetByID (used internally for Update/Delete ownership check) | ❌ |

**Note:** For Categories, `GetCategoryByID` query IS generated but never routed or used by any handler. For Tags, the omission is consistent (no DB query exists). For Budgets, the query is used internally by Update and Delete but there's no public GET endpoint.

### Issue #4: Missing PUT /api/v1/tags/{id} (Tag Update)
- Tags only support Create, List, and Delete. No Update endpoint exists.
- No `UpdateTag` DB query exists in the generated code.
- **Design note:** If tags are simple enough to be delete-then-recreate, this is fine. But if renaming is needed, an update endpoint is required.

### Issue #5: Auth Logout endpoint is unprotected
- **File:** `cmd/server/main.go` lines 82-91
- **Problem:** `POST /api/v1/auth/logout` is registered OUTSIDE the auth middleware group — anyone can call it.
- **Impact:** Low. The handler body is `utils.OK(w, map[string]string{"message": "logged out"})` — it's a no-op. But semantically odd.

---

## pr24-handlers: Auth, Validation & Error Handling ✅ COMPLETE

### Auth Gates

**Pattern:** Every protected handler starts with:
```go
claims := middleware.GetUserClaims(r)
if claims == nil {
    utils.BadRequest(w, "unauthorized")
    return
}
```
✅ Present in all 55 protected handler methods.

### Issue #6: Auth failure returns HTTP 400 instead of 401
- **Problem:** `utils.BadRequest` sends status 400. `401 Unauthorized` is the semantically correct status for authentication failures.
- **Affected:** All handlers use `utils.BadRequest(w, "unauthorized")` for auth gates.
- **Impact:** Client-side error differentiation — can't distinguish "bad request" (malformed payload) from "unauthenticated" (missing/expired token).

### Input Validation

**Pattern:** All Create/Update handlers:
1. Decode JSON body → return 400 on failure ✅
2. Check required fields → return 400 with descriptive message ✅
3. Validate enum values with switch statement → return 400 on invalid value ✅

### Issue #7: Transaction Create/Update allows zero-amount transactions
- **File:** `internal/handlers/transactions.go`
- **Problem:** `Amount` field is `float64` (value type, not pointer), so zero is always "provided". There's no check for `Amount <= 0`.
- **Impact:** A transaction with amount = 0 can be created.

### Issue #8: Budget Update uses PATCH semantics on a PUT endpoint
- **File:** `internal/handlers/budgets.go` lines 228-357
- **Pattern:** The `updateBudgetRequest` struct uses `*string`, `*float64`, `*bool` pointer fields. The handler merges provided fields with existing values (like a PATCH/merge), but the HTTP method is PUT (which conventionally replaces the resource).
- **Impact:** Semantic mismatch. Client sending PUT must know which fields are pointers vs values. Category, Account, and other handlers don't do this.

### Error Handling

| Scenario | Response | Status Code | Note |
|---|---|---|---|
| JSON decode failure | `"invalid request body"` | 400 ✅ | Consistent |
| Missing required field | Descriptive message | 400 ✅ | Consistent |
| Invalid enum value | Descriptive message or `"invalid ..."` | 400 ✅ | Consistent |
| DB error on create | `500 Internal Server Error` | 500 ✅ | No leak of internal errors |
| Entity not found | `"not found"` | 404 ✅ | Consistent |
| Ownership violation | `"not found"` | 404 ✅ | Prevents ID enumeration |
| Nil result from DB | Empty slice `[]` | 200 ✅ | Consistent (no null in JSON) |

### Ownership Verification Patterns

**Two patterns used across the codebase:**

1. **Explicit check** (preferred): Fetch entity, compare `UserID.Bytes` → return 404 on mismatch
   - Used in: Account.Get, Account.Update, Transaction.Get, Transaction.Update, Budget.Update, Budget.Delete, Investment.Get, Investment.Update, Investment.ListTransactions, Investment.CreateTransaction, Loan.Get, Insurance.Get
   
2. **DB WHERE clause** (adequate): Include `UserID` in the DB query params
   - Used in: Account.Delete, Category.Delete, Tag.Delete, Transaction.Delete, Investment.Delete, Savings.Delete, Loan.Delete, Insurance.Delete
   - ✅ All Delete handlers include `UserID` in the DB params, so even without the explicit check, the DB prevents cross-user modification.

### Response Shape Inconsistencies

### Issue #9: Get vs Create/Update return different shapes
- **Account.Get:** Returns `map[string]interface{}` with computed balance, numeric-to-float conversion, and string IDs
- **Account.Create/Update:** Returns raw `db.Account` model with pgtype types
- **Transaction.Get:** Returns `map[string]interface{}` with enriched data (tags, account name, string IDs)
- **Transaction.Create/Update:** Returns raw `db.Transaction` model
- **Impact:** Frontend needs to handle two different response shapes for the same resource depending on the operation.

### Issue #10: No user profile update endpoint
- `GET /api/v1/auth/me` exists
- `POST /api/v1/auth/register` + `POST /api/v1/auth/login` exist
- **Missing:** `PUT /api/v1/auth/me` or similar endpoint to update user profile (name, default_currency, timezone)

---

## Summary

| Category | Count | Issues |
|---|---|---|
| Routes verified | 58/58 ✅ | All map to existing handler methods |
| Auth gates present | 55/55 ✅ | All protected handlers check auth |
| Input validation | ✅ | Required fields + enum validation |
| Ownership checks | ✅ | Both explicit and DB-level |
| Error handling | ✅ | Consistent patterns |
| **Issues found** | **10** | See above |

**Severity:**
- 🔴 **High:** None — no security vulnerabilities or broken routes
- 🟡 **Medium:** #1 (performance), #6 (wrong status code), #9 (response shape inconsistency)
- 🟢 **Low:** #2 (doc comments), #3 (missing GET endpoints — by design?), #4 (missing Tag update), #5 (logout unprotected), #7 (zero-amount), #8 (PUT vs PATCH), #10 (missing profile update)
