package sanitizer

// sqlKeywords is the set of words the tokenizer treats as keywords rather than
// identifiers.
//
// The list is deliberately limited to keywords that matter for the checks in
// this package. It is not a complete SQL grammar: an unknown word is simply
// lexed as an identifier, which is the safe direction, since a forbidden
// keyword missed from this list would be treated as an identifier and could
// slip through. That is why the words that carry the security weight
// (ATTACH, PRAGMA, and the file-reading functions) are pinned by a test
// rather than trusted to this list.
var sqlKeywords = map[string]bool{
	"ADD":               true,
	"ALL":               true,
	"ALTER":             true,
	"ANALYZE":           true,
	"AND":               true,
	"AS":                true,
	"ATTACH":            true,
	"AUTOINCREMENT":     true,
	"BEFORE":            true,
	"BEGIN":             true,
	"BETWEEN":           true,
	"BY":                true,
	"CASCADE":           true,
	"CASE":              true,
	"CAST":              true,
	"CHECK":             true,
	"COLLATE":           true,
	"COMMIT":            true,
	"CONFLICT":          true,
	"CONSTRAINT":        true,
	"CREATE":            true,
	"CROSS":             true,
	"CURRENT_DATE":      true,
	"CURRENT_TIME":      true,
	"CURRENT_TIMESTAMP": true,
	"DEFAULT":           true,
	"DEFERRABLE":        true,
	"DEFERRED":          true,
	"DELETE":            true,
	"DESC":              true,
	"DETACH":            true,
	"DISTINCT":          true,
	"DROP":              true,
	"ELSE":              true,
	"END":               true,
	"ESCAPE":            true,
	"EXCEPT":            true,
	"EXCLUDE":           true,
	"EXCLUSIVE":         true,
	"EXISTS":            true,
	"EXPLAIN":           true,
	"FAIL":              true,
	"FOR":               true,
	"FOREIGN":           true,
	"FROM":              true,
	"FULL":              true,
	"GLOB":              true,
	"GROUP":             true,
	"HAVING":            true,
	"IF":                true,
	"IGNORE":            true,
	"IMMEDIATE":         true,
	"IN":                true,
	"INDEX":             true,
	"INDEXED":           true,
	"INITIALLY":         true,
	"INNER":             true,
	"INSERT":            true,
	"INSTEAD":           true,
	"INTERSECT":         true,
	"INTO":              true,
	"IS":                true,
	"ISNULL":            true,
	"JOIN":              true,
	"KEY":               true,
	"LEFT":              true,
	"LIKE":              true,
	"LIMIT":             true,
	"MATCH":             true,
	"NATURAL":           true,
	"NOT":               true,
	"NOTNULL":           true,
	"NULL":              true,
	"OF":                true,
	"OFFSET":            true,
	"ON":                true,
	"OR":                true,
	"ORDER":             true,
	"OTHERS":            true,
	"OUTER":             true,
	"PLAN":              true,
	"PRAGMA":            true,
	"PRIMARY":           true,
	"QUERY":             true,
	"RAISE":             true,
	"RECURSIVE":         true,
	"REFERENCES":        true,
	"REGEXP":            true,
	"REINDEX":           true,
	"RELEASE":           true,
	"RENAME":            true,
	"REPLACE":           true,
	"RESTRICT":          true,
	"RIGHT":             true,
	"ROLLBACK":          true,
	"ROW":               true,
	"SAVEPOINT":         true,
	"SELECT":            true,
	"SET":               true,
	"TABLE":             true,
	"TEMP":              true,
	"TEMPORARY":         true,
	"THEN":              true,
	"TO":                true,
	"TRANSACTION":       true,
	"TRIGGER":           true,
	"UNION":             true,
	"UNIQUE":            true,
	"UPDATE":            true,
	"USING":             true,
	"VACUUM":            true,
	"VALUES":            true,
	"VIEW":              true,
	"VIRTUAL":           true,
	"WHEN":              true,
	"WHERE":             true,
	"WINDOW":            true,
	"WITH":              true,
	"WITHOUT":           true,
}

// forbiddenFunctions are SQLite builtins that read or write files, or load
// native code.
//
// These are blocked by name wherever they appear, including as a column or
// table name. The false-positive risk is negligible and the cost of missing
// one is reading arbitrary files from the host, so erring toward rejection is
// the right trade.
var forbiddenFunctions = map[string]bool{
	"READFILE":                  true,
	"WRITEFILE":                 true,
	"LOAD_EXTENSION":            true,
	"EDIT":                      true,
	"FTS3_TOKENIZER":            true,
	"SQLITE_COMPILEOPTION_GET":  true,
	"SQLITE_COMPILEOPTION_USED": true,
}

// allowedPragmas are the PRAGMA names the dashboard needs.
//
// PRAGMA is whitelisted rather than blacklisted. A blacklist would have to
// anticipate every file-touching pragma, and the list is long: journal_mode,
// key, rekey, page_size, auto_vacuum, synchronous, and others can all change
// the file on disk. An allowlist is also what keeps the dashboard's schema
// inspector working.
//
// database_list is deliberately absent even though it only reads: it reports
// the filesystem path of every attached database, which hands the data
// directory layout of the server to any project client. The dashboard never
// needs it.
var allowedPragmas = map[string]bool{
	"TABLE_INFO":        true,
	"TABLE_XINFO":       true,
	"INDEX_LIST":        true,
	"INDEX_INFO":        true,
	"INDEX_XINFO":       true,
	"FOREIGN_KEY_LIST":  true,
	"COLLATION_LIST":    true,
	"FUNCTION_LIST":     true,
	"MODULE_LIST":       true,
	"PRAGMA_LIST":       true,
	"COMPILE_OPTIONS":   true,
	"INTEGRITY_CHECK":   true,
	"QUICK_CHECK":       true,
	"FOREIGN_KEY_CHECK": true,
}
