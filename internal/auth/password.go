package auth

import "golang.org/x/crypto/bcrypt"

// Password hashing for email/password sign-in.
//
// bcrypt is an adaptive, salted hash: it is deliberately slow so an offline
// attack on a leaked database still has to pay the cost per guess. This is the
// opposite of the project secret keys, which are high-entropy random values and
// are hashed with a fast SHA-256 because there is nothing to slow down.

// HashPassword returns a bcrypt hash of a plaintext password.
func HashPassword(plaintext string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(plaintext), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

// VerifyPassword reports whether a plaintext password matches a stored bcrypt
// hash. A malformed hash is a mismatch, not a panic.
func VerifyPassword(plaintext, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plaintext)) == nil
}
