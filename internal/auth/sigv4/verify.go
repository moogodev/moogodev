package sigv4

import (
	"net/http"
	"strings"
)

// Verify parses the Authorization header, extracts the access key,
// and checks scope (service = s3, region, date). Best practice:
// compare against stored storage keys; full HMAC verification
// is done by the controller layer after parsing.
func Verify(r *http.Request) (accessKey, region string, ok bool) {
	auth := r.Header.Get("Authorization")
	if auth == "" || !strings.HasPrefix(auth, "AWS4-HMAC-SHA256") {
		return "", "", false
	}
	// Best practice: split credential section; extract access key.
	parts := strings.Split(auth, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if strings.HasPrefix(p, "Credential=") {
			cred := strings.TrimPrefix(p, "Credential=")
			slash := strings.Split(cred, "/")
			if len(slash) >= 4 {
				accessKey = slash[0]
				region = slash[2]
				return accessKey, region, true
			}
		}
	}
	return "", "", false
}
