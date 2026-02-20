import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

/**
 * GET /api/asm/my-referrals?adminId=xxx
 * 
 * Fetches customers who were directly referred by this ASM
 * Shows their orders and commissions earned
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('adminId');

        if (!adminId) {
            return NextResponse.json(
                { success: false, error: 'ASM ID required' },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get ASM's refer_code
        const asmResult = await pool.query(
            'SELECT id, first_name, last_name, refer_code FROM area_sales_manager WHERE id = $1',
            [adminId]
        );

        if (asmResult.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'ASM not found' },
                { status: 404 }
            );
        }

        const referCode = asmResult.rows[0].refer_code;

        if (!referCode) {
            return NextResponse.json({
                success: true,
                stats: {
                    total_customers: 0,
                    total_orders: 0,
                    total_sales: 0,
                    total_commissions: 0
                },
                customers: [],
                recentOrders: []
            });
        }

        // 1. Get all customers who used this referral code (from customer table)
        const customersQuery = `
            SELECT 
                id,
                first_name,
                last_name,
                email,
                phone,
                created_at,
                metadata
            FROM customer
            WHERE metadata->>'referral_code' = $1
            ORDER BY created_at DESC
        `;
        const customersResult = await pool.query(customersQuery, [referCode]);

        // 2. Get all orders/commissions for ASM direct referrals
        const ordersQuery = `
            SELECT 
                acl.id,
                acl.order_id,
                acl.product_name,
                acl.order_amount,
                acl.commission_rate,
                acl.commission_amount,
                acl.affiliate_rate,
                acl.affiliate_commission,
                acl.customer_id,
                acl.customer_name,
                acl.customer_email,
                acl.status,
                acl.created_at
            FROM affiliate_commission_log acl
            WHERE acl.affiliate_code = $1 AND acl.commission_source = 'asm_direct'
            ORDER BY acl.created_at DESC
        `;
        const ordersResult = await pool.query(ordersQuery, [referCode]);

        // 3. Combine the data
        const customerMap = new Map();

        // Initialize with all referred customers (even if no orders)
        customersResult.rows.forEach(cust => {
            const name = `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Unknown';

            customerMap.set(cust.id, {
                customer_id: cust.id,
                customer_name: name,
                customer_email: cust.email,
                first_order_at: null,
                joined_at: cust.created_at,
                total_orders: 0,
                total_order_value: 0,
                total_commission: 0,
                orders: []
            });
        });

        // Add order data
        ordersResult.rows.forEach(order => {
            const customerId = order.customer_id;

            // If customer exists in our referred list, update them
            if (customerId && !customerMap.has(customerId)) {
                customerMap.set(customerId, {
                    customer_id: customerId,
                    customer_name: order.customer_name || 'Customer',
                    customer_email: order.customer_email,
                    first_order_at: order.created_at,
                    joined_at: null,
                    total_orders: 0,
                    total_order_value: 0,
                    total_commission: 0,
                    orders: []
                });
            }

            if (customerId && customerMap.has(customerId)) {
                const customer = customerMap.get(customerId);

                // Set first order date
                if (!customer.first_order_at || new Date(order.created_at) < new Date(customer.first_order_at)) {
                    customer.first_order_at = order.created_at;
                }

                customer.total_orders += 1;
                customer.total_order_value += parseFloat(order.order_amount || '0');
                customer.total_commission += parseFloat(order.affiliate_commission || '0');
                customer.orders.push({
                    id: order.id,
                    order_id: order.order_id,
                    product_name: order.product_name,
                    order_amount: parseFloat(order.order_amount || '0'),
                    commission_earned: parseFloat(order.affiliate_commission || '0'),
                    status: order.status,
                    created_at: order.created_at
                });
            }
        });

        const customers = Array.from(customerMap.values());

        // Calculate totals with status breakdown
        const totalSales = ordersResult.rows.reduce((sum, row) => sum + parseFloat(row.order_amount || '0'), 0);
        const totalCommissions = ordersResult.rows.reduce((sum, row) => sum + parseFloat(row.affiliate_commission || '0'), 0);

        // Separate pending and credited
        const pendingCommissions = ordersResult.rows
            .filter(row => row.status === 'PENDING')
            .reduce((sum, row) => sum + parseFloat(row.affiliate_commission || '0'), 0);

        const creditedCommissions = ordersResult.rows
            .filter(row => row.status === 'CREDITED')
            .reduce((sum, row) => sum + parseFloat(row.affiliate_commission || '0'), 0);

        const stats = {
            total_customers: customers.length,
            total_orders: ordersResult.rows.length,
            total_sales: totalSales,
            total_commissions: totalCommissions,
            pending_commissions: pendingCommissions,
            credited_commissions: creditedCommissions
        };


        return NextResponse.json({
            success: true,
            stats,
            customers,
            recentOrders: ordersResult.rows.slice(0, 10).map(row => ({
                order_id: row.order_id,
                product_name: row.product_name,
                order_amount: parseFloat(row.order_amount || '0'),
                commission_earned: parseFloat(row.affiliate_commission || '0'),
                customer_name: row.customer_name,
                status: row.status,
                created_at: row.created_at
            }))
        });

    } catch (error) {
        console.error('Failed to fetch ASM referrals:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch ASM referrals',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
