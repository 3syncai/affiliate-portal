CREATE TABLE IF NOT EXISTS password_reset_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    user_role VARCHAR(32) NOT NULL,
    user_id TEXT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash
    ON password_reset_token (token_hash);

CREATE INDEX IF NOT EXISTS idx_password_reset_token_email
    ON password_reset_token (email, created_at DESC);
