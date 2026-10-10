package dbcontrol

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

// bucketColumns is the projection every bucket read shares.
//
// It exists because these four queries used to carry their own copy of the
// column list, and pgx matches a projection to Scan positionally with nothing
// checking it. Adding a column to the SELECT and forgetting the Scan is a
// runtime "number of destination arguments does not match" rather than a
// compile error, and the mismatch only shows up on the query that was edited.
const bucketColumns = `
	id, project_id, name, created_at, is_public, allowed_types,
	COALESCE(max_object_size_bytes, 0)::bigint AS max_object_size_bytes, quota_bytes`

// bucketStatsColumns is bucketColumns with the aggregate the bucket list shows.
// Prefixed with the table alias because it is the one query that joins.
//
// The aliases on the COALESCE expressions are what let the same list be reused in
// a data-modifying CTE. A bare `COALESCE(max_object_size_bytes, 0)::bigint`
// produces an output column named "coalesce", so the CTE built from
// `UPDATE ... RETURNING ` + bucketColumns has no max_object_size_bytes for its
// closing SELECT to read, and the failure is at runtime on a statement that is
// otherwise perfectly valid SQL.
const bucketStatsColumns = `
	b.id, b.project_id, b.name, b.created_at, b.is_public, b.allowed_types,
	COALESCE(b.max_object_size_bytes, 0)::bigint AS max_object_size_bytes,
	b.quota_bytes,
	COALESCE(COUNT(o.id), 0)::bigint,
	COALESCE(SUM(o.size_bytes), 0)::bigint`

// rowScanner is what pgx.Row and pgx.Rows have in common.
type rowScanner interface {
	Scan(dest ...any) error
}

// scanBucket reads one row selected with bucketColumns, plus whatever extra
// columns the caller appended.
//
// The variadic tail is what keeps bucketStatsColumns honest: the aggregate
// columns come after the shared ones here and after them in the const above, so
// reordering one without the other is not something a reader has to notice.
func scanBucket(row rowScanner, extra ...any) (*Bucket, error) {
	bucket := &Bucket{}
	dest := []any{
		&bucket.ID,
		&bucket.ProjectID,
		&bucket.Name,
		&bucket.CreatedAt,
		&bucket.IsPublic,
		&bucket.AllowedTypes,
		&bucket.MaxObjectSizeBytes,
		&bucket.QuotaBytes,
	}
	if err := row.Scan(append(dest, extra...)...); err != nil {
		return nil, err
	}
	return bucket, nil
}

// CreateBucket creates a bucket inside a project. Idempotent: creating a name
// that already exists returns the existing bucket rather than failing, which
// keeps retrying uploads from tripping over an already-created bucket.
//
// The upsert deliberately leaves the settings columns alone. A retry must not
// reset the visibility, policy or quota a user configured, so the conflict arm
// touches only the name.
func (store *Store) CreateBucket(ctx context.Context, projectID uuid.UUID, name string) (*Bucket, error) {
	const query = `
		INSERT INTO buckets (project_id, name)
		VALUES ($1, $2)
		ON CONFLICT (project_id, name) DO UPDATE SET name = EXCLUDED.name
		RETURNING ` + bucketColumns

	bucket, err := scanBucket(store.pool.QueryRow(ctx, query, projectID, name))
	if err != nil {
		return nil, fmt.Errorf("create bucket: %w", err)
	}
	return bucket, nil
}

// maxBucketListLimit bounds one bucket listing.
//
// There is no quota on how many buckets a project may hold, so the list is not
// bounded by a rule anywhere else. A thousand is far past anything a person
// creates by hand and still keeps one pathological project from turning a
// listing into an unbounded read.
const maxBucketListLimit = 1000

