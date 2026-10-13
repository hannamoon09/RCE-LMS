CREATE TABLE submissions (
    id UUID PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content TEXT,
    status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING', 'REVIEWED')),
    score INTEGER CHECK (score BETWEEN 0 AND 100),
    feedback TEXT,
    submitted_at TIMESTAMPTZ NOT NULL,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT submissions_user_assignment_unique UNIQUE (user_id, assignment_id),
    CONSTRAINT submissions_review_state_check CHECK (
        (status = 'PENDING' AND score IS NULL AND feedback IS NULL AND reviewed_at IS NULL AND reviewed_by IS NULL)
        OR (status = 'REVIEWED' AND score IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
    )
);
CREATE INDEX submissions_assignment_idx ON submissions (assignment_id);
CREATE INDEX submissions_user_submitted_idx ON submissions (user_id, submitted_at DESC);
