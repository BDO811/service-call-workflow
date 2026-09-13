-- Records how each inbox order was extracted (Gemini vs. regex fallback)
-- and the outcome of the auto-notify emails, for debugging/audit.
ALTER TABLE inbox_orders ADD COLUMN extraction_method TEXT NOT NULL DEFAULT 'regex';
ALTER TABLE inbox_orders ADD COLUMN extraction_error TEXT NOT NULL DEFAULT '';
ALTER TABLE inbox_orders ADD COLUMN notified_to TEXT NOT NULL DEFAULT '[]';
ALTER TABLE inbox_orders ADD COLUMN notify_errors TEXT NOT NULL DEFAULT '[]';
ALTER TABLE inbox_orders ADD COLUMN notified_at INTEGER;