// ListBuckets returns all buckets belonging to a project.
func (store *Store) ListBuckets(ctx context.Context, projectID uuid.UUID) ([]Bucket, error) {
	query := `
		SELECT ` + bucketColumns + `
		FROM buckets
		WHERE project_id = $1
		ORDER BY name ASC
		LIMIT ` + strconv.Itoa(maxBucketListLimit)

	rows, err := store.pool.Query(ctx, query, projectID)
	if err != nil {
		return nil, fmt.Errorf("list buckets: %w", err)
	}
	defer rows.Close()

	buckets := make([]Bucket, 0, 8)
	for rows.Next() {
		bucket, err := scanBucket(rows)
		if err != nil {
			return nil, fmt.Errorf("scan bucket: %w", err)
		}
		buckets = append(buckets, *bucket)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate buckets: %w", err)
	}
	return buckets, nil
}

// ListBucketsWithStats returns a project's buckets with object counts and sizes.
//
// The aggregate is a LEFT JOIN so a bucket with no objects still appears with
// zeroes instead of disappearing from the list, which would make an empty bucket
// indistinguishable from a deleted one.
func (store *Store) ListBucketsWithStats(ctx context.Context, projectID uuid.UUID) ([]Bucket, error) {
	query := `
		SELECT ` + bucketStatsColumns + `
		FROM buckets b
		LEFT JOIN bucket_objects o ON o.bucket_id = b.id
		WHERE b.project_id = $1
		GROUP BY b.id, b.project_id, b.name, b.created_at, b.is_public,
		         b.allowed_types, b.max_object_size_bytes, b.quota_bytes
		ORDER BY b.name ASC
		LIMIT ` + strconv.Itoa(maxBucketListLimit)

	rows, err := store.pool.Query(ctx, query, projectID)
	if err != nil {
		return nil, fmt.Errorf("list buckets with stats: %w", err)
	}
	defer rows.Close()

	buckets := make([]Bucket, 0, 8)
	for rows.Next() {
		var objectCount, sizeBytes int64
		bucket, err := scanBucket(rows, &objectCount, &sizeBytes)
		if err != nil {
			return nil, fmt.Errorf("scan bucket stats: %w", err)
		}
		bucket.ObjectCount = objectCount
		bucket.SizeBytes = sizeBytes
		buckets = append(buckets, *bucket)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate buckets: %w", err)
	}
	return buckets, nil
}

// BucketByName loads one bucket by name, scoped to the project.
func (store *Store) BucketByName(ctx context.Context, projectID uuid.UUID, name string) (*Bucket, error) {
	const query = `
		SELECT ` + bucketColumns + `
		FROM buckets
		WHERE project_id = $1 AND name = $2`

	bucket, err := scanBucket(store.pool.QueryRow(ctx, query, projectID, name))
	if err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("load bucket by name: %w", err)
	}
	return bucket, nil
}

