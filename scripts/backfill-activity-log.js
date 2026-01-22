const { Pool } = require('pg');

async function backfillActivityLog() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: false
    });

    try {
        console.log('=== Backfilling Activity Log with Historical Data ===\n');

        // 1. Backfill commissions
        console.log('1. Migrating commission data...');
        const commissionResult = await pool.query(`
            INSERT INTO activity_log (
                activity_type,
                actor_id,
                actor_name,
                actor_role,
                actor_branch,
                actor_area,
                actor_state,
                target_id,
                target_name,
                amount,
                product_name,
                description,
                created_at
            )
            SELECT 
                'commission_earned' as activity_type,
                au.id as actor_id,
                CONCAT(au.first_name, ' ', au.last_name) as actor_name,
                'branch' as actor_role,
                au.branch as actor_branch,
                au.city as actor_area,
                au.state as actor_state,
                acl.order_id as target_id,
                acl.product_name as target_name,
                COALESCE(acl.affiliate_commission, acl.commission_amount * 0.70) as amount,
                acl.product_name,
                CONCAT('affiliate ', au.first_name, ' ', au.last_name, ' earned ₹', 
                    ROUND(COALESCE(acl.affiliate_commission, acl.commission_amount * 0.70), 2), 
                    ' commission on ', acl.product_name) as description,
                acl.created_at
            FROM affiliate_commission_log acl
            JOIN affiliate_user au ON au.refer_code = acl.affiliate_code
            WHERE NOT EXISTS (
                SELECT 1 FROM activity_log al 
                WHERE al.target_id = acl.order_id 
                AND al.activity_type = 'commission_earned'
            )
            ORDER BY acl.created_at ASC
        `);
        console.log(`   ✅ Migrated ${commissionResult.rowCount} commission records\n`);

        // 2. Backfill withdrawal approvals
        console.log('2. Migrating withdrawal approvals...');
        const approvalResult = await pool.query(`
            INSERT INTO activity_log (
                activity_type,
                actor_id,
                actor_name,
                actor_role,
                actor_branch,
                actor_area,
                actor_state,
                target_id,
                target_name,
                amount,
                description,
                created_at
            )
            SELECT 
                'payment_approved' as activity_type,
                au.id as actor_id,
                CONCAT(au.first_name, ' ', au.last_name) as actor_name,
                'branch' as actor_role,
                au.branch as actor_branch,
                au.city as actor_area,
                au.state as actor_state,
                wr.id::text as target_id,
                CONCAT(au.first_name, ' ', au.last_name) as target_name,
                wr.withdrawal_amount as amount,
                CONCAT('approved ₹', ROUND(wr.withdrawal_amount, 2), ' withdrawal for ', 
                    au.first_name, ' ', au.last_name) as description,
                wr.reviewed_at as created_at
            FROM withdrawal_request wr
            JOIN affiliate_user au ON au.refer_code = wr.affiliate_code
            WHERE wr.status IN ('APPROVED', 'PAID')
            AND wr.reviewed_at IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM activity_log al 
                WHERE al.target_id = wr.id::text 
                AND al.activity_type = 'payment_approved'
            )
            ORDER BY wr.reviewed_at ASC
        `);
        console.log(`   ✅ Migrated ${approvalResult.rowCount} withdrawal approval records\n`);

        // 3. Backfill payments marked as paid
        console.log('3. Migrating paid withdrawals...');
        const paidResult = await pool.query(`
            INSERT INTO activity_log (
                activity_type,
                actor_id,
                actor_name,
                actor_role,
                actor_branch,
                actor_area,
                actor_state,
                target_id,
                target_name,
                amount,
                description,
                metadata,
                created_at
            )
            SELECT 
                'payment_paid' as activity_type,
                au.id as actor_id,
                CONCAT(au.first_name, ' ', au.last_name) as actor_name,
                'branch' as actor_role,
                au.branch as actor_branch,
                au.city as actor_area,
                au.state as actor_state,
                wr.id::text as target_id,
                CONCAT(au.first_name, ' ', au.last_name) as target_name,
                wr.net_payable as amount,
                CONCAT('paid ₹', ROUND(wr.net_payable, 2), ' to ', 
                    au.first_name, ' ', au.last_name,
                    CASE WHEN wr.transaction_id IS NOT NULL 
                        THEN CONCAT(' (Txn: ', wr.transaction_id, ')') 
                        ELSE '' 
                    END) as description,
                jsonb_build_object(
                    'transactionId', wr.transaction_id,
                    'paymentDate', wr.payment_date
                ) as metadata,
                wr.paid_at as created_at
            FROM withdrawal_request wr
            JOIN affiliate_user au ON au.refer_code = wr.affiliate_code
            WHERE wr.status = 'PAID'
            AND wr.paid_at IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM activity_log al 
                WHERE al.target_id = wr.id::text 
                AND al.activity_type = 'payment_paid'
            )
            ORDER BY wr.paid_at ASC
        `);
        console.log(`   ✅ Migrated ${paidResult.rowCount} payment records\n`);

        // 4. Show summary
        const totalCount = await pool.query('SELECT COUNT(*) FROM activity_log');
        console.log('🎉 Backfill completed!');
        console.log(`   Total activities in activity_log: ${totalCount.rows[0].count}`);
        console.log('\n✅ Now refresh your ASM and State admin dashboards to see the activities!');

    } catch (error) {
        console.error('❌ Backfill failed:', error.message);
        console.error('Stack:', error.stack);
        throw error;
    } finally {
        await pool.end();
    }
}

backfillActivityLog().catch(console.error);
