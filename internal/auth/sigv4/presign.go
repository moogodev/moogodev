package sigv4

import (
	"net/url"
	"strconv"
	"time"
)

// PresignURL generates an S3-style presigned URL for PUT/GET/HEAD.
// Best practice: builds query params (X-Amz-Algorithm, Credential,
// X-Amz-Date, X-Amz-Expires, X-Amz-SignedHeaders, X-Amz-Signature).
// Full HMAC signing requires the secret key; until reversible storage
// is available, the URL is generated structurally and verification
// remains fail-closed on the server.
func PresignURL(baseURL string, bucketName string, key string, expiresSec int) string {
	now := time.Now().UTC()
	dateStamp := now.Format("20060102")
	dateTime := now.Format("20060102T150405Z")
	region := "us-east-1"

	u, _ := url.Parse(baseURL + "/s3/" + bucketName + "/" + key)
	q := u.Query()
	q.Set("X-Amz-Algorithm", "AWS4-HMAC-SHA256")
	q.Set("X-Amz-Credential", "AKID/"+dateStamp+"/"+region+"/s3/aws4_request")
	q.Set("X-Amz-Date", dateTime)
	q.Set("X-Amz-Expires", strconv.Itoa(expiresSec))
	q.Set("X-Amz-SignedHeaders", "host")
	q.Set("X-Amz-Signature", "PLACEHOLDER")
	u.RawQuery = q.Encode()
	return u.String()
}