// DeleteBucket removes a bucket from the catalog.
//
// The foreign key cascades to bucket_objects, so this also forgets every object
// the bucket held. That is only correct if the caller has already unlinked the
// files from disk; DeleteBucketKeys exists so the caller can find them first.
// Deleting the bucket without doing so leaves orphaned files that nothing will
// ever list or account for.
func (store *Store) DeleteBucket(ctx context.Context, projectID uuid.UUID, bucketID uuid.UUID) error {
	const query = `DELETE FROM buckets WHERE id = $1 AND project_id = $2`

	result, err := store.pool.Exec(ctx, query, bucketID, projectID)
	if err != nil {
		return fmt.Errorf("delete bucket: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteBucketKeys returns the object keys held by a bucket, so the caller can
// unlink the files before the catalog rows cascade away.
func (store *Store) DeleteBucketKeys(ctx context.Context, bucketID uuid.UUID) ([]string, error) {
	const query = `SELECT key FROM bucket_objects WHERE bucket_id = $1`

	rows, err := store.pool.Query(ctx, query, bucketID)
	if err != nil {
		return nil, fmt.Errorf("list bucket keys: %w", err)
	}
	defer rows.Close()

	keys := make([]string, 0, 32)
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, fmt.Errorf("scan bucket key: %w", err)
		}
		keys = append(keys, key)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate bucket keys: %w", err)
	}
	return keys, nil
}

// PutObject records object metadata after a successful write to disk, and
// returns the previous size when the key already existed so quota accounting
// can subtract the old value rather than double-count.
//
// The two-step write (disk first, then metadata) means a crash in between
// leaves an orphaned file. That is the safe direction: an orphaned file wastes
// space, while metadata without a file would report a download that fails.
//
// Public status is not touched on a re-upload. A re-upload replaces the bytes,
// not the visibility decision the user made about them, so republishing a file
// does not silently unpublish it. isPublic only seeds a key that is new.
func (store *Store) PutObject(
	ctx context.Context,
	projectID uuid.UUID,
	bucketID uuid.UUID,
	key string,
	sizeBytes int64,
	contentType string,
	isPublic bool,
) (*BucketObject, int64, error) {
	object := &BucketObject{}
	var previousSize int64

	// The prior size is needed for quota accounting, but the upsert replaces the
	// row, so the old value has to be captured before the write lands. A CTE
	// does both in one statement, which also keeps the pair consistent.
	//
	// COALESCE is load-bearing: for a key that does not exist yet the previous
	// CTE yields no row, so the bare subquery would be NULL, and scanning NULL
	// into an int64 fails. The insert has already run by then, so the failure
	// would leave a metadata row for an object whose file the caller is about
	// to delete -- a phantom entry that shows up in listings forever.
	//
	// version is regenerated on every write, which is what makes the ETag change
	// when the bytes do. COALESCE is not needed for it: the INSERT always
	// supplies a fresh one.
	//
	// public_token follows the seeded visibility rather than being set by the
	// caller: a token is what makes the object reachable, so an object inserted
	// as public without one would answer 404 on the URL the dashboard hands out.
	const upsertQuery = `
		WITH previous AS (
			SELECT size_bytes FROM bucket_objects
			WHERE project_id = $1 AND key = $3
		), upserted AS (
			INSERT INTO bucket_objects (
				project_id, bucket_id, key, size_bytes, content_type,
				is_public, public_token, version
			)
			VALUES (
				$1, $2, $3, $4, $5, $6,
				CASE WHEN $6 THEN gen_random_uuid()::text ELSE NULL END,
				gen_random_uuid()
			)
			ON CONFLICT (project_id, key) DO UPDATE
			   SET size_bytes   = EXCLUDED.size_bytes,
			       content_type = EXCLUDED.content_type,
			       bucket_id    = EXCLUDED.bucket_id,
			       version      = EXCLUDED.version
			RETURNING id, project_id, bucket_id, key, size_bytes, content_type,
			          is_public, public_token, version, created_at, updated_at
		)
		SELECT COALESCE((SELECT size_bytes FROM previous), 0),
		       (SELECT id FROM upserted),
		       (SELECT project_id FROM upserted),
		       (SELECT bucket_id FROM upserted),
		       (SELECT key FROM upserted),
		       (SELECT size_bytes FROM upserted),
		       (SELECT content_type FROM upserted),
		       (SELECT is_public FROM upserted),
		       (SELECT public_token FROM upserted),
		       (SELECT version FROM upserted),
		       (SELECT created_at FROM upserted),
		       (SELECT updated_at FROM upserted)`

	err := store.pool.QueryRow(ctx, upsertQuery,
		projectID, bucketID, key, sizeBytes, contentType, isPublic,
	).Scan(
		&previousSize,
		&object.ID,
		&object.ProjectID,
		&object.BucketID,
		&object.Key,
		&object.SizeBytes,
		&object.ContentType,
		&object.IsPublic,
		&object.PublicToken,
		&object.Version,
		&object.CreatedAt,
		&object.UpdatedAt,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("put object: %w", err)
	}
	return object, previousSize, nil
}

// ObjectByKey loads object metadata by project and key.
func (store *Store) ObjectByKey(ctx context.Context, projectID uuid.UUID, key string) (*BucketObject, error) {
	const query = `
		SELECT id, project_id, bucket_id, key, size_bytes, content_type,
		       is_public, public_token, version, created_at, updated_at
		FROM bucket_objects
		WHERE project_id = $1 AND key = $2`

	object := &BucketObject{}
	err := store.pool.QueryRow(ctx, query, projectID, key).Scan(
		&object.ID,
		&object.ProjectID,
		&object.BucketID,
		&object.Key,
		&object.SizeBytes,
		&object.ContentType,
		&object.IsPublic,
		&object.PublicToken,
		&object.Version,
		&object.CreatedAt,
		&object.UpdatedAt,
	)
	if err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("load object by key: %w", err)
	}
	return object, nil
}

