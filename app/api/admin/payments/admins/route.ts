import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Fetch all Branch Admins with their earnings
        const branchQuery = `
            SELECT 
                ba.id,
                ba.first_name,
                ba.last_name,
                ba.email,
                ba.branch,
                ba.city,
                ba.state,
                'branch' as admin_type,
                COALESCE(
                    (SELECT SUM(acl.commission_amount) 
                     FROM affiliate_commission_log acl
                     JOIN affiliate_user au ON acl.affiliate_code = au.refer_code
                     WHERE LOWER(au.branch) = LOWER(ba.branch)), 
                    0
                ) as total_commission_base,
                (SELECT commission_percentage FROM commission_rates WHERE role_type = 'branch') as commission_rate,
                COALESCE(
                    (SELECT SUM(amount) 
                     FROM admin_payments 
                     WHERE recipient_id::uuid = ba.id AND recipient_type = 'branch' AND status = 'completed'), 
                    0
                ) as paid_amount
            FROM branch_admin ba
            WHERE ba.is_active = true
            ORDER BY ba.first_name
        `;

        // Fetch all Area Sales Managers with their earnings (using stores table)
        const asmQuery = `
            SELECT 
                asm.id,
                asm.first_name,
                asm.last_name,
                asm.email,
                asm.city,
                asm.state,
                'asm' as admin_type,
                COALESCE(
                    (SELECT SUM(acl.commission_amount) 
                     FROM affiliate_commission_log acl
                     JOIN affiliate_user au ON acl.affiliate_code = au.refer_code
                     JOIN stores s ON LOWER(au.branch) = LOWER(s.branch_name)
                     WHERE LOWER(s.city) = LOWER(asm.city) AND LOWER(s.state) = LOWER(asm.state)), 
                    0
                ) as total_commission_base,
                (SELECT commission_percentage FROM commission_rates WHERE role_type = 'area') as commission_rate,
                COALESCE(
                    (SELECT SUM(amount) 
                     FROM admin_payments 
                     WHERE recipient_id::uuid = asm.id AND recipient_type = 'asm' AND status = 'completed'), 
                    0
                ) as paid_amount
            FROM area_sales_manager asm
            WHERE asm.is_active = true
            ORDER BY asm.first_name
        `;

        // Fetch all State Admins with their earnings (using stores table)
        const stateQuery = `
            SELECT 
                sa.id,
                sa.first_name,
                sa.last_name,
                sa.email,
                sa.state,
                'state' as admin_type,
                COALESCE(
                    (SELECT SUM(acl.commission_amount) 
                     FROM affiliate_commission_log acl
                     JOIN affiliate_user au ON acl.affiliate_code = au.refer_code
                     JOIN stores s ON LOWER(au.branch) = LOWER(s.branch_name)
                     WHERE LOWER(s.state) = LOWER(sa.state)), 
                    0
                ) as total_commission_base,
                (SELECT commission_percentage FROM commission_rates WHERE role_type = 'state') as commission_rate,
                COALESCE(
                    (SELECT SUM(amount) 
                     FROM admin_payments 
                     WHERE recipient_id::uuid = sa.id AND recipient_type = 'state' AND status = 'completed'), 
                    0
                ) as paid_amount
            FROM state_admin sa
            WHERE sa.is_active = true
            ORDER BY sa.first_name
        `;

        const [branchResult, asmResult, stateResult] = await Promise.all([
            pool.query(branchQuery),
            pool.query(asmQuery),
            pool.query(stateQuery)
        ]);

        // Combine and format all admins
        const allAdmins = [
            ...branchResult.rows.map(admin => {
                const lifetimeEarnings = parseFloat(admin.total_commission_base || '0') * (parseFloat(admin.commission_rate || '5') / 100);
                const paidAmount = parseFloat(admin.paid_amount || '0');
                return {
                    id: admin.id,
                    name: `${admin.first_name} ${admin.last_name}`,
                    email: admin.email,
                    type: admin.admin_type,
                    typeLabel: 'Branch Admin',
                    location: admin.branch,
                    city: admin.city,
                    state: admin.state,
                    totalCommissionBase: parseFloat(admin.total_commission_base || '0'),
                    commissionRate: parseFloat(admin.commission_rate || '5'),
                    lifetimeEarnings,
                    paidAmount,
                    currentEarnings: lifetimeEarnings - paidAmount,
                    totalEarnings: lifetimeEarnings - paidAmount // For backward compatibility
                };
            }),
            ...asmResult.rows.map(admin => {
                const lifetimeEarnings = parseFloat(admin.total_commission_base || '0') * (parseFloat(admin.commission_rate || '3') / 100);
                const paidAmount = parseFloat(admin.paid_amount || '0');
                return {
                    id: admin.id,
                    name: `${admin.first_name} ${admin.last_name}`,
                    email: admin.email,
                    type: admin.admin_type,
                    typeLabel: 'Area Sales Manager',
                    location: admin.city,
                    city: admin.city,
                    state: admin.state,
                    totalCommissionBase: parseFloat(admin.total_commission_base || '0'),
                    commissionRate: parseFloat(admin.commission_rate || '3'),
                    lifetimeEarnings,
                    paidAmount,
                    currentEarnings: lifetimeEarnings - paidAmount,
                    totalEarnings: lifetimeEarnings - paidAmount
                };
            }),
            ...stateResult.rows.map(admin => {
                const lifetimeEarnings = parseFloat(admin.total_commission_base || '0') * (parseFloat(admin.commission_rate || '2') / 100);
                const paidAmount = parseFloat(admin.paid_amount || '0');
                return {
                    id: admin.id,
                    name: `${admin.first_name} ${admin.last_name}`,
                    email: admin.email,
                    type: admin.admin_type,
                    typeLabel: 'State Admin',
                    location: admin.state,
                    city: null,
                    state: admin.state,
                    totalCommissionBase: parseFloat(admin.total_commission_base || '0'),
                    commissionRate: parseFloat(admin.commission_rate || '2'),
                    lifetimeEarnings,
                    paidAmount,
                    currentEarnings: lifetimeEarnings - paidAmount,
                    totalEarnings: lifetimeEarnings - paidAmount
                };
            })
        ];

        await pool.end();

        return NextResponse.json({
            success: true,
            admins: allAdmins,
            count: allAdmins.length
        });

    } catch (error: any) {
        console.error("Failed to fetch payable admins:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
