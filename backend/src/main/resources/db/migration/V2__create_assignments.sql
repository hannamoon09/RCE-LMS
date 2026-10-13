CREATE TABLE assignments (
    id UUID PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    difficulty VARCHAR(16) NOT NULL CHECK (difficulty IN ('Low', 'Medium', 'High')),
    deadline TIMESTAMPTZ NOT NULL,
    target_track VARCHAR(16) NOT NULL CHECK (target_track IN ('WEB', 'PWN', 'REVERSING', 'FORENSICS')),
    author_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX assignments_track_created_idx ON assignments (target_track, created_at DESC);
