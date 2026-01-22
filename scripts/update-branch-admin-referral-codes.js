const { Pool } = require('pg');

// Generate referral code: owegBR + 5 random alphanumeric characters
function generateReferCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 5; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `owegBR${randomPart}`;
}

async function updateBranchAdminReferralCodes() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: false
    });

    try {
        console.log('🔄 Starting migration: Adding referral codes to existing Branch Admins...\n');

        // Get all branch admins without referral codes
        const result = await pool.query(
            'SELECT id, first_name, last_name, email FROM branch_admin WHERE refer_code IS NULL'
        );

        const branchAdmins = result.rows;
        console.log(`📊 Found ${branchAdmins.length} Branch Admins without referral codes\n`);

        if (branchAdmins.length === 0) {
            console.log('✅ All Branch Admins already have referral codes!');
            await pool.end();
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        // Update each branch admin with a unique referral code
        for (const admin of branchAdmins) {
            let referCode = generateReferCode();
            let isUnique = false;
            let attempts = 0;
            const maxAttempts = 10;

            // Ensure uniqueness
            while (!isUnique && attempts < maxAttempts) {
                const checkResult = await pool.query(
                    'SELECT id FROM branch_admin WHERE refer_code = $1',
                    [referCode]
                );

                if (checkResult.rows.length === 0) {
                    isUnique = true;
                } else {
                    referCode = generateReferCode();
                    attempts++;
                }
            }

            if (!isUnique) {
                console.log(`❌ Failed to generate unique code for ${admin.email} after ${maxAttempts} attempts`);
                errorCount++;
                continue;
            }

            // Update the branch admin with the referral code
            try {
                await pool.query(
                    'UPDATE branch_admin SET refer_code = $1, updated_at = NOW() WHERE id = $2',
                    [referCode, admin.id]
                );

                console.log(`✅ Updated ${admin.first_name} ${admin.last_name} (${admin.email}): ${referCode}`);
                successCount++;
            } catch (error) {
                console.log(`❌ Error updating ${admin.email}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n📈 Migration Summary:');
        console.log(`   ✅ Successfully updated: ${successCount}`);
        console.log(`   ❌ Failed: ${errorCount}`);
        console.log(`   📊 Total: ${branchAdmins.length}`);

        await pool.end();
        console.log('\n🎉 Migration completed!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        await pool.end();
        process.exit(1);
    }
}

// Run the migration
updateBranchAdminReferralCodes();
