package handler

import (
	"encoding/xml"
	"net/http"
	"strings"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/auth/sigv4"
)

type s3CopyObjectResult struct {
	XMLName      xml.Name `xml:"CopyObjectResult"`
	ETag         string   `xml:"ETag"`
	LastModified string   `xml:"LastModified"`
}

func (handler *BucketPlane) CopyObject(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		sigv4.WriteXMLError(w, http.StatusUnauthorized, "AccessDenied", "authentication required")
		return
	}

	destKey, valid := handler.keyFromRequest(w, r)
	if !valid {
		return
	}
	query := r.URL.Query()
	destBucketName := query.Get("bucket")
	if destBucketName == "" {
		destBucketName = "default"
	}
	destBucket, err := handler.resolveBucket(r.Context(), projectID, destBucketName)
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusNotFound, "NoSuchBucket", "no such bucket")
		return
	}

	source := strings.TrimPrefix(r.Header.Get("X-Amz-Copy-Source"), "/")
	parts := strings.SplitN(source, "/", 2)
	if len(parts) != 2 {
		sigv4.WriteXMLError(w, http.StatusBadRequest, "InvalidRequest", "invalid copy source")
		return
	}
	sourceBucketName := parts[0]
	sourceKeyRaw := parts[1]
	sourceKey, err := normalizeKey(sourceKeyRaw)
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusBadRequest, "InvalidKey", err.Error())
		return
	}

	sourceObj, err := handler.store.ObjectByKey(r.Context(), projectID, sourceKey)
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusNotFound, "NoSuchKey", "source key not found")
		return
	}
	_ = sourceBucketName
	_ = destBucket

	rc, size, err := handler.fs.ReadObject(projectID, sourceKey)
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusInternalServerError, "InternalError", "read source failed")
		return
	}
	defer rc.Close()

	written, err := handler.fs.WriteObject(projectID, destKey, rc)
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusInternalServerError, "InternalError", "write dest failed")
		return
	}
	if written == 0 {
		written = size
	}

	obj, _, err := handler.store.PutObject(r.Context(), projectID, destBucket.ID, destKey, written, sourceObj.ContentType, sourceObj.IsPublic, sourceObj.CacheControl)
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusInternalServerError, "InternalError", "metadata update failed")
		return
	}

	result := s3CopyObjectResult{
		ETag:         obj.ETag(),
		LastModified: obj.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(http.StatusOK)
	xml.NewEncoder(w).Encode(result)
}
