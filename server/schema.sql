CREATE TABLE IF NOT EXISTS students (
  college_id TEXT PRIMARY KEY,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  full_name TEXT NOT NULL DEFAULT '',
  major TEXT NOT NULL DEFAULT '',
  academic_year TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  college_id TEXT NOT NULL REFERENCES students(college_id),
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  focus TEXT NOT NULL,
  bio TEXT NOT NULL,
  languages TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  starts_at TEXT NOT NULL,
  UNIQUE(provider_id, starts_at)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  college_id TEXT NOT NULL REFERENCES students(college_id),
  slot_id TEXT NOT NULL REFERENCES slots(id),
  mode TEXT NOT NULL CHECK (mode IN ('In person', 'Video', 'Chat')),
  note TEXT NOT NULL CHECK (char_length(note) <= 300),
  cancelled_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_slot
  ON bookings(slot_id)
  WHERE cancelled_at IS NULL;
