import { Pool } from 'pg';

// Create a global variable to hold the pool instance
// This ensures we reuse the same pool across hot reloads in development
declare global {
    var pgPool: Pool | undefined;
}

// Initialize the pool only once
const pool = global.pgPool || new Pool({
    connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
    ssl: (process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL)?.includes('rds.amazonaws.com')
        ? { rejectUnauthorized: false }
        : false,
    max: 20, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection can't be established
});

// In development, store the pool globally to prevent creating multiple pools during hot reload
if (process.env.NODE_ENV !== 'production') {
    global.pgPool = pool;
}

// Export the pool as default
export default pool;
