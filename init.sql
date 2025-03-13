CREATE TABLE IF NOT EXISTS temp_roles (
    user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)