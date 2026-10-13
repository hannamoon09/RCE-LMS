CREATE TABLE assignment_files (
    id UUID PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(127) NOT NULL,
    size BIGINT NOT NULL CHECK (size > 0),
    storage_key VARCHAR(36) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX assignment_files_assignment_idx ON assignment_files (assignment_id);

CREATE TABLE submission_files (
    id UUID PRIMARY KEY,
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(127) NOT NULL,
    size BIGINT NOT NULL CHECK (size > 0),
    storage_key VARCHAR(36) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX submission_files_submission_idx ON submission_files (submission_id);

CREATE TABLE file_cleanup_jobs (
    storage_key VARCHAR(36) PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
