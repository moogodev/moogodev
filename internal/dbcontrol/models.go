package dbcontrol

import (
	"time"

	"github.com/google/uuid"
)

// User is a Moogo account. One email equals one user.
type User struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	AvatarURL string    `json:"avatar_url"`

	// PasswordHash is the bcrypt hash for email/password sign-in. It is empty
	// for Google-only accounts. The json tag excludes it from every API
	// response: a hash must never leave the server.
	PasswordHash string `json:"-"`

	// EmailVerifiedAt records when the address was proven.
	//
	// A nil value means "not verified yet", which is the state a password
	// registration is created in. Google accounts are verified at creation
	// because the provider returned the address already confirmed.
	//
	// It is deliberately absent from every API response: telling an
	// unauthenticated caller whether an address is verified would turn the
	// registration form into an account-enumeration oracle.
	EmailVerifiedAt *time.Time `json:"-"`

	// Quotas applied to every project this user owns.
	QuotaMaxProjects     int   `json:"-"`
	QuotaMaxDBBytes      int64 `json:"-"`
	QuotaMaxStorageBytes int64 `json:"-"`

	// Billing fields are placeholders during phase 1.
	BillingPlan       string    `json:"billing_plan"`
	BillingCustomerID *string   `json:"billing_customer_id"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`

	// SessionEpoch is the revocation counter every session token is checked
	// against. Bumping it retires every token the account has outstanding;
	// it never reaches an API response.
	SessionEpoch int64 `json:"-"`
}

// ProjectStatus is a stage in the project creation saga.
type ProjectStatus string

// Project lifecycle states.
const (
	// ProjectPending means Postgres is the source of truth but the SQLite file
	// is not yet confirmed on disk.
	ProjectPending ProjectStatus = "pending"
	// ProjectReady means the project is usable.
	ProjectReady ProjectStatus = "ready"
	// ProjectFailed means disk materialization failed.
	ProjectFailed ProjectStatus = "failed"
	// ProjectDeleting means removal is in progress.
	ProjectDeleting ProjectStatus = "deleting"
	// ProjectPaused means the project is manually paused by the user.
	// The SQLite file still exists on disk but the key resolver refuses
	// bearer tokens, so no queries or bucket operations are served.
	// ResumeProject restores the ready state.
	ProjectPaused ProjectStatus = "paused"
)

// Project is a single user database unit.
type Project struct {
	ID     uuid.UUID
	UserID uuid.UUID
	Name   string

	Status       ProjectStatus
	StatusDetail *string

	// SecretKeyHash is never returned to a client.
	SecretKeyHash string
	// SecretKeyPrefix is the first characters of the key, safe to display.
	SecretKeyPrefix    string
	SecretKeyRotatedAt *time.Time

	CreatedAt time.Time
	UpdatedAt time.Time
}

// Ready reports whether the project can serve queries.
func (project Project) Ready() bool {
	return project.Status == ProjectReady
}

// Paused reports whether the project is manually paused.
func (project Project) Paused() bool {
	return project.Status == ProjectPaused
}

// Bucket is an object namespace inside a project.
type Bucket struct {
	ID        uuid.UUID
	ProjectID uuid.UUID
	Name      string
	CreatedAt time.Time

	// ObjectCount and SizeBytes are filled in only by ListBucketsWithStats.
	// They are not stored; they are aggregated per bucket for the dashboard's
	// bucket list, which shows the same numbers R2 shows next to each bucket.
	ObjectCount int64
	SizeBytes   int64

	// IsPublic is the visibility objects uploaded into this bucket get from now
	// on. It does not decide the visibility of an object the user flipped
	// individually: BucketObject.IsPublic is the answer for that object and this
	// is only the default.
	IsPublic bool

	// AllowedTypes is the set of media classes a bucket accepts, for example
	// [image video]. A single AllowedAny is the absence of a restriction. It
	// gates every write, so a dashboard that only filtered the file picker would
	// still be bypassable through an API client.
	//
	// Empty means the row predates the policy column, which reads the same as
	// AllowedAny rather than refusing every upload.
	AllowedTypes []string

	// MaxObjectSizeBytes caps a single object in this bucket. Zero means no
	// per-object cap, which is distinct from a cap of zero: a zero-byte limit
	// would refuse every upload, so the absence of a limit is spelled zero and
	// the database uses NULL for it.
	MaxObjectSizeBytes int64

	// QuotaBytes caps this bucket's own storage, separately from the project
	// quota. A project can hold StorageCeilingBytes across all of its buckets,
	// and a single bucket must not be able to take all of it.
	QuotaBytes int64
}

// The media classes a bucket may accept. A bucket accepts an upload when the
// class the content type falls into is in AllowedTypes.
//
// "any" is the absence of a restriction, and the database refuses it in the same
// array as a real class: they are contradictory instructions, and resolving that
// by picking a winner makes the answer depend on evaluation order.
//
// "file" is not the same thing as "any". It is the class for everything that is
// none of the others -- a zip, a binary, a font -- so a bucket set to it refuses
// a .png and accepts a .tarball.
const (
	AllowedAny      = "any"
	AllowedImage    = "image"
	AllowedVideo    = "video"
	AllowedAudio    = "audio"
	AllowedDocument = "document"
	AllowedArchive  = "archive"
	AllowedFile     = "file"
)

// StorageCredential authorizes object storage for one project.
//
// It is deliberately separate from the project's SQL secret key: the two guard
// different things, and rotating or revoking one must not silently affect the
// other.
type StorageCredential struct {
	ID        uuid.UUID
	ProjectID uuid.UUID

	// AccessKeyID is public and travels in a request header.
	AccessKeyID string

	// SecretKeyHash never leaves the server.
	SecretKeyHash string
	// SecretKeyPreview is a few leading characters, enough to tell two
	// credentials apart in a list and useless on its own.
	SecretKeyPreview string

	Label string

	CreatedAt time.Time
	RotatedAt *time.Time
	RevokedAt *time.Time
}

// Active reports whether the credential may still be used.
func (credential StorageCredential) Active() bool {
	return credential.RevokedAt == nil
}

// BucketObject is one stored file inside a bucket. The payload lives on disk;
// this struct is only its metadata.
type BucketObject struct {
	ID          uuid.UUID
	ProjectID   uuid.UUID
	BucketID    uuid.UUID
	Key         string
	SizeBytes   int64
	ContentType string

	// IsPublic reports whether the object is reachable without a credential.
	// Every other field is the same either way; only this one decides it.
	IsPublic bool

	// PublicToken is the opaque identifier for the object's public URL.
	// It is only populated for public objects.
	PublicToken *string

	// Version rotates on every successful upload. It is the HTTP validator, so
	// replacing the bytes under an existing key stops matching a cached copy.
	Version   uuid.UUID
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ETag is the HTTP validator for this object.
//
// It is the version rather than a content checksum, which is what makes it
// useful here: the interesting case is a client that already holds a copy and
// asks whether it is still current, and a version marker answers that without
// reading the file back off disk.
func (object BucketObject) ETag() string {
	return `"` + object.Version.String() + `"`
}

// ActivityEntry is one audit record for a request.
type ActivityEntry struct {
	ID        uuid.UUID
	ProjectID *uuid.UUID
	UserID    *uuid.UUID
	Method    string
	Path      string
	Status    int
	Duration  time.Duration
	Source    string
	CreatedAt time.Time
}
