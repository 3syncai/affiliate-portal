/* eslint-disable @typescript-eslint/no-require-imports */  
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function restoreAdmin() {
    try {
        console.log("Creating affiliate_admin table...");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS affiliate_admin (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("Table created!");

        // Create admin user vishal@oweg.in
        const email = "vishal@oweg.in";
        const password = "admin"; // Temporary password
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log(`Creating admin user: ${email}`);

        await pool.query(`
            INSERT INTO affiliate_admin (name, email, password_hash)
            VALUES ($1, $2, $3)
            ON CONFLICT (email) DO UPDATE 
            SET password_hash = $3
            RETURNING id, email;
        `, ["Vishal Admin", email, hashedPassword]);

        console.log("Admin user created/updated successfully!");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}

restoreAdmin();
