CREATE TABLE IF NOT EXISTS login_otp_challenge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    user_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verify_attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_login_otp_challenge_email_created
    ON login_otp_challenge (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_otp_challenge_phone_created
    ON login_otp_challenge (phone, created_at DESC);

CREATE TABLE IF NOT EXISTS login_otp_audit (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    ip_address TEXT,
    challenge_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_otp_audit_ip_created
    ON login_otp_audit (ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_otp_audit_email_created
    ON login_otp_audit (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_otp_audit_phone_created
    ON login_otp_audit (phone, created_at DESC);
