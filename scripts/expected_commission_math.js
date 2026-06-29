/* eslint-disable */
/**
 * Expected commission splits for math testing (base hierarchy + optional additional bonus).
 *
 * Base pool on ₹1000 @ 10% product commission = ₹100 (rates 40/30/20/10):
 *   ASM direct (branch_admin refer code):     seller ₹70 + BM ₹20 + State ₹10
 *   Branch Head direct (asm_direct):          seller ₹90 + State ₹10
 *   State Head direct (state_admin_direct):   seller ₹100
 *
 * Additional commission (active campaign on product):
 *   Only the direct seller row gets orderAmount × additionalRate%; override rows unchanged.
 */

const toNum = (v) => Number.parseFloat(String(v ?? 0)) || 0;

const PLACEHOLDER_CODES = new Set(['BRANCH', 'AREA', 'STATE']);

/** Default test mode: base-only (Option A). Set COMMISSION_TEST_MODE=with-additional for Option B. */
const TEST_MODE = String(process.env.COMMISSION_TEST_MODE || 'base-only').toLowerCase();

const BASE_SPLITS_BY_SELLER_SOURCE = {
    branch_admin: [
        { commission_source: 'branch_admin', role: 'seller', sharePct: 70 },
        { commission_source: 'area_manager', role: 'override', sharePct: 20 },
        { commission_source: 'state_admin', role: 'override', sharePct: 10 },
    ],
    asm_direct: [
        { commission_source: 'asm_direct', role: 'seller', sharePct: 90 },
        { commission_source: 'state_admin', role: 'override', sharePct: 10 },
    ],
    state_admin_direct: [
        { commission_source: 'state_admin_direct', role: 'seller', sharePct: 100 },
    ],
    affiliate: [
        { commission_source: 'affiliate', role: 'seller', sharePct: 40 },
        { commission_source: 'branch_admin', role: 'override', sharePct: 30 },
        { commission_source: 'area_manager', role: 'override', sharePct: 20 },
        { commission_source: 'state_admin', role: 'override', sharePct: 10 },
    ],
};

function visibilityFromCommissionSource(source) {
    const normalized = String(source || '').toLowerCase();
    if (normalized === 'affiliate') return 'partner';
    if (normalized === 'branch_admin') return 'branch';
    if (normalized === 'area_manager' || normalized === 'asm_direct') return 'asm';
    if (normalized === 'state_admin' || normalized === 'state_admin_direct') return 'state';
    return 'partner';
}

function sellerVisibilityFromReferrer(portalRole) {
    if (portalRole === 'state') return 'state';
    if (portalRole === 'branch_manager') return 'asm';
    if (portalRole === 'asm') return 'branch';
    return 'partner';
}

function isDirectSellerRow(row) {
    const source = String(row.commission_source || '').trim().toLowerCase();
    const affiliateCode = String(row.affiliate_code || '').trim().toUpperCase();

    if (source === 'affiliate' || source === 'asm_direct' || source === 'state_admin_direct') {
        return true;
    }
    if (source === 'branch_admin') {
        return affiliateCode !== 'BRANCH' && affiliateCode !== 'AREA' && affiliateCode !== 'STATE';
    }
    return false;
}

function isOverrideRow(row) {
    const source = String(row.commission_source || '').trim().toLowerCase();
    const affiliateCode = String(row.affiliate_code || '').trim().toUpperCase();
    if (PLACEHOLDER_CODES.has(affiliateCode)) return true;
    if (source === 'area_manager' || source === 'state_admin') {
        return PLACEHOLDER_CODES.has(affiliateCode) || affiliateCode === 'AREA' || affiliateCode === 'STATE';
    }
    if (source === 'branch_admin' && PLACEHOLDER_CODES.has(affiliateCode)) return true;
    return false;
}

function detectSellerSourceFromLedger(rows) {
    for (const row of rows || []) {
        const source = String(row.commission_source || '').toLowerCase();
        if (source === 'state_admin_direct') return 'state_admin_direct';
        if (source === 'asm_direct') return 'asm_direct';
        if (isDirectSellerRow(row) && source === 'branch_admin') return 'branch_admin';
        if (source === 'affiliate' && isDirectSellerRow(row)) return 'affiliate';
    }
    return null;
}

