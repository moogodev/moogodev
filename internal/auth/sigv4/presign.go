package sigv4

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

// PresignURL generates an S3-style presigned URL for PUT/GET/HEAD with a real
// signature. secret is the plaintext storage secret; accessKeyID is the public
// access key id.
func PresignURL(baseURL, bucketName, key string, expiresSec int, accessKeyID, secret string) string {
	now := time.Now().UTC()
	dateStamp := now.Format("20060102")
	dateTime := now.Format("20060102T150405Z")
	region := "us-east-1"
	service := "s3"

	u, _ := url.Parse(baseURL + "/s3/" + bucketName + "/" + key)
	q := u.Query()
	q.Set("X-Amz-Algorithm", "AWS4-HMAC-SHA256")
	q.Set("X-Amz-Credential", accessKeyID+"/"+dateStamp+"/"+region+"/"+service+"/aws4_request")
	q.Set("X-Amz-Date", dateTime)
	q.Set("X-Amz-Expires", strconv.Itoa(expiresSec))
	q.Set("X-Amz-SignedHeaders", "host")

	// canonical query (excluding signature)
	keys := make([]string, 0, len(q))
	for k := range q {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := []string{}
	for _, k := range keys {
		for _, v := range q[k] {
			parts = append(parts, url.QueryEscape(k)+"="+url.QueryEscape(v))
		}
	}
	canonicalQuery := strings.Join(parts, "&")

	canonicalURI := u.Path
	if canonicalURI == "" {
		canonicalURI = "/"
	}
	canonicalHeaders := "host:" + u.Host + "\n"
	signedHeaders := "host"
	payloadHash := "UNSIGNED-PAYLOAD"

	canonicalRequest := strings.Join([]string{
		"GET",
		canonicalURI,
		canonicalQuery,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")

	hashedCanonical := sha256HexStr(canonicalRequest)
	credentialScope := dateStamp + "/" + region + "/" + service + "/aws4_request"
	stringToSign := "AWS4-HMAC-SHA256\n" + dateTime + "\n" + credentialScope + "\n" + hashedCanonical

	kDate := hmacSHA256Bytes([]byte("AWS4"+secret), dateStamp)
	kRegion := hmacSHA256Bytes(kDate, region)
	kService := hmacSHA256Bytes(kRegion, service)
	kSigning := hmacSHA256Bytes(kService, "aws4_request")
	sig := hex.EncodeToString(hmacSHA256Bytes(kSigning, stringToSign))

	q.Set("X-Amz-Signature", sig)
	u.RawQuery = q.Encode()
	return u.String()
}

func sha256HexStr(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func hmacSHA256Bytes(key []byte, msg string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(msg))
	return h.Sum(nil)
}