// Package secretkey membuat dan memverifikasi secret key API.
//
// Key hanya ditampilkan satu kali saat pembuatan project, jadi nilai mentah
// hanya pernah melewati batas ini satu kali. Setelah itu yang disimpan adalah
// hash-nya saja.
package secretkey

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
)

// prefixLength adalah panjang prefix yang disimpan di database.
//
// Dipakai supaya user bisa mengidentifikasi key mana yang sedang aktif dari
// daftar miliknya tanpa perlu membandingkan nilai penuh.
const prefixLength = 8

// Generated adalah hasil pembuatan secret key baru.
//
// Plaintext hanya perlu disimpan selama request pembuatan berjalan, lalu
// dibuang. Sisanya adalah yang masuk ke database.
type Generated struct {
	// Plaintext adalah nilai yang dikirim ke klien satu kali.
	Plaintext string
	// Hash adalah yang disimpan di database.
	Hash string
	// Prefix adalah 8 karakter awal, aman ditampilkan.
	Prefix string
}

// Generate membuat secret key baru.
//
// Format memakai prefiks "moogo_" supaya key yang bocor bisa diidentifikasi
// berasal dari Moogo, dan entropy-nya 32 byte dari crypto/rand.
func Generate() (Generated, error) {
	var buf [32]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return Generated{}, fmt.Errorf("buat secret key: %w", err)
	}

	raw := base64.RawURLEncoding.EncodeToString(buf[:])
	plaintext := "moogo_" + raw

	return Generated{
		Plaintext: plaintext,
		Hash:      Hash(plaintext),
		Prefix:    Prefix(plaintext),
	}, nil
}

// Hash mengubah secret key menjadi hash yang disimpan di database.
//
// SHA-256 tanpa salt dipilih karena key-nya sendiri sudah 256 bit dari
// crypto/rand, jadi tidak ada ruang tebak dan salt tidak menambah apa pun.
// Perbandingan dilakukan constant-time di Verify.
func Hash(plaintext string) string {
	sum := sha256.Sum256([]byte(plaintext))
	return hex.EncodeToString(sum[:])
}

// Prefix mengembalikan 8 karakter awal untuk keperluan identifikasi.
func Prefix(plaintext string) string {
	p := strings.TrimPrefix(plaintext, "moogo_")
	if len(p) <= prefixLength {
		return p
	}
	return p[:prefixLength]
}

// Verify membandingkan secret key dari request dengan hash yang tersimpan.
//
// Perbandingan constant-time supaya waktu eksekusi tidak membocorkan berapa
// byte yang sudah cocok.
func Verify(plaintext, storedHash string) bool {
	got := Hash(plaintext)
	return subtle.ConstantTimeCompare([]byte(got), []byte(storedHash)) == 1
}
