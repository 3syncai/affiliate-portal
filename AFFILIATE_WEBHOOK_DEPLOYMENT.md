# Affiliate webhook duplicate protection

The receiver commits its event receipt, base/hierarchy commissions and additional commissions on one PostgreSQL client. Same-order requests (including legacy callers) serialize using a transaction-scoped advisory lock. Replays of the same event are acknowledged without recalculating commission. Reusing an event ID with changed payload returns HTTP 409. Notifications run only after commit.

## Deployment order

1. Back up the affiliate database and deploy this partner-portal change with the migration below before enabling storefront deliveries.
2. From the affiliate-portal directory, load the correct production DATABASE_URL and apply migrations/add_commission_webhook_events.sql using your normal migration process. Apply it to the same database/schema used by the receiver. The table must remain durable; do not clear event receipts while events may be replayed.
3. Build/deploy the affiliate portal. Confirm the storefront Production AFFILIATE_WEBHOOK_URL points to that deployed receiver, not localhost.
4. After deployment and verification, set AFFILIATE_WEBHOOK_IDEMPOTENT=true in the ecommerce storefront Production environment and redeploy that project.
5. Leave the existing payment worker running. In Payment Health, retry an exhausted affiliate task, and verify it completes with exactly one commission allocation per intended beneficiary. Do not repeatedly create new event IDs for the same sale.

## Validation

Run `node scripts/verify-affiliate-webhook.cjs` from affiliate-portal with a test PostgreSQL DATABASE_URL. The script creates and removes a randomly named isolated schema. It never calls the live affiliate webhook or changes production tables.

13 checks passed on 2026-10-17: serial replay; ten simultaneous deliveries; payload conflict; key mismatch; canonical payload ordering; partial-write rollback/retry; error-response rollback; aborted transaction acknowledgement; legacy request serialization; actual PostgreSQL connection termination/retry; pool restart replay; actual route with controlled commission-query fixtures; actual route bonus failure/rollback/retry.

The transaction tests use real PostgreSQL. The route fixtures do not certify every commission rate, role hierarchy, existing historical ledger row, or the deployed receiver. Only enable the storefront flag after deploying this fix to the actual receiver.