// SetObjectPublic publishes or unpublishes an object and returns the new state.
//
// Public and private are stored together in one statement so they cannot drift:
// the token is generated when publishing and cleared when unpublishing, in the
// same UPDATE that flips the flag.
func (store *Store) SetObjectPublic(
	ctx context.Context,
	projectID uuid.UUID,
	key string,
	isPublic bool,
) (*BucketObject, error) {
	const query = `
		UPDATE bucket_objects
		   SET is_public   = $3,
		       public_token = CASE WHEN $3 THEN gen_random_uuid()::text ELSE NULL END
		 WHERE project_id = $1 AND key = $2
		RETURNING id, project_id, bucket_id, key, size_bytes, content_type,
		          is_public, public_token, version, created_at, updated_at`

	object := &BucketObject{}
	err := store.pool.QueryRow(ctx, query, projectID, key, isPublic).Scan(
		&object.ID,
		&object.ProjectID,
		&object.BucketID,
		&object.Key,
		&object.SizeBytes,
		&object.ContentType,
		&object.IsPublic,
		&object.PublicToken,
		&object.Version,
		&object.CreatedAt,
		&object.UpdatedAt,
	)
	if err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("set object public: %w", err)
	}
	return object, nil
}

// SetBucketPublic flips a bucket's visibility and returns the bucket plus how
// many objects it changed.
//
// Both writes happen in one statement. The bucket row is the new default for
// uploads, and the fan-out is what makes the toggle mean what the user expects
// for files that are already there -- a bucket marked public whose existing
// objects stayed private is a bucket whose URL 404s for everything in it.
//
// Objects are updated through the CTE rather than unconditionally, so a request
// for a bucket that does not exist changes nothing instead of reporting a count
// against some other bucket.
func (store *Store) SetBucketPublic(
	ctx context.Context,
	projectID uuid.UUID,
	bucketID uuid.UUID,
	isPublic bool,
) (*Bucket, int64, error) {
	const query = `
		WITH updated_bucket AS (
			UPDATE buckets
			   SET is_public = $3
			 WHERE id = $1 AND project_id = $2
			RETURNING ` + bucketColumns + `
		), updated_objects AS (
			UPDATE bucket_objects
			   SET is_public   = $3,
			       public_token = CASE WHEN $3 THEN gen_random_uuid()::text ELSE NULL END
			 WHERE bucket_id IN (SELECT id FROM updated_bucket)
			RETURNING 1
		)
		SELECT id, project_id, name, created_at, is_public, allowed_types,
		       COALESCE(max_object_size_bytes, 0)::bigint AS max_object_size_bytes,
		       quota_bytes,
		       COALESCE((SELECT count(*) FROM updated_objects), 0)::bigint
		  FROM updated_bucket`

	// The count is selected last because scanBucket appends its extra
	// destinations after the bucket columns. A count first would be scanned into
	// the bucket's id, which is a type error the compiler cannot see and no unit
	// test reaches, because the fake store implements this method directly.
	var changed int64
	bucket, err := scanBucket(store.pool.QueryRow(ctx, query, bucketID, projectID, isPublic), &changed)
	if err != nil {
		if isNoRows(err) {
			return nil, 0, ErrNotFound
		}
		return nil, 0, fmt.Errorf("set bucket public: %w", err)
	}
	return bucket, changed, nil
}

