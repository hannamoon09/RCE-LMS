CREATE TABLE profile_files (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(127) NOT NULL,
    size BIGINT NOT NULL CHECK (size > 0),
    storage_key VARCHAR(36) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX profile_files_owner_idx ON profile_files (owner_id);
ALTER TABLE users ADD CONSTRAINT users_profile_image_fk
    FOREIGN KEY (profile_image) REFERENCES profile_files(id) ON DELETE RESTRICT;
ALTER TABLE users ADD COLUMN credential_version BIGINT NOT NULL DEFAULT 0;
