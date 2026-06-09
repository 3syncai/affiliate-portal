import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { syncAffiliateCommissionStatuses } from '@/lib/affiliate-commission-sync';
import { COMMISSION_HAS_RETURN_SQL } from '@/lib/dashboard-return-sql';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const affiliateCode = request.headers.get('x-affiliate-code');

    if (!affiliateCode) {
      return NextResponse.json(
        { success: false, error: 'Affiliate code required' },
        { status: 400 }
      );
    }

    const userResult = await pool.query(
      'SELECT id FROM affiliate_user WHERE refer_code = $1',
      [affiliateCode]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    await syncAffiliateCommissionStatuses(pool, { affiliateCode, logPrefix: '[Affiliate Orders]' });

    const rateRes = await pool.query(
      `SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`
    );
    const affiliateRateRaw = parseFloat(rateRes.rows[0]?.commission_percentage || '0');
    const affiliateRateDecimal = affiliateRateRaw / 100;

    const ordersResult = await pool.query(
      `
        SELECT
          acl.id,
          acl.order_id,
          acl.product_name,
          acl.customer_name,
          acl.customer_email,
          acl.order_amount,
          acl.commission_rate,
          COALESCE(acl.affiliate_commission, acl.commission_amount * ${affiliateRateDecimal}) as affiliate_commission,
          acl.commission_source,
          acl.status,
          acl.unlock_at,
          acl.credited_at,
          acl.created_at,
          (${COMMISSION_HAS_RETURN_SQL}) AS has_return
        FROM affiliate_commission_log acl
        WHERE acl.affiliate_code = $1
        ORDER BY acl.created_at DESC
      `,
      [affiliateCode]
    );

    const orders = ordersResult.rows.map((row) => ({
      id: row.id,
      order_id: row.order_id,
      product_name: row.product_name,
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      order_amount: parseFloat(row.order_amount || '0'),
      commission_rate: parseFloat(row.commission_rate || '0'),
      commission_amount:
        row.status === 'CANCELLED' || row.has_return
          ? 0
          : parseFloat(row.affiliate_commission || '0'),
      commission_source: row.commission_source,
      status: row.status,
      unlock_at: row.unlock_at,
      credited_at: row.credited_at,
      has_return: !!row.has_return,
      created_at: row.created_at
    }));

    return NextResponse.json({
      success: true,
      total: orders.length,
      orders
    });
  } catch (error) {
    console.error('Failed to fetch affiliate orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch orders',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