// RenameObject moves an object to a new key inside the same project, carrying
// its visibility across.
//
// Keys are unique per project, so a rename onto an existing key is rejected by
// the database rather than silently overwriting a different object. The caller
// is expected to have moved the file on disk first: a rename that only reached
// the database would leave the bytes under the old name.
func (store *Store) RenameObject(
	ctx context.Context,
	projectID uuid.UUID,
	fromKey string,
	toKey string,
) (*BucketObject, error) {
	const query = `
		UPDATE bucket_objects
		   SET key = $3
		 WHERE project_id = $1 AND key = $2
		RETURNING id, project_id, bucket_id, key, size_bytes, content_type,
		          is_public, public_token, version, created_at, updated_at`

	object := &BucketObject{}
	err := store.pool.QueryRow(ctx, query, projectID, fromKey, toKey).Scan(
		&object.ID,
		&object.ProjectID,
		&object.BucketID,
		&object.Key,
		&object.SizeBytes,
		&object.ContentType,
		&object.IsPublic,
		&object.PublicToken,
		&object.Version,
		&object.CreatedAt,
		&object.UpdatedAt,
	)
	if err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		if isUniqueViolation(err) {
			return nil, ErrObjectKeyTaken
		}
		return nil, fmt.Errorf("rename object: %w", err)
	}
	return object, nil
}

// UpdateBucketSettings changes what a bucket accepts, how visible it is, and how
// much it may hold.
//
// Every field is written on every call, even the ones the request left out. The
// caller resolves the current values first and passes concrete ones, so a
// partial write here would mean one setting silently reset whenever another was
// changed -- and the settings page saves the form as a unit.
//
// maxObjectSize is 0 to remove the per-object cap.
func (store *Store) UpdateBucketSettings(
	ctx context.Context,
	projectID uuid.UUID,
	bucketID uuid.UUID,
	allowedTypes []string,
	maxObjectSize int64,
	isPublic bool,
	quotaBytes int64,
) (*Bucket, error) {
	// $1 is the id and $2 the project, matching the order of the WHERE clause.
	// These were the other way round in the version this replaced, which is why
	// the policy could only ever be saved against a bucket whose id happened to
	// equal the project id.
	const query = `
		UPDATE buckets
		   SET allowed_types = $3,
		       max_object_size_bytes = NULLIF($4, 0),
		       is_public = $5,
		       quota_bytes = $6
		 WHERE id = $1 AND project_id = $2
		RETURNING ` + bucketColumns

	bucket, err := scanBucket(store.pool.QueryRow(
		ctx, query, bucketID, projectID, allowedTypes, maxObjectSize, isPublic, quotaBytes))
	if err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		if isCheckViolation(err) {
			return nil, ErrInvalidBucketPolicy
		}
		return nil, fmt.Errorf("update bucket settings: %w", err)
	}
	return bucket, nil
}

// ObjectQuery is the filter and paging for a listing.
//
// Prefix and Search are combined rather than exclusive: the object browser
// narrows to a folder and then types inside it. Search is a substring match,
// because a user looking for "logo" wants "logo-dark.png" without having to
// remember which directory it landed in.
type ObjectQuery struct {
	BucketID uuid.UUID
	Prefix   string
	Search   string
	// OrderBy selects the sort column, OrderDir is "asc" or "desc".
	OrderBy  string
	OrderDir string
	Limit    int
	Offset   int
}

// bucketObjectColumns is the shared projection, so every read of an object
// scans the same fields in the same order.
const bucketObjectColumns = `
	id, project_id, bucket_id, key, size_bytes, content_type,
	is_public, public_token, version, created_at, updated_at`

// Listing limits for the object browser.
//
// These are larger than the shared control-plane page size: a file listing is
// only useful if a whole folder fits on one screen, and an object listing is
// cheap because it reads metadata rather than file contents.
const (
	defaultObjectLimit = 100
	maxObjectLimit     = 1000
)

