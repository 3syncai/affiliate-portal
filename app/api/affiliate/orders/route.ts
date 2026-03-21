import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

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

    try {
      await pool.query(
        `
          UPDATE affiliate_commission_log acl
          SET status = 'CREDITED',
              credited_at = COALESCE(credited_at, NOW())
          FROM "order" o
          LEFT JOIN order_fulfillment ofl ON ofl.order_id = o.id
          LEFT JOIN fulfillment f ON f.id = ofl.fulfillment_id
          WHERE o.id = acl.order_id
            AND acl.affiliate_code = $1
            AND acl.status IS DISTINCT FROM 'CREDITED'
            AND (
              LOWER(COALESCE(o.status::text, '')) IN ('completed')
              OR f.delivered_at IS NOT NULL
              OR f.shipped_at IS NOT NULL
            )
            AND o.canceled_at IS NULL
            AND (f.id IS NULL OR f.canceled_at IS NULL)
        `,
        [affiliateCode]
      );
    } catch (syncError) {
      console.error('Commission delivery sync failed:', syncError);
    }

    const rateRes = await pool.query(
      `SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`
    );
    const affiliateRateRaw = parseFloat(rateRes.rows[0]?.commission_percentage || '0');
    const affiliateRateDecimal = affiliateRateRaw / 100;

    const ordersResult = await pool.query(
      `
        SELECT
          id,
          order_id,
          product_name,
          customer_name,
          customer_email,
          order_amount,
          commission_rate,
          COALESCE(affiliate_commission, commission_amount * ${affiliateRateDecimal}) as affiliate_commission,
          commission_source,
          status,
          created_at
        FROM affiliate_commission_log
        WHERE affiliate_code = $1
        ORDER BY created_at DESC
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
      commission_amount: parseFloat(row.affiliate_commission || '0'),
      commission_source: row.commission_source,
      status: row.status,
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
