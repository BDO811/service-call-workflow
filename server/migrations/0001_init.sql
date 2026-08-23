CREATE TABLE inbox_orders (
  id TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL,
  vendor_name TEXT NOT NULL DEFAULT '',
  vendor_email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  raw_text TEXT NOT NULL DEFAULT '',
  claim_number TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  serial TEXT NOT NULL DEFAULT '',
  reported_problem TEXT NOT NULL DEFAULT '',
  appointment_preference TEXT NOT NULL DEFAULT '',
  authorization_limit TEXT NOT NULL DEFAULT '',
  repair_rate TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  needs_review INTEGER NOT NULL DEFAULT 1,
  missing_fields TEXT NOT NULL DEFAULT '[]',
  pulled INTEGER NOT NULL DEFAULT 0,
  pulled_at INTEGER
);

CREATE INDEX idx_inbox_orders_pulled ON inbox_orders (pulled, received_at);
