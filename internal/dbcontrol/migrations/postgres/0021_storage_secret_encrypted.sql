-- 0021_storage_secret_encrypted.sql — reversible storage secret for SigV4.
ALTER TABLE storage_credentials
    ADD COLUMN IF NOT EXISTS secret_key_encrypted text NOT NULL DEFAULT '';