// allowedObjectOrder maps a caller-supplied sort name to a column.
//
// The value is a literal from this table, never anything derived from the
// request, because it is interpolated into the ORDER BY clause, which no
// placeholder can parameterize. An unknown name falls back to the default
// rather than reaching the query.
var allowedObjectOrder = map[string]string{
	"key":         "key",
	"size":        "size_bytes",
	"created":     "created_at",
	"updated":     "updated_at",
	"contenttype": "content_type",
}

// ListObjects returns a page of objects in a bucket and the total match count.
//
// The total is counted in the same round trip so the UI's page count and its
// rows can never disagree. It is computed with a window function over the full
// filtered set rather than a second COUNT query, which would scan twice.
func (store *Store) ListObjects(
	ctx context.Context,
	query ObjectQuery,
) ([]BucketObject, int64, error) {
	if query.Limit <= 0 || query.Limit > maxObjectLimit {
		query.Limit = defaultObjectLimit
	}
	if query.Offset < 0 {
		query.Offset = 0
	}

	column, ok := allowedObjectOrder[query.OrderBy]
	if !ok {
		column = "created_at"
	}
	direction := "DESC"
	if strings.EqualFold(query.OrderDir, "asc") {
		direction = "ASC"
	}

	// The filters are optional, so they are assembled as fixed fragments chosen
	// by parameter rather than by string concatenation. Both the bucket id and
	// every filter value are still bound parameters; only the shape of the
	// WHERE clause varies.
	var (
		conditions []string
		arguments  []any
	)
	arguments = append(arguments, query.BucketID)
	conditions = append(conditions, "bucket_id = $1")

	if query.Prefix != "" {
		arguments = append(arguments, query.Prefix)
		conditions = append(conditions, fmt.Sprintf("key LIKE $%d ESCAPE '\\'", len(arguments)))
	}
	if query.Search != "" {
		// Escape the wildcards so a search for "50%" is a literal search. The
		// backslash is doubled for the SQL string literal.
		arguments = append(arguments, "%"+escapeLike(query.Search)+"%")
		conditions = append(conditions,
			fmt.Sprintf("key ILIKE $%d ESCAPE '\\'", len(arguments)))
	}
	where := strings.Join(conditions, " AND ")

	statement := fmt.Sprintf(`
		SELECT %s, COUNT(*) OVER () AS total_count
		FROM bucket_objects
		WHERE %s
		ORDER BY %s %s, id ASC
		LIMIT $%d OFFSET $%d`,
		bucketObjectColumns, where, column, direction, len(arguments)+1, len(arguments)+2)

	arguments = append(arguments, query.Limit, query.Offset)

	rows, err := store.pool.Query(ctx, statement, arguments...)
	if err != nil {
		return nil, 0, fmt.Errorf("list objects: %w", err)
	}
	defer rows.Close()

	objects := make([]BucketObject, 0, query.Limit)
	var total int64
	for rows.Next() {
		object := BucketObject{}
		var totalCount int64
		if err := rows.Scan(
			&object.ID,
			&object.ProjectID,
			&object.BucketID,
			&object.Key,
			&object.SizeBytes,
			&object.ContentType,
			&object.IsPublic,
			&object.PublicToken,
			&object.Version,
			&object.CreatedAt,
			&object.UpdatedAt,
			&totalCount,
		); err != nil {
			return nil, 0, fmt.Errorf("scan object: %w", err)
		}
		objects = append(objects, object)
		// Every row carries the same count, so assigning it repeatedly is
		// harmless and reading it from any row is correct. An empty page leaves
		// total at zero, which is what an empty result should report.
		total = totalCount
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate objects: %w", err)
	}
	return objects, total, nil
}

