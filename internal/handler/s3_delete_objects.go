package handler

import (
	"encoding/xml"
	"net/http"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/auth/sigv4"
)

type s3DeleteRequest struct {
	XMLName xml.Name `xml:"Delete"`
	Objects []struct {
		Key string `xml:"Key"`
	} `xml:"Object"`
}

type s3DeleteResult struct {
	XMLName xml.Name `xml:"DeleteResult"`
	Deleted []struct {
		Key string `xml:"Key"`
	} `xml:"Deleted"`
}

func (handler *BucketPlane) DeleteObjects(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		sigv4.WriteXMLError(w, http.StatusUnauthorized, "AccessDenied", "authentication required")
		return
	}

	var req s3DeleteRequest
	if err := xml.NewDecoder(r.Body).Decode(&req); err != nil {
		sigv4.WriteXMLError(w, http.StatusBadRequest, "MalformedXML", "invalid delete request")
		return
	}

	result := s3DeleteResult{}
	for _, o := range req.Objects {
		key, err := normalizeKey(o.Key)
		if err != nil {
			continue
		}
		freed, err := handler.store.DeleteObject(r.Context(), projectID, key)
		if err == nil {
			_ = freed
			handler.fs.DeleteObject(projectID, key)
			result.Deleted = append(result.Deleted, struct {
				Key string `xml:"Key"`
			}{Key: key})
		}
	}

	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(http.StatusOK)
	xml.NewEncoder(w).Encode(result)
}
