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
}