function computeExpectedRows({
    sellerSource,
    orderAmount,
    poolAmount,
    additionalRate = 0,
}) {
    const splits = BASE_SPLITS_BY_SELLER_SOURCE[sellerSource];
    if (!splits) return [];

    const pool = poolAmount != null ? toNum(poolAmount) : toNum(orderAmount) * 0.1;
    const additionalAmount = Number((toNum(orderAmount) * (toNum(additionalRate) / 100)).toFixed(2));

    return splits.map((split) => {
        const basePayout = Number((pool * (split.sharePct / 100)).toFixed(2));
        const extra = split.role === 'seller' ? additionalAmount : 0;
        return {
            commission_source: split.commission_source,
            role: split.role,
            sharePct: split.sharePct,
            basePayout,
            additionalAmount: extra,
            expectedPayout: Number((basePayout + extra).toFixed(2)),
        };
    });
}

function assertOrderLedger(rows, {
    sellerSource,
    orderAmount,
    poolAmount,
    additionalRate = 0,
    tolerance = 0.02,
}) {
    const expected = computeExpectedRows({ sellerSource, orderAmount, poolAmount, additionalRate });
    const issues = [];
    const notes = [];

    for (const exp of expected) {
        const matches = (rows || []).filter(
            (r) => String(r.commission_source || '').toLowerCase() === exp.commission_source.toLowerCase()
        );
        if (matches.length === 0) {
            issues.push(`Missing ledger row for commission_source=${exp.commission_source}`);
            continue;
        }
        for (const row of matches) {
            const payout = toNum(row.affiliate_commission);
            const additional = toNum(row.additional_commission_amount);
            if (Math.abs(payout - exp.expectedPayout) > tolerance) {
                issues.push(
                    `${exp.commission_source}: affiliate_commission ₹${payout.toFixed(2)} ` +
                    `expected ₹${exp.expectedPayout.toFixed(2)} (base ₹${exp.basePayout.toFixed(2)}` +
                    (exp.additionalAmount ? ` + additional ₹${exp.additionalAmount.toFixed(2)}` : '') +
                    ')'
                );
            }
            if (exp.role === 'seller') {
                if (Math.abs(additional - exp.additionalAmount) > tolerance) {
                    issues.push(
                        `${exp.commission_source}: additional_commission_amount ₹${additional.toFixed(2)} ` +
                        `expected ₹${exp.additionalAmount.toFixed(2)}`
                    );
                }
            } else if (additional > tolerance) {
                issues.push(
                    `${exp.commission_source}: override row must have additional_commission_amount=0, got ₹${additional.toFixed(2)}`
                );
            }
        }
    }

    for (const row of rows || []) {
        if (isOverrideRow(row) && toNum(row.additional_commission_amount) > tolerance) {
            issues.push(
                `Override row ${row.commission_source}/${row.affiliate_code} has additional ₹${toNum(row.additional_commission_amount).toFixed(2)} (expected 0)`
            );
        }
    }

    if (expected.length) {
        notes.push(`Path: ${sellerSource} | pool ₹${(poolAmount != null ? toNum(poolAmount) : toNum(orderAmount) * 0.1).toFixed(2)} | additional ${additionalRate}%`);
        for (const exp of expected) {
            notes.push(
                `  ${exp.commission_source} (${exp.role}): ₹${exp.expectedPayout.toFixed(2)}` +
                (exp.additionalAmount ? ` (base ₹${exp.basePayout.toFixed(2)} + bonus ₹${exp.additionalAmount.toFixed(2)})` : '')
            );
        }
    }

    return { ok: issues.length === 0, issues, notes, expected };
}

function summarizeAdditionalCommission(rows) {
    let sellerAdditional = 0;
    let overrideAdditional = 0;
    for (const row of rows || []) {
        const amt = toNum(row.additional_commission_amount);
        if (amt <= 0) continue;
        if (isDirectSellerRow(row)) sellerAdditional += amt;
        else overrideAdditional += amt;
    }
    return {
        sellerAdditional: Number(sellerAdditional.toFixed(2)),
        overrideAdditional: Number(overrideAdditional.toFixed(2)),
        totalAdditional: Number((sellerAdditional + overrideAdditional).toFixed(2)),
    };
}

module.exports = {
    TEST_MODE,
    toNum,
    visibilityFromCommissionSource,
    sellerVisibilityFromReferrer,
    isDirectSellerRow,
    isOverrideRow,
    detectSellerSourceFromLedger,
    computeExpectedRows,
    assertOrderLedger,
    summarizeAdditionalCommission,
    BASE_SPLITS_BY_SELLER_SOURCE,
};
