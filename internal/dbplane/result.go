package dbplane

// QueryResult is the outcome of a read statement.
type QueryResult struct {
	// Columns are the column names in result order.
	Columns []string `json:"columns"`
	// Rows holds one slice per row, aligned with Columns.
	//
	// Positional rather than map-based because column order is meaningful and a
	// row with duplicate column names would collapse if mapped.
	Rows [][]any `json:"rows"`
	// Truncated is set when the row cap was hit, so the client knows the result
	// is partial instead of assuming it read everything.
	Truncated bool `json:"truncated,omitempty"`
}

// ExecResult is the outcome of a write or DDL statement.
type ExecResult struct {
	// RowsAffected is 0 for statements that do not report a count, such as
	// CREATE TABLE.
	RowsAffected int64 `json:"rows_affected"`
	// SizeBytes is the database size after the statement ran.
	SizeBytes int64 `json:"size_bytes"`
	// LastInsertRowID is the rowid of the row this statement inserted.
	//
	// SQLite's value is connection-scoped rather than statement-scoped: an
	// UPDATE leaves it pointing at whatever was inserted before it, so the
	// caller has to decide whether the statement was an INSERT before
	// reporting it. Zero means the driver had nothing to report.
	LastInsertRowID int64 `json:"last_insert_rowid"`
}

// TransactionStatement is one statement inside a transaction.
type TransactionStatement struct {
	Query string `json:"query"`
	// Args are the bound values, positionally matching ? placeholders.
	Args []any `json:"args"`
}

// TransactionStatementResult is the outcome of one statement in a transaction.
type TransactionStatementResult struct {
	// RowsAffected is 0 for statements that do not report a count.
	RowsAffected int64 `json:"rows_affected"`
	// LastInsertRowID is the rowid this statement inserted, with the same
	// caveat as ExecResult: the caller reports it only for an INSERT.
	LastInsertRowID int64 `json:"last_insert_rowid"`
}

// TransactionResult is the outcome of a committed transaction.
//
// The per-statement results are positional: entry i is the outcome of
// statements[i]. A caller that needs to know which step did what -- an insert
// that has to be matched to the row it created -- reads it by index rather than
// by searching for a value that may legitimately repeat.
type TransactionResult struct {
	Statements []TransactionStatementResult `json:"statements"`
	// RowsAffected is the total across every statement, which is the number a
	// caller mostly wants: "how much did this request change".
	RowsAffected int64 `json:"rows_affected"`
	// SizeBytes is the database size after the commit.
	SizeBytes int64 `json:"size_bytes"`
}
