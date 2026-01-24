import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

/**
 * GET /api/branch/my-direct-referrals?refer_code=OWEGBR12345
 * 
 * Fetches customers who were directly referred by this branch admin
 * Shows their orders and commissions earned
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const referCode = searchParams.get('refer_code');

        if (!referCode) {
            return NextResponse.json(
                { success: false, error: 'Branch admin referral code required' },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Verify branch admin exists
        const adminCheck = await pool.query(
            'SELECT id, first_name, last_name FROM branch_admin WHERE refer_code = $1',
            [referCode]
        );

        if (adminCheck.rows.length === 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, error: 'Branch admin not found' },
                { status: 404 }
            );
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


        // 2. Get all orders/commissions for these customers
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
            WHERE (acl.affiliate_code = $1 OR acl.branch_admin_code = $1)
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
            // If not found in map (maybe not in customer table with metadata?), add them if we have an ID
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


        // Calculate totals
        const stats = {
            total_customers: customers.length,
            total_orders: ordersResult.rows.length,
            total_sales: ordersResult.rows.reduce((sum, row) => sum + parseFloat(row.order_amount || '0'), 0),
            total_commissions: ordersResult.rows.reduce((sum, row) => sum + parseFloat(row.affiliate_commission || '0'), 0)
        };

        await pool.end();

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
        console.error('Failed to fetch direct referrals:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch direct referrals',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
