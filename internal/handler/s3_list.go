package handler

import (
	"encoding/xml"
	"net/http"
	"time"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/auth/sigv4"
	"github.com/moogodev/moogodev/internal/dbcontrol"
)

// ListObjectsV2 serves an S3-compatible bucket listing.
type s3ListBucketResult struct {
	XMLName               xml.Name       `xml:"ListBucketResult"`
	Xmlns                 string         `xml:"xmlns,attr"`
	Name                  string         `xml:"Name"`
	Prefix                string         `xml:"Prefix"`
	KeyCount              int            `xml:"KeyCount"`
	MaxKeys               int            `xml:"MaxKeys"`
	IsTruncated           bool           `xml:"IsTruncated"`
	NextContinuationToken string         `xml:"NextContinuationToken,omitempty"`
	Contents              []s3ListObject `xml:"Contents"`
}

type s3ListObject struct {
	Key          string `xml:"Key"`
	LastModified string `xml:"LastModified"`
	ETag         string `xml:"ETag"`
	Size         int64  `xml:"Size"`
	StorageClass string `xml:"StorageClass"`
}

func (handler *BucketPlane) ListObjectsV2(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		sigv4.WriteXMLError(w, http.StatusUnauthorized, "AccessDenied", "authentication required")
		return
	}

	query := r.URL.Query()
	bucketName := query.Get("bucket")
	if bucketName == "" {
		sigv4.WriteXMLError(w, http.StatusBadRequest, "InvalidRequest", "bucket is required")
		return
	}

	bucket, err := handler.resolveBucket(r.Context(), projectID, bucketName)
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusNotFound, "NoSuchBucket", "no such bucket")
		return
	}

	prefix := query.Get("prefix")
	maxKeys := parseIntParam(query.Get("max-keys"), 1000)
	if maxKeys <= 0 || maxKeys > 1000 {
		maxKeys = 1000
	}

	page, err := handler.store.ListObjects(r.Context(), dbcontrol.ObjectQuery{
		BucketID: bucket.ID,
		Prefix:   prefix,
		Limit:    maxKeys,
	})
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusInternalServerError, "InternalError", "list objects failed")
		return
	}

	contents := make([]s3ListObject, 0, len(page.Objects))
	for i := range page.Objects {
		contents = append(contents, s3ListObject{
			Key:          page.Objects[i].Key,
			LastModified: page.Objects[i].UpdatedAt.UTC().Format(time.RFC3339),
			ETag:         page.Objects[i].ETag(),
			Size:         page.Objects[i].SizeBytes,
			StorageClass: "STANDARD",
		})
	}

	result := s3ListBucketResult{
		Xmlns:     "http://s3.amazonaws.com/doc/2006-03-01/",
		Name:      bucketName,
		Prefix:    prefix,
		KeyCount:  len(contents),
		MaxKeys:   maxKeys,
		IsTruncated: page.NextCursor != "",
		Contents:  contents,
	}
	if page.NextCursor != "" {
		result.NextContinuationToken = page.NextCursor
	}

	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(http.StatusOK)
	xml.NewEncoder(w).Encode(result)
}
