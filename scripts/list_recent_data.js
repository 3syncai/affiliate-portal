/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function readDotEnv() {
    const envPath = path.join(__dirname, "..", ".env");
    const out = {};
    if (!fs.existsSync(envPath)) return out;
    for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}

const dotEnv = readDotEnv();
const connectionString =
    dotEnv.DATABASE_URL || dotEnv.NEXT_PUBLIC_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
});

const queries = [
    ["stores", "SELECT id, branch_name, city, state, is_active, created_at FROM stores ORDER BY created_at DESC LIMIT 25"],
    ["affiliate_user", "SELECT id, first_name, last_name, email, refer_code, branch, city, state, is_approved, is_active, created_at FROM affiliate_user ORDER BY created_at DESC LIMIT 20"],
    ["branch_admin", "SELECT id, first_name, last_name, email, refer_code, branch, city, state, created_at FROM branch_admin ORDER BY created_at DESC LIMIT 15"],
    ["area_sales_manager", "SELECT id, first_name, last_name, email, refer_code, city, state, created_at FROM area_sales_manager ORDER BY created_at DESC LIMIT 15"],
    ["state_admin", "SELECT id, first_name, last_name, email, refer_code, state, created_at FROM state_admin ORDER BY created_at DESC LIMIT 15"],
    ["affiliate_commission_log", "SELECT id, order_id, affiliate_code, commission_amount, created_at FROM affiliate_commission_log ORDER BY created_at DESC LIMIT 10"],
    ["affiliate_referrals", "SELECT COUNT(*)::int AS total FROM affiliate_referrals"],
    ["affiliate_admin", "SELECT id, first_name, last_name, email, created_at FROM affiliate_admin ORDER BY created_at DESC LIMIT 10"],
    ["pending_affiliates", "SELECT id, first_name, last_name, email, refer_code, is_approved, created_at FROM affiliate_user WHERE is_approved = false ORDER BY created_at DESC LIMIT 10"],
];

(async () => {
    for (const [label, sql] of queries) {
        try {
            const result = await pool.query(sql);
            console.log(`\n=== ${label} ===`);
            console.log(JSON.stringify(result.rows, null, 2));
        } catch (error) {
            console.log(`\n=== ${label} ERROR ===`);
            console.log(error.message);
        }
    }
    await pool.end();
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
