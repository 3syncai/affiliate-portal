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

    const rateRes = await pool.query(
      `SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`
    );
    const affiliateRateRaw = parseFloat(rateRes.rows[0]?.commission_percentage || '0');
    const affiliateRateDecimal = affiliateRateRaw / 100;

    const referralsQuery = `
      SELECT
        ar.customer_id as id,
        COALESCE(ar.customer_email, ar.customer_id) as customer_email,
        COALESCE(ar.customer_name, 'Customer ' || SUBSTRING(ar.customer_id FROM 5 FOR 8)) as customer_name,
        ar.referred_at,
        COUNT(DISTINCT acl.order_id) as order_count,
        COALESCE(SUM(COALESCE(acl.affiliate_commission, acl.commission_amount * ${affiliateRateDecimal})), 0) as total_earned
      FROM affiliate_referrals ar
      LEFT JOIN affiliate_commission_log acl
        ON acl.customer_id = ar.customer_id
       AND acl.affiliate_code = ar.affiliate_code
      WHERE ar.affiliate_code = $1
      GROUP BY ar.customer_id, ar.customer_email, ar.customer_name, ar.referred_at
      ORDER BY ar.referred_at DESC
    `;

    const referralsResult = await pool.query(referralsQuery, [affiliateCode]);

    const referrals = referralsResult.rows.map((row) => ({
      id: row.id,
      customer_email: row.customer_email,
      customer_name: row.customer_name,
      referred_at: row.referred_at,
      total_orders: parseInt(row.order_count || '0'),
      total_commission: parseFloat(row.total_earned || '0')
    }));

    return NextResponse.json({
      success: true,
      total: referrals.length,
      referrals
    });
  } catch (error) {
    console.error('Failed to fetch affiliate referrals:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch referrals',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
