package handler

import (
	"encoding/xml"
	"net/http"
	"strings"
	"time"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/auth/sigv4"
	"github.com/moogodev/moogodev/internal/dbcontrol"
)

// ListObjectsV2 serves an S3-compatible bucket listing.
type s3ListBucketResult struct {
	XMLName               xml.Name          `xml:"ListBucketResult"`
	Xmlns                 string            `xml:"xmlns,attr"`
	Name                  string            `xml:"Name"`
	Prefix                string            `xml:"Prefix"`
	Delimiter             string            `xml:"Delimiter,omitempty"`
	KeyCount              int               `xml:"KeyCount"`
	MaxKeys               int               `xml:"MaxKeys"`
	IsTruncated           bool              `xml:"IsTruncated"`
	NextContinuationToken string            `xml:"NextContinuationToken,omitempty"`
	Contents              []s3ListObject    `xml:"Contents"`
	CommonPrefixes        []s3CommonPrefix  `xml:"CommonPrefixes,omitempty"`
}

type s3CommonPrefix struct {
	Prefix string `xml:"Prefix"`
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
	cursor := query.Get("continuation-token")
	delimiter := query.Get("delimiter")

	page, err := handler.store.ListObjects(r.Context(), dbcontrol.ObjectQuery{
		BucketID: bucket.ID,
		Prefix:   prefix,
		Limit:    maxKeys,
		Cursor:   cursor,
	})
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusInternalServerError, "InternalError", "list objects failed")
		return
	}

	var contents []s3ListObject
	var commonPrefixes []s3CommonPrefix
	seenPrefix := map[string]bool{}

	if delimiter != "" {
		for i := range page.Objects {
			key := page.Objects[i].Key
			rest := strings.TrimPrefix(key, prefix)
			idx := strings.Index(rest, delimiter)
			if idx >= 0 {
				cp := prefix + rest[:idx+len(delimiter)]
				if !seenPrefix[cp] {
					seenPrefix[cp] = true
					commonPrefixes = append(commonPrefixes, s3CommonPrefix{Prefix: cp})
				}
				continue
			}
			contents = append(contents, s3ListObject{
				Key:          key,
				LastModified: page.Objects[i].UpdatedAt.UTC().Format(time.RFC3339),
				ETag:         page.Objects[i].ETag(),
				Size:         page.Objects[i].SizeBytes,
				StorageClass: "STANDARD",
			})
		}
	} else {
		contents = make([]s3ListObject, 0, len(page.Objects))
		for i := range page.Objects {
			contents = append(contents, s3ListObject{
				Key:          page.Objects[i].Key,
				LastModified: page.Objects[i].UpdatedAt.UTC().Format(time.RFC3339),
				ETag:         page.Objects[i].ETag(),
				Size:         page.Objects[i].SizeBytes,
				StorageClass: "STANDARD",
			})
		}
	}
	if contents == nil {
		contents = []s3ListObject{}
	}

	result := s3ListBucketResult{
		Xmlns:            "http://s3.amazonaws.com/doc/2006-03-01/",
		Name:             bucketName,
		Prefix:           prefix,
		Delimiter:        delimiter,
		KeyCount:         len(contents) + len(commonPrefixes),
		MaxKeys:          maxKeys,
		IsTruncated:      page.NextCursor != "",
		Contents:         contents,
		CommonPrefixes:   commonPrefixes,
	}
	if page.NextCursor != "" {
		result.NextContinuationToken = page.NextCursor
	}

	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(http.StatusOK)
	xml.NewEncoder(w).Encode(result)
}
