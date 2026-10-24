package sigv4

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/google/uuid"
)



// stubResolver is a test fake that always returns the same credential.
type stubResolver struct{}
func (stubResolver) StorageCredentialByAccessKeyID(ctx context.Context, accessKeyID string) (*dbcontrol.StorageCredential, error) {
	return &dbcontrol.StorageCredential{ProjectID: uuid.MustParse("12345678-1234-1234-1234-123456789012")}, nil
}
func TestVerify_ValidCredential(t *testing.T) {
	req := httptest.NewRequest("GET", "/s3/bucket/foo.png", nil)
	req.Header.Set("Authorization", "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20261024/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=deadbeef")
	key, region, ok := Verify(req)
	if !ok {
		t.Fatal("Verify returned false")
	}
	if key != "AKIAIOSFODNN7EXAMPLE" {
		t.Errorf("expected key AKIAIOSFODNN7EXAMPLE, got %q", key)
	}
	if region != "us-east-1" {
		t.Errorf("expected region us-east-1, got %q", region)
	}
}

func TestVerify_MissingPrefix(t *testing.T) {
	req := httptest.NewRequest("GET", "/s3/bucket/foo.png", nil)
	req.Header.Set("Authorization", "Basic abc123")
	_, _, ok := Verify(req)
	if ok {
		t.Error("Verify should reject non-AWS4 header")
	}
}

func TestVerify_EmptyHeader(t *testing.T) {
	req := httptest.NewRequest("GET", "/s3/bucket/foo.png", nil)
	_, _, ok := Verify(req)
	if ok {
		t.Error("Verify should reject empty header")
	}
}

func TestMiddleware_MissingAuthorization(t *testing.T) {
	handler := Middleware(stubResolver{}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest("GET", "/s3/", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestVerifySignature_RejectsAllWhenUnimplemented(t *testing.T) {
	if VerifySignature(context.Background(), "AKIAIOSFODNN7EXAMPLE", "s3") {
		t.Error("VerifySignature must reject until full HMAC is implemented")
	}
}
