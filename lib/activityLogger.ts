// Utility for logging activities to the activity_log table
// Provides centralized activity logging with hierarchical context

import { Pool } from "pg";

/**
 * Activity types supported by the system
 */
export type ActivityType =
    | 'commission_earned'
    | 'withdrawal_requested'
    | 'payment_approved'
    | 'payment_rejected'
    | 'payment_paid'
    | 'affiliate_approved'
    | 'affiliate_rejected';

/**
 * Admin role levels in the hierarchy
 */
export type AdminRole = 'branch' | 'asm' | 'state' | 'admin';

/**
 * Parameters for logging an activity
 */
export interface ActivityLogParams {
    activityType: ActivityType;
    actorId?: string;
    actorName?: string;
    actorRole: AdminRole;
    actorBranch?: string;
    actorArea?: string;  // City for ASM
    actorState?: string;
    targetId?: string;
    targetName?: string;
    targetType?: string;
    amount?: number;
    productName?: string;
    productId?: string;
    description: string;
    metadata?: Record<string, any>;
}

/**
 * Generates hierarchical description based on admin role
 */
export function generateHierarchicalDescription(params: {
    activityType: ActivityType;
    affiliateName: string;
    amount?: number;
    productName?: string;
    branch?: string;
    area?: string;
    state?: string;
    transactionId?: string;
    forRole: AdminRole;
}): string {
    const { activityType, affiliateName, amount, productName, branch, area, state, transactionId, forRole } = params;

    let prefix = '';

    // Build hierarchical prefix based on viewer's role
    switch (forRole) {
        case 'branch':
            // Branch admin sees simple message without branch context
            prefix = '';
            break;
        case 'asm':
            // ASM sees branch context
            prefix = branch ? `In ${branch} branch, ` : '';
            break;
        case 'state':
            // State admin sees area + branch context
            if (area && branch) {
                prefix = `In ${area} area, ${branch} branch, `;
            } else if (branch) {
                prefix = `In ${branch} branch, `;
            }
            break;
        case 'admin':
            // Main admin sees full hierarchy
            if (state && area && branch) {
                prefix = `In ${state} state, ${area} area, ${branch} branch, `;
            } else if (area && branch) {
                prefix = `In ${area} area, ${branch} branch, `;
            } else if (branch) {
                prefix = `In ${branch} branch, `;
            }
            break;
    }

    // Build activity-specific message
    switch (activityType) {
        case 'commission_earned':
            if (productName) {
                return `${prefix}affiliate ${affiliateName} earned ₹${amount?.toFixed(2)} commission on ${productName}`;
            }
            return `${prefix}affiliate ${affiliateName} earned ₹${amount?.toFixed(2)} commission`;

        case 'withdrawal_requested':
            return `${prefix}affiliate ${affiliateName} requested ₹${amount?.toFixed(2)} withdrawal`;

        case 'payment_approved':
            return `${prefix}approved ₹${amount?.toFixed(2)} withdrawal for ${affiliateName}`;

        case 'payment_rejected':
            return `${prefix}rejected ₹${amount?.toFixed(2)} withdrawal for ${affiliateName}`;

        case 'payment_paid':
            if (transactionId) {
                return `${prefix}paid ₹${amount?.toFixed(2)} to ${affiliateName} (Txn: ${transactionId})`;
            }
            return `${prefix}paid ₹${amount?.toFixed(2)} to ${affiliateName}`;

        case 'affiliate_approved':
            return `${prefix}approved ${affiliateName} as affiliate`;

        case 'affiliate_rejected':
            return `${prefix}rejected ${affiliateName}'s affiliate request`;

        default:
            return `${prefix}${affiliateName} - ${activityType}`;
    }
}

/**
 * Log an activity to the database
 */
export async function logActivity(params: ActivityLogParams): Promise<boolean> {
    let pool: Pool | null = null;

    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: false  // RDS doesn't support SSL based on error
        });

        await pool.query(
            `INSERT INTO activity_log 
             (activity_type, actor_id, actor_name, actor_role, actor_branch, actor_area, actor_state,
              target_id, target_name, target_type, amount, product_name, product_id, description, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
                params.activityType,
                params.actorId || null,
                params.actorName || null,
                params.actorRole,
                params.actorBranch || null,
                params.actorArea || null,
                params.actorState || null,
                params.targetId || null,
                params.targetName || null,
                params.targetType || null,
                params.amount || null,
                params.productName || null,
                params.productId || null,
                params.description,
                params.metadata ? JSON.stringify(params.metadata) : null
            ]
        );

        await pool.end();
        console.log(`✓ Activity logged: ${params.activityType} - ${params.description}`);
        return true;

    } catch (error) {
        console.error('Failed to log activity:', error);
        if (pool) {
            try {
                await pool.end();
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        return false;
    }
}

/**
 * Log commission earned activity with automatic description generation
 */
export async function logCommissionEarned(params: {
    affiliateId: string;
    affiliateName: string;
    branch: string;
    area: string;
    state: string;
    amount: number;
    productName?: string;
    productId?: string;
    orderId?: string;
}): Promise<boolean> {
    const description = generateHierarchicalDescription({
        activityType: 'commission_earned',
        affiliateName: params.affiliateName,
        amount: params.amount,
        productName: params.productName,
        branch: params.branch,
        area: params.area,
        state: params.state,
        forRole: 'admin'  // Generate full description, filtering happens at query time
    });

    return logActivity({
        activityType: 'commission_earned',
        actorId: params.affiliateId,
        actorName: params.affiliateName,
        actorRole: 'branch',  // Commission is affiliate action, tracked at branch level
        actorBranch: params.branch,
        actorArea: params.area,
        actorState: params.state,
        targetId: params.orderId,
        targetName: params.productName,
        targetType: 'order',
        amount: params.amount,
        productName: params.productName,
        productId: params.productId,
        description,
        metadata: {
            orderId: params.orderId,
            productId: params.productId
        }
    });
}

/**
 * Log withdrawal request activity
 */
export async function logWithdrawalRequest(params: {
    affiliateId: string;
    affiliateName: string;
    branch: string;
    area: string;
    state: string;
    amount: number;
    withdrawalId: string;
}): Promise<boolean> {
    const description = generateHierarchicalDescription({
        activityType: 'withdrawal_requested',
        affiliateName: params.affiliateName,
        amount: params.amount,
        branch: params.branch,
        area: params.area,
        state: params.state,
        forRole: 'admin'
    });

    return logActivity({
        activityType: 'withdrawal_requested',
        actorId: params.affiliateId,
        actorName: params.affiliateName,
        actorRole: 'branch',
        actorBranch: params.branch,
        actorArea: params.area,
        actorState: params.state,
        targetId: params.withdrawalId,
        targetName: params.affiliateName,
        targetType: 'withdrawal',
        amount: params.amount,
        description,
        metadata: {
            withdrawalId: params.withdrawalId
        }
    });
}
