/* eslint-disable no-console */
/**
 * Diagnose SE customer link + missing order commissions.
 *
 * Usage:
 *   node scripts/diagnose_se_customer_orders.js --se abhijeetjha913@gmail.com
 *   node scripts/diagnose_se_customer_orders.js --se OWEGABHIJIT45555 --customer user@example.com
 *   node scripts/diagnose_se_customer_orders.js --se OWEGABHIJIT45555 --repair --confirm
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const SE_EMAIL = "abhijeetjha913@gmail.com";
const SE_REFER = "OWEGABHIJIT45555";

function loadDatabaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    const envPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(envPath)) {
        for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
            const line = rawLine.replace(/\r$/, "").trim();
            if (!line || line.startsWith("#")) continue;
            if (line.startsWith("DATABASE_URL=")) {
                return line.slice("DATABASE_URL=".length).trim();
            }
        }
    }
    return "";
}

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        se: SE_EMAIL,
        customer: null,
        repair: false,
        confirm: false,
        backfill: false,
    };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--se" && args[i + 1]) opts.se = args[++i];
        else if (args[i] === "--customer" && args[i + 1]) opts.customer = args[++i];
        else if (args[i] === "--repair") opts.repair = true;
        else if (args[i] === "--confirm") opts.confirm = true;
        else if (args[i] === "--backfill") opts.backfill = true;
    }
    if (opts.repair || opts.backfill) opts.confirm = opts.confirm || args.includes("--confirm");
    return opts;
}

const pool = new Pool({
    connectionString: loadDatabaseUrl().replace("?sslmode=no-verify", ""),
    ssl: { rejectUnauthorized: false },
});

async function resolveSe(client, target) {
    const lower = target.toLowerCase();
    const byEmail = await client.query(
        `SELECT id, email, refer_code, branch, is_approved, first_name, last_name
         FROM affiliate_user WHERE LOWER(email) = $1 LIMIT 1`,
        [lower]
    );
    if (byEmail.rows[0]) return byEmail.rows[0];
    const byCode = await client.query(
        `SELECT id, email, refer_code, branch, is_approved, first_name, last_name
         FROM affiliate_user WHERE LOWER(TRIM(refer_code)) = LOWER(TRIM($1)) LIMIT 1`,
        [target]
    );
    return byCode.rows[0] || null;
}

async function diagnose(client, se, customerEmail) {
    console.log("\n=== 1. Sales executive ===");
    console.table([se]);

    console.log("\n=== 2. affiliate_referrals (My Referrals UI) ===");
    const refs = await client.query(
        `SELECT id, customer_id, customer_email, customer_name, affiliate_code, referred_at
         FROM affiliate_referrals
         WHERE LOWER(TRIM(affiliate_code)) = LOWER(TRIM($1))
         ORDER BY referred_at DESC`,
        [se.refer_code]
    );
    if (refs.rows.length) console.table(refs.rows);
    else console.log("  (empty — customer list will show no referrals)");

    const customerIds = refs.rows.map((r) => r.customer_id).filter(Boolean);
    let customers = [];
    if (customerEmail) {
        const c = await client.query(
            `SELECT id, email, first_name, last_name, metadata->>'referral_code' AS referral_code
             FROM customer WHERE LOWER(email) = LOWER($1)`,
            [customerEmail]
        );
        customers = c.rows;
    } else if (customerIds.length) {
        const c = await client.query(
            `SELECT id, email, first_name, last_name, metadata->>'referral_code' AS referral_code
             FROM customer WHERE id = ANY($1::text[])`,
            [customerIds]
        );
        customers = c.rows;
    } else {
        const c = await client.query(
            `SELECT id, email, first_name, last_name, metadata->>'referral_code' AS referral_code
             FROM customer
             WHERE metadata->>'referral_code' = $1
             ORDER BY updated_at DESC NULLS LAST
             LIMIT 20`,
            [se.refer_code]
        );
        customers = c.rows;
    }

    console.log("\n=== 3. customer.metadata.referral_code (checkout attribution) ===");
    if (customers.length) console.table(customers);
    else console.log("  (no linked customers found)");

    const allCustomerIds = [...new Set([
        ...customerIds,
        ...customers.map((c) => c.id),
    ])];

    console.log("\n=== 4. Recent orders (last 14 days) for linked customers ===");
    let orders = { rows: [] };
    if (allCustomerIds.length) {
        orders = await client.query(
            `SELECT o.id, o.email, o.status, o.created_at,
                    o.metadata->>'referral_code' AS referral_code,
                    o.customer_id
             FROM "order" o
             WHERE o.customer_id = ANY($1::text[])
               AND o.created_at >= NOW() - INTERVAL '14 days'
             ORDER BY o.created_at DESC
             LIMIT 20`,
            [allCustomerIds]
        );
    }
    if (!orders.rows.length && customerEmail) {
        orders = await client.query(
            `SELECT o.id, o.email, o.status, o.created_at,
                    o.metadata->>'referral_code' AS referral_code,
                    o.customer_id
             FROM "order" o
             WHERE LOWER(o.email) = LOWER($1)
               AND o.created_at >= NOW() - INTERVAL '14 days'
             ORDER BY o.created_at DESC
             LIMIT 20`,
            [customerEmail]
        );
    }
    if (orders.rows.length) console.table(orders.rows);
    else console.log("  (no recent orders found for linked customers)");

    const orderIds = orders.rows.map((r) => r.id);
    console.log("\n=== 5. Commission ledger for those orders ===");
    if (orderIds.length) {
        const ledger = await client.query(
            `SELECT order_id, affiliate_code, commission_source, commission_amount,
                    affiliate_commission, status, created_at
             FROM affiliate_commission_log
             WHERE order_id = ANY($1::text[])
             ORDER BY order_id, commission_source`,
            [orderIds]
        );
        if (ledger.rows.length) console.table(ledger.rows);
        else console.log("  (NO commission rows — orders invisible on all portals)");
    }

    console.log("\n=== 6. SE commission rows (last 10) ===");
    const seLedger = await client.query(
        `SELECT order_id, product_name, order_amount, affiliate_commission, status, created_at
         FROM affiliate_commission_log
         WHERE affiliate_code = $1 AND commission_source = 'affiliate'
         ORDER BY created_at DESC
         LIMIT 10`,
        [se.refer_code]
    );
    if (seLedger.rows.length) console.table(seLedger.rows);
    else console.log("  (none)");

    const missingReferral = refs.rows.length === 0;
    const missingMetadata = customers.some((c) => c.referral_code !== se.refer_code);
    const ordersMissingLedger = orders.rows.filter((o) => {
        return o.referral_code === se.refer_code;
    });

    return {
        refs: refs.rows,
        customers,
        orders: orders.rows,
        missingReferral,
        missingMetadata,
        ordersNeedingBackfill: [],
    };
}

async function repairLinks(client, se, customers, confirm) {
    let fixed = 0;
    for (const cust of customers) {
        const needsMeta = cust.referral_code !== se.refer_code;
        const refExists = (
            await client.query(
                `SELECT id FROM affiliate_referrals
                 WHERE affiliate_code = $1 AND customer_id = $2 LIMIT 1`,
                [se.refer_code, cust.id]
            )
        ).rows[0];

        if (!needsMeta && refExists) continue;

        console.log(`\nRepair ${cust.email}:`);
        if (needsMeta) console.log(`  - set customer.metadata.referral_code = ${se.refer_code}`);
        if (!refExists) console.log(`  - insert affiliate_referrals row`);

        if (!confirm) continue;

        if (needsMeta) {
            await client.query(
                `UPDATE customer
                 SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{referral_code}', to_jsonb($2::text))
                 WHERE id = $1`,
                [cust.id, se.refer_code]
            );
        }
        if (!refExists) {
            const name = [cust.first_name, cust.last_name].filter(Boolean).join(" ").trim() || "Customer";
            await client.query(
                `INSERT INTO affiliate_referrals (affiliate_code, customer_id, customer_email, customer_name, referred_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT DO NOTHING`,
                [se.refer_code, cust.id, cust.email, name]
            ).catch(async () => {
                await client.query(
                    `INSERT INTO affiliate_referrals (affiliate_code, customer_id, customer_email, customer_name, referred_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [se.refer_code, cust.id, cust.email, name]
                );
            });
        }
        fixed += 1;
    }
    return fixed;
}

async function getOrderLineItems(client, orderId) {
    const items = await client.query(
        `SELECT oi.item_id, oi.quantity, oli.unit_price, oli.product_id,
                p.title AS product_name
         FROM order_item oi
         LEFT JOIN order_line_item oli ON oli.id = oi.item_id
         LEFT JOIN product p ON p.id = oli.product_id
         WHERE oi.order_id = $1
         LIMIT 5`,
        [orderId]
    ).catch(() => ({ rows: [] }));

    if (items.rows.length) return items.rows;

    return (
        await client.query(
            `SELECT id AS item_id, product_id, title AS product_name, quantity, unit_price
             FROM order_line_item
             WHERE order_id = $1
             LIMIT 5`,
            [orderId]
        ).catch(() => ({ rows: [] }))
    ).rows;
}

async function backfillOrder(client, order, se, confirm) {
    const existing = await client.query(
        `SELECT COUNT(*)::int AS n FROM affiliate_commission_log WHERE order_id = $1`,
        [order.id]
    );
    if (existing.rows[0]?.n > 0) {
        console.log(`  skip ${order.id} — already has commission rows`);
        return false;
    }

    const referCode = order.referral_code || se.refer_code;
    if (!referCode) {
        console.log(`  skip ${order.id} — no referral_code on order`);
        return false;
    }

    const items = await getOrderLineItems(client, order.id);
    if (!items.length) {
        console.log(`  skip ${order.id} — no line items found`);
        return false;
    }

    const baseUrl = process.env.BASE_URL || "http://localhost:3001";
    console.log(`  backfill ${order.id} via webhook (${items.length} item(s), ref=${referCode})`);

    if (!confirm) return true;

    for (const item of items) {
        const unitPrice = Number.parseFloat(String(item.unit_price ?? 0)) / 100 || Number.parseFloat(String(item.unit_price ?? 0));
        const price = unitPrice > 0 ? unitPrice : Number.parseFloat(String(order.order_amount ?? 1950));
        const payload = {
            order_id: order.id,
            affiliate_code: referCode,
            product_id: item.product_id,
            product_name: item.product_name || "Product",
            quantity: item.quantity || 1,
            item_price: price,
            order_amount: price * (item.quantity || 1),
            status: "PENDING",
            customer_id: order.customer_id,
            customer_email: order.email,
        };

        const res = await fetch(`${baseUrl}/api/webhook/commission`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error(`    webhook failed ${res.status}:`, body);
            return false;
        }
        console.log(`    item ${item.product_id}: ok`);
    }
    return true;
}

async function main() {
    const opts = parseArgs();
    if (!loadDatabaseUrl()) {
        console.error("DATABASE_URL not found");
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        const se = await resolveSe(client, opts.se);
        if (!se) {
            console.error(`No affiliate_user for: ${opts.se}`);
            process.exit(1);
        }

        const report = await diagnose(client, se, opts.customer);

        const ordersToFix = [];
        for (const order of report.orders) {
            if (String(order.status || "").toLowerCase() === "draft") continue;
            const count = (
                await client.query(
                    `SELECT COUNT(*)::int AS n FROM affiliate_commission_log WHERE order_id = $1`,
                    [order.id]
                )
            ).rows[0]?.n;
            if (count === 0 && (order.referral_code === se.refer_code || !order.referral_code)) {
                ordersToFix.push(order);
            }
        }

        if (ordersToFix.length) {
            console.log("\n=== Orders missing commission ledger ===");
            console.table(ordersToFix.map((o) => ({
                id: o.id,
                referral_code: o.referral_code,
                created_at: o.created_at,
            })));
        }

        if (opts.repair && report.customers.length) {
            console.log(`\n=== Repair links (${opts.confirm ? "EXECUTE" : "DRY RUN"}) ===`);
            const n = await repairLinks(client, se, report.customers, opts.confirm);
            console.log(opts.confirm ? `Repaired ${n} customer(s)` : "Dry run — add --confirm to apply");
        }

        if (opts.backfill || (opts.repair && opts.confirm)) {
            console.log(`\n=== Backfill commission (${opts.confirm ? "EXECUTE" : "DRY RUN"}) ===`);
            for (const order of ordersToFix) {
                await backfillOrder(client, order, se, opts.confirm);
            }
        }

        console.log("\n=== Summary ===");
        console.log(`Referrals rows: ${report.refs.length}`);
        console.log(`Linked customers: ${report.customers.length}`);
        console.log(`Recent orders: ${report.orders.length}`);
        console.log(`Orders needing backfill: ${ordersToFix.length}`);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
