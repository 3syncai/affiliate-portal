import type { Pool } from "pg";
import { COMMISSION_IS_RETURN_OR_CANCELLED_SQL } from "@/lib/dashboard-return-sql";

export type AffiliateDashboardStats = {
  totalAgents: number;
  pendingRequests: number;
  totalCommission: number;
  pendingPayout: number;
  totalOrders: number;
  totalReturns: number;
};

export type AdminRoleStats = {
  stateAdmins: number;
  areaManagers: number;
  branchAdmins: number;
};

const toCount = (value: string | number | null | undefined) =>
  Number.parseInt(String(value ?? 0), 10) || 0;

const toAmount = (value: string | number | null | undefined) =>
  Number.parseFloat(String(value ?? 0)) || 0;

export async function fetchAffiliateDashboardStats(
  pool: Pool,
): Promise<AffiliateDashboardStats> {
  const [
    totalAgentsResult,
    pendingRequestsResult,
    totalCommissionResult,
    pendingPayoutResult,
    ordersResult,
  ] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS count FROM affiliate_user WHERE is_approved = true`,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM affiliate_user WHERE is_approved = false`,
    ),
    pool.query(`
      SELECT COALESCE(SUM(COALESCE(affiliate_commission, commission_amount)), 0) AS total
      FROM affiliate_commission_log
    `),
    pool.query(`
      SELECT COALESCE(SUM(net_payable), 0) AS total
      FROM withdrawal_request
      WHERE status IN ('PENDING', 'APPROVED')
    `),
    pool.query(`
      SELECT
        COUNT(DISTINCT order_id)::int AS total_orders,
        COUNT(DISTINCT order_id) FILTER (
          WHERE ${COMMISSION_IS_RETURN_OR_CANCELLED_SQL}
        )::int AS total_returns
      FROM affiliate_commission_log acl
    `),
  ]);

  return {
    totalAgents: toCount(totalAgentsResult.rows[0]?.count),
    pendingRequests: toCount(pendingRequestsResult.rows[0]?.count),
    totalCommission: toAmount(totalCommissionResult.rows[0]?.total),
    pendingPayout: toAmount(pendingPayoutResult.rows[0]?.total),
    totalOrders: toCount(ordersResult.rows[0]?.total_orders),
    totalReturns: toCount(ordersResult.rows[0]?.total_returns),
  };
}

export async function fetchAdminRoleStats(pool: Pool): Promise<AdminRoleStats> {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM state_admin WHERE is_active = true) AS state_admins,
      (SELECT COUNT(*)::int FROM area_sales_manager WHERE is_active = true) AS area_managers,
      (SELECT COUNT(*)::int FROM branch_admin WHERE is_active = true) AS branch_admins
  `);

  const row = result.rows[0] ?? {};
  return {
    stateAdmins: toCount(row.state_admins),
    areaManagers: toCount(row.area_managers),
    branchAdmins: toCount(row.branch_admins),
  };
}
