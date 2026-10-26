package sigv4

import "github.com/moogodev/moogodev/internal/secretbox"

var storageSecretKey []byte

func SetStorageSecretKey(secret string) {
	storageSecretKey = secretbox.KeyFromSecret(secret)
}

func storageKey() []byte {
	if len(storageSecretKey) == 0 {
		storageSecretKey = secretbox.KeyFromSecret("dev-storage-secret-key-32bytes!!")
	}
	return storageSecretKey
}