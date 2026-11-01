# Partner commission settlement

## Behavior

Wallet, earnings, orders, dashboard and activity GET requests no longer settle commissions.
The standalone worker checks every 30 seconds, with no overlapping local ticks. One database
transaction/advisory lock coordinates all worker replicas. Each tick credits at most 100 due
entries, using row locks and a unique receipt per commission. Receipt insertion, wallet credit
and CREDITED status commit together. Database NUMERIC amounts are passed as strings rather
than accumulated with JavaScript floating point.

Commission percentages and `/asm` = Branch Admin, `/bm` = Area Sales Manager are unchanged.
The existing delivery detection, configured unlock interval (default seven days), pending
return hold, approved return/cancellation and zero-floor wallet reversal policies remain.
Missing recipient/unknown source, negative payout and RATE_MISSING entries are held, not paid.
Existing missing-branch repair now runs under the worker transaction. Newly repaired credited
sales re-enter PENDING so they go through delivery checks and an actual wallet receipt.

Status webhooks no longer reset already credited entries or recalculate a credited payout.
The existing explicit zero-rate admin correction may upgrade a zero-money receipt once;
it cannot replay a nonzero wallet credit. Other receipt/recipient/amount mismatches fail closed
and require investigation. Additional-commission campaign calculation stays in the existing
commission creation flow; this change does not redefine campaign eligibility or percentages.

The approved-return mutation webhook still voids immediately, using the same transaction/lock
as the worker. Return reversal only subtracts a recorded wallet credit, using that receipt's recipient and
amount. An uncredited pending return never reduces unrelated wallet funds. Future withdrawal
reservation/debt handling is a separate change; the existing zero-floor policy is preserved.

## Historical balances

The old two-step system cannot prove that every historical CREDITED row reached its wallet.
The migration records legacy baselines WITHOUT incrementing wallet balances. It deliberately
does not attempt to repair historical missing/duplicate credits automatically. Reconcile these
against existing wallet/withdrawal records before declaring financial data fully audited.

## Deployment (not yet performed)

Use Node 22+ and install the repository's pinned dependencies, including TypeScript used by
the standalone worker loader (`npm ci --include=dev`). The web portal can remain on Vercel;
the persistent worker must run on a VM/container/process supervisor, not in a Vercel request.
Supply the same server-side DATABASE_URL and unlock settings as the portal. Never expose
DATABASE_URL through NEXT_PUBLIC variables. No test-mode unlock override in production.

1. Back up the database and verify the restore process. Test these steps in staging first.
2. Stop/drain old portal settlement writers (including old previews using this database).
   Temporarily pause commission webhook delivery, keeping sender retries enabled. Do not let
   old page-time settlement and new ledger settlement run concurrently during cutover.
3. From the partner repository, run `npm run migrate:commission-wallet -- --apply`.
   It uses one connection, locks the commission log while baselining and is rerunnable.
4. Deploy the new portal and verify the response contracts. With the worker still stopped,
   reading wallets/earnings must not change balances/statuses. Resume webhook delivery.
5. Run `npm run worker:commission -- --once`, inspect results/logs, then start the supervised
   loop, e.g. `pm2 start npm --name oweg-commission-settlement -- run worker:commission`.
6. Run `npm run worker:commission -- --check`. This is read-only and fails when the last
   successful tick is older than five minutes or an unresolved worker error is present.
   Configure an external alert on that failure and PM2 process restarts; a health command
   by itself does not deliver alerts. Run `pm2 save` after validating the process config.

Monitor pending/due backlog age, held recipients, errors, tick duration, and receipt/wallet
reconciliation. A stopped worker delays new credits; pages still work and do not manufacture
credits. An error rolls back the tick; the next tick retries. A crash after COMMIT but before
heartbeat cannot duplicate a credit. SIGTERM drains the current tick before closing the pool.

Safe rollback: stop the worker and keep the read-only portal endpoints/ledger in place while
investigating. Do not drop receipts, reset CREDITED rows or blindly restore old settlement
writers after real credits; that can replay money. Prefer a forward fix with reconciliation.

## Verification / UAT

`npm run test:settlement` always runs static handler/read-only wallet tests. For full real
PostgreSQL tests, explicitly set SETTLEMENT_TEST_DATABASE_URL to the disposable
`postgres://postgres@127.0.0.1:55439/postgres` instance. The runner rejects other hosts/ports,
creates its own temporary database and drops that database afterwards. Never point tests at
the portal DATABASE_URL. Existing live smoke scripts are not used for this verification.

Tests cover no-page credits, repeat/restart/concurrent workers, rollback after wallet writes,
hard process death before COMMIT, exact decimal payouts for all existing role sources,
delivery/unlock, pending/rejected/approved returns, cancellation, missing rates/recipients,
historical baseline, zero-rate correction, bounded batches and the worker health command.

Staging UAT still requires a real delivered test order: verify each role's existing share,
no credit before the configured window, automatic credit with all pages closed, matching
wallet/ledger/earnings after refresh, no double credit on refresh/webhook retry/restart, return
hold/release/reversal, worker failure alert, and recovery. Financial endpoints' authorization,
withdrawal concurrency, historical reconciliation and cross-service return races remain
separate audit items; this implementation does not certify the whole marketplace.