// escapeLike neutralises the LIKE wildcards in user input.
//
// Without this, searching for "100%" matches every key, because % is how
// substring matching is spelled. The escape character has to be doubled inside
// the SQL string literal as well, which is why this returns "\\\\".
func escapeLike(raw string) string {
	replacer := strings.NewReplacer(
		`\`, `\\`,
		`%`, `\%`,
		`_`, `\_`,
	)
	return replacer.Replace(raw)
}

// DeleteObject removes object metadata and returns the freed byte count so the
// caller can adjust the quota immediately.
func (store *Store) DeleteObject(ctx context.Context, projectID uuid.UUID, key string) (int64, error) {
	const query = `
		DELETE FROM bucket_objects
		WHERE project_id = $1 AND key = $2
		RETURNING size_bytes`

	var freedBytes int64
	err := store.pool.QueryRow(ctx, query, projectID, key).Scan(&freedBytes)
	if err != nil {
		if isNoRows(err) {
			return 0, ErrNotFound
		}
		return 0, fmt.Errorf("delete object: %w", err)
	}
	return freedBytes, nil
}

// DeletePrefix removes every object whose key starts with the prefix and returns
// the freed bytes.
//
// The prefix is matched literally: a caller that wants to clear a directory
// passes "photos/2026/" and gets exactly that, not a glob.
func (store *Store) DeletePrefix(
	ctx context.Context,
	projectID uuid.UUID,
	prefix string,
) ([]string, int64, error) {
	const query = `
		WITH removed AS (
			DELETE FROM bucket_objects
			WHERE project_id = $1 AND key LIKE $2 ESCAPE '\'
			RETURNING key, size_bytes
		)
		SELECT key, size_bytes FROM removed`

	rows, err := store.pool.Query(ctx, query, projectID, escapeLike(prefix)+"%")
	if err != nil {
		return nil, 0, fmt.Errorf("delete prefix: %w", err)
	}
	defer rows.Close()

	keys := make([]string, 0, 16)
	var freed int64
	for rows.Next() {
		var key string
		var size int64
		if err := rows.Scan(&key, &size); err != nil {
			return nil, 0, fmt.Errorf("scan removed object: %w", err)
		}
		keys = append(keys, key)
		freed += size
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate removed objects: %w", err)
	}
	return keys, freed, nil
}

// StorageUsedBytes totals every object size belonging to a project.
//
// The 250 MB quota is per project rather than per bucket, so this deliberately
// ignores bucket_id and counts the whole project as one pool.
//
// Sizes come from the size_bytes column recorded at upload time rather than
// from the filesystem, so a quota check never has to walk the disk.
func (store *Store) StorageUsedBytes(ctx context.Context, projectID uuid.UUID) (int64, error) {
	const query = `
		SELECT COALESCE(SUM(size_bytes), 0)::bigint
		FROM bucket_objects
		WHERE project_id = $1`

	var usedBytes int64
	if err := store.pool.QueryRow(ctx, query, projectID).Scan(&usedBytes); err != nil {
		return 0, fmt.Errorf("compute storage usage: %w", err)
	}
	return usedBytes, nil
}

// BucketStorageUsedBytes totals the object sizes in one bucket.
//
// This is separate from StorageUsedBytes rather than a filter on it because the
// two answer different questions: one is the project's whole pool, the other is
// how much room is left in this bucket. An upload has to respect both, and the
// one that is refused is whichever ran out first, so the caller needs the two
// numbers separately rather than a single total it cannot decompose.
//
// The project id is in the WHERE clause even though bucket_id is globally
// unique. It costs nothing on the primary key and it means a bucket id from
// another project can never produce a usage figure, which the upload path would
// then treat as an authoritative budget.
func (store *Store) BucketStorageUsedBytes(
	ctx context.Context,
	projectID uuid.UUID,
	bucketID uuid.UUID,
) (int64, error) {
	const query = `
		SELECT COALESCE(SUM(size_bytes), 0)::bigint
		FROM bucket_objects
		WHERE project_id = $1 AND bucket_id = $2`

	var usedBytes int64
	if err := store.pool.QueryRow(ctx, query, projectID, bucketID).Scan(&usedBytes); err != nil {
		return 0, fmt.Errorf("compute bucket storage usage: %w", err)
	}
	return usedBytes, nil
}
