package sigv4

import (
	"encoding/xml"
	"net/http"
)

// XMLResponse mirrors S3 error format for /s3/ endpoints.
// Best practice: return XML instead of JSON when Authorization
// header is present (client is R2/S3 SDK).
type XMLResponse struct {
	XMLName xml.Name `xml:"Error"`
	Code    string   `xml:"Code"`
	Message string   `xml:"Message"`
}

func WriteXMLError(w http.ResponseWriter, code int, errCode, message string) {
	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(code)
	xml.NewEncoder(w).Encode(XMLResponse{
		Code:    errCode,
		Message: message,
	})
}
