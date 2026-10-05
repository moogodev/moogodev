// Package bucketkey membuat dan memverifikasi credential object storage.
//
// Credential di sini sengaja terpisah dari secret key proyek. Secret key
// mengotorisasi SQL; credential ini mengotorisasi bucket. Pemisahan itu
// mengikuti cara kerja Cloudflare R2, di mana satu application token punya
// sendiri dan bisa dicabut tanpa menyentuh kredensial lain.
//
// Prinsip yang sama dengan pkg/secretkey berlaku: nilai mentah hanya melewati
// batas server satu kali, saat pembuatan atau rotasi. Setelah itu hanya hash
// yang tersimpan, jadi credential yang bocor dari log atau backup tidak
// langsung bisa dipakai.
package bucketkey

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
)

// Prefiks credential.
//
// Access key ID memakai prefiks sendiri supaya berbeda jenisnya dari secret key
// proyek dan dari secret access key. Kalau keduanya terlihat berdampingan di
// sebuah log, jelas mana yang mana tanpa perlu melihat lagi ke depan.
const (
	// accessKeyPrefix menandai ID yang aman untuk ditampilkan.
	accessKeyPrefix = "moogo_ak_"
	// secretKeyPrefix menandai bagian yang rahasia.
	secretKeyPrefix = "moogo_sk_"

	// accessKeyBytes adalah panjang entropi ID. ID ini muncul di header tiap
	// request, jadi dibuat pendek tapi tetap cukup untuk tidak踩 tebakan.
	accessKeyBytes = 15
	// secretKeyBytes adalah panjang entropi secret, sama dengan secret key
	// proyek.
	secretKeyBytes = 32

	// previewLength adalah berapa karakter secret yang disimpan untuk
	//identifikasi di daftar credential.
	previewLength = 6
)

// Generated adalah hasil pembuatan satu credential storage.
//
// Sepasang nilai ini dikirim ke klien tepat satu kali. Setelah itu yang
// tersisa di database hanya AccessKeyID dan SecretKeyHash.
type Generated struct {
	// AccessKeyID adalah identitas publik, dikirim pada setiap request.
	AccessKeyID string
	// SecretKeyPlaintext adalah bagian rahasia, hanya dikirim satu kali.
	SecretKeyPlaintext string
	// SecretKeyHash adalah yang disimpan di database.
	SecretKeyHash string
	// SecretKeyPreview adalah-awal secret, aman ditampilkan.
	SecretKeyPreview string
}

// Generate membuat satu credential storage baru.
//
// Kesalahan di sini berarti crypto/rand gagal, yang di OS modern praktis tidak
// mungkin terjadi; errornya dikembalikan, bukan ditelan, supaya pemanggil
// tidak membuat credential yang sebenarnya tidak acak.
func Generate() (Generated, error) {
	access, err := randomString(accessKeyBytes)
	if err != nil {
		return Generated{}, fmt.Errorf("buat access key id: %w", err)
	}

	secret, err := randomString(secretKeyBytes)
	if err != nil {
		return Generated{}, fmt.Errorf("buat secret access key: %w", err)
	}

	plaintext := secretKeyPrefix + secret

	return Generated{
		AccessKeyID:        accessKeyPrefix + access,
		SecretKeyPlaintext: plaintext,
		SecretKeyHash:      Hash(plaintext),
		SecretKeyPreview:   Preview(plaintext),
	}, nil
}

// randomString mengembalikan n byte acak sebagai base64 URL-safe tanpa padding.
func randomString(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// Hash mengubah secret access key menjadi hash yang disimpan.
//
// SHA-256 tanpa salt, sama seperti secret key proyek: kuncinya sendiri sudah
// 256 bit acak, jadi tidak ada ruang tebak dan salt tidak menambah apa pun.
func Hash(plaintext string) string {
	sum := sha256.Sum256([]byte(plaintext))
	return hex.EncodeToString(sum[:])
}

// Preview mengembalikan-awal secret untuk identificação di daftar credential.
func Preview(plaintext string) string {
	trimmed := strings.TrimPrefix(plaintext, secretKeyPrefix)
	if len(trimmed) <= previewLength {
		return trimmed
	}
	return trimmed[:previewLength]
}

// Verify membandingkan secret dari request dengan hash yang tersimpan.
//
// Constant-time supaya waktu eksekusi tidak membocorkan berapa byte yang sudah
// cocok.
func Verify(plaintext, storedHash string) bool {
	got := Hash(plaintext)
	return subtle.ConstantTimeCompare([]byte(got), []byte(storedHash)) == 1
}

// LooksLikeAccessKeyID melaporkan apakah sebuah string berbentuk access key ID.
//
// Hanya untukZsuru pesan error yang lebih jelas, bukan untuk validasi:
// Entscheidanya tetap dibuat oleh lookup di database.
func LooksLikeAccessKeyID(value string) bool {
	return strings.HasPrefix(value, accessKeyPrefix)
}
