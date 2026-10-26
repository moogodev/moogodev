package handler

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"sync"

	"github.com/google/uuid"
	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/auth/sigv4"
)

type multipartUpload struct {
	projectID uuid.UUID
	bucketID  uuid.UUID
	key       string
	parts     map[int]string // part number -> storage key
}

var (
	multipartMu      sync.Mutex
	multipartUploads = map[string]*multipartUpload{}
)

type s3InitiateMultipartUploadResult struct {
	XMLName  xml.Name `xml:"InitiateMultipartUploadResult"`
	Bucket   string   `xml:"Bucket"`
	Key      string   `xml:"Key"`
	UploadId string   `xml:"UploadId"`
}

type s3CompleteMultipartUploadRequest struct {
	XMLName xml.Name `xml:"CompleteMultipartUpload"`
	Parts   []struct {
		PartNumber int    `xml:"PartNumber"`
		ETag       string `xml:"ETag"`
	} `xml:"Part"`
}

type s3CompleteMultipartUploadResult struct {
	XMLName  xml.Name `xml:"CompleteMultipartUploadResult"`
	Location string   `xml:"Location"`
	Bucket   string   `xml:"Bucket"`
	Key      string   `xml:"Key"`
	ETag     string   `xml:"ETag"`
}

func (handler *BucketPlane) CreateMultipartUpload(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		sigv4.WriteXMLError(w, http.StatusUnauthorized, "AccessDenied", "authentication required")
		return
	}
	key, valid := handler.keyFromRequest(w, r)
	if !valid {
		return
	}
	bucketName := r.URL.Query().Get("bucket")
	if bucketName == "" {
		bucketName = "default"
	}
	bucket, err := handler.resolveBucket(r.Context(), projectID, bucketName)
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusNotFound, "NoSuchBucket", "no such bucket")
		return
	}

	uploadId := uuid.NewString()
	multipartMu.Lock()
	multipartUploads[uploadId] = &multipartUpload{
		projectID: projectID,
		bucketID:  bucket.ID,
		key:       key,
		parts:     map[int]string{},
	}
	multipartMu.Unlock()

	res := s3InitiateMultipartUploadResult{
		Bucket:   bucketName,
		Key:      key,
		UploadId: uploadId,
	}
	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(http.StatusOK)
	xml.NewEncoder(w).Encode(res)
}

func (handler *BucketPlane) UploadPart(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		sigv4.WriteXMLError(w, http.StatusUnauthorized, "AccessDenied", "authentication required")
		return
	}
	uploadId := r.URL.Query().Get("uploadId")
	partNum, err := strconv.Atoi(r.URL.Query().Get("partNumber"))
	if err != nil || partNum < 1 {
		sigv4.WriteXMLError(w, http.StatusBadRequest, "InvalidArgument", "invalid part number")
		return
	}

	multipartMu.Lock()
	up, ok := multipartUploads[uploadId]
	multipartMu.Unlock()
	if !ok || up.projectID != projectID {
		sigv4.WriteXMLError(w, http.StatusNotFound, "NoSuchUpload", "upload not found")
		return
	}

	partKey := fmt.Sprintf("mp/%s/%d", uploadId, partNum)
	written, err := handler.fs.WriteObject(projectID, partKey, r.Body)
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusInternalServerError, "InternalError", "write part failed")
		return
	}
	_ = written

	multipartMu.Lock()
	up.parts[partNum] = partKey
	multipartMu.Unlock()

	etag := fmt.Sprintf("\"%d\"", partNum)
	w.Header().Set("ETag", etag)
	w.WriteHeader(http.StatusOK)
}

func (handler *BucketPlane) CompleteMultipartUpload(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		sigv4.WriteXMLError(w, http.StatusUnauthorized, "AccessDenied", "authentication required")
		return
	}
	key, valid := handler.keyFromRequest(w, r)
	if !valid {
		return
	}
	uploadId := r.URL.Query().Get("uploadId")
	multipartMu.Lock()
	up, ok := multipartUploads[uploadId]
	multipartMu.Unlock()
	if !ok || up.projectID != projectID {
		sigv4.WriteXMLError(w, http.StatusNotFound, "NoSuchUpload", "upload not found")
		return
	}

	var req s3CompleteMultipartUploadRequest
	if err := xml.NewDecoder(r.Body).Decode(&req); err != nil {
		sigv4.WriteXMLError(w, http.StatusBadRequest, "MalformedXML", "invalid complete request")
		return
	}

	// sort parts
	partNums := make([]int, 0, len(up.parts))
	for pn := range up.parts {
		partNums = append(partNums, pn)
	}
	sort.Ints(partNums)

	// concatenate
	pr, pw := io.Pipe()
	go func() {
		defer pw.Close()
		for _, pn := range partNums {
			pk := up.parts[pn]
			rc, _, err := handler.fs.ReadObject(projectID, pk)
			if err != nil {
				pw.CloseWithError(err)
				return
			}
			_, err = io.Copy(pw, rc)
			rc.Close()
			if err != nil {
				pw.CloseWithError(err)
				return
			}
		}
	}()

	bucketName := r.URL.Query().Get("bucket")
	if bucketName == "" {
		bucketName = "default"
	}
	bucket, err := handler.resolveBucket(r.Context(), projectID, bucketName)
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusNotFound, "NoSuchBucket", "no such bucket")
		return
	}

	written, err := handler.fs.WriteObject(projectID, key, pr)
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusInternalServerError, "InternalError", "write failed")
		return
	}

	obj, _, err := handler.store.PutObject(r.Context(), projectID, bucket.ID, key, written, "application/octet-stream", false, nil)
	if err != nil {
		sigv4.WriteXMLError(w, http.StatusInternalServerError, "InternalError", "metadata failed")
		return
	}

	// cleanup
	multipartMu.Lock()
	for _, pk := range up.parts {
		handler.fs.DeleteObject(projectID, pk)
	}
	delete(multipartUploads, uploadId)
	multipartMu.Unlock()

	res := s3CompleteMultipartUploadResult{
		Bucket:   bucketName,
		Key:      key,
		ETag:     obj.ETag(),
		Location: fmt.Sprintf("/%s/%s", bucketName, key),
	}
	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(http.StatusOK)
	xml.NewEncoder(w).Encode(res)
}

func (handler *BucketPlane) AbortMultipartUpload(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		sigv4.WriteXMLError(w, http.StatusUnauthorized, "AccessDenied", "authentication required")
		return
	}
	uploadId := r.URL.Query().Get("uploadId")

	multipartMu.Lock()
	up, exists := multipartUploads[uploadId]
	if exists && up.projectID == projectID {
		for _, pk := range up.parts {
			handler.fs.DeleteObject(projectID, pk)
		}
		delete(multipartUploads, uploadId)
	}
	multipartMu.Unlock()

	w.WriteHeader(http.StatusNoContent)
}