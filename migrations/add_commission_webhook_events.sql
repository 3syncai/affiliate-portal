-- Deploy before enabling AFFILIATE_WEBHOOK_IDEMPOTENT on the storefront.
CREATE TABLE IF NOT EXISTS affiliate_commission_webhook_event (
  event_id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  order_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
