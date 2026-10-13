CREATE TABLE notices (
    id UUID PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    important BOOLEAN NOT NULL,
    track VARCHAR(16) CHECK (track IN ('WEB', 'PWN', 'REVERSING', 'FORENSICS')),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX notices_track_created_idx ON notices (track, important DESC, created_at DESC);
