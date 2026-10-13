CREATE TABLE users (
    id UUID PRIMARY KEY,
    student_id VARCHAR(32) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254),
    role VARCHAR(16) NOT NULL CHECK (role IN ('MEMBER', 'STAFF')),
    track VARCHAR(16) NOT NULL CHECK (track IN ('WEB', 'PWN', 'REVERSING', 'FORENSICS')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at TIMESTAMPTZ NOT NULL,
    profile_image UUID
);
CREATE INDEX users_track_role_active_idx ON users (track, role, active);
