# Common catalog commissions

Product commission rules apply to the server-owned `metadata.catalog_product_id` family.
Every verified vendor listing uses the same rate. There are no vendor-specific overrides.
Names and SKUs are never used to infer membership.

- An existing rule attached to a sibling listing is inherited immediately.
- Saving from any listing consolidates family rules into one rule on the canonical product.
- Conflicting legacy rates fail closed until an admin saves one common rate.
- Missing/deleted/cyclic catalog identities are not silently merged.
- Canonical category (including ancestors), brand and type are fallback scopes.
- No rule produces `RATE_MISSING`, displayed as **Commission not configured**.
  This status cannot be promoted by delivery sync or reset by the status webhook.
  Explicitly configured 0% is a valid rule, distinct from a missing rule.

## Historical correction

On **Admin → Set Commission**, use **Review old ₹0 entries** for the product rule.

The preview uses the currently configured base rate and each ledger row's recorded
historical executive/hierarchy share. This is a retrospective correction: the admin
must review even orders placed before the rule was configured.

Only zero-base, zero-earned entries without additional commission are eligible.
Cancelled/deleted orders, return requests and already corrected/non-zero entries
are excluded. A preview fingerprint rejects changed rates or ledger data.

Confirmation runs in one transaction, locks affected entries and writes an
`affiliate_commission_correction` audit record with actor and before/after values.
It resets corrected entries to PENDING and clears the old unlock/credit timestamps.
It does not write to wallets. Ordinary delivery/return-window processing subsequently
controls credit. Repeating confirmation cannot apply the same correction twice.
The audit table is created transactionally on the first confirmed correction.

## Validation

- `node --test scripts/catalog-commission.test.js`
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- Real catalog read-only validation: both kettle listings resolve the configured 5%.
- Historical correction tested with all eight hierarchy rows inside a rolled-back
  transaction: Govind ₹32.25 per order, no wallet changes, original ledger restored.

## Rollout

Deploy the partner portal (including its commission webhook), then verify the same
rate on both linked listings. No storefront/backend product data changes or linking
migration are needed for the verified kettle family. Historical corrections remain
an explicit admin preview/confirm operation. Do not replay payment or commission
webhooks to repair past entries.

## Existing role routes (do not rename)

/asm is Branch Admin; /bm is ASM. This change does not reinterpret route names,
recipient IDs, commission_source, hierarchy assignments or recorded role shares.
Corrections use each ledger row's existing affiliate_rate and recipient identity.
