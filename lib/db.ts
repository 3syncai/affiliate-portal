import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL is missing. Please check your .env or Vercel environment variables.');
}

// Handle SSL mode in connection string if present (common in some providers)
const cleanConnectionString = connectionString.replace('?sslmode=no-verify', '');

// Global pool to prevent exhausting connections in development (HMR)
let pool: Pool;

if (process.env.NODE_ENV === 'production') {
    pool = new Pool({
        connectionString: cleanConnectionString,
        ssl: { rejectUnauthorized: false }, // Explicitly set for AWS RDS
        connectionTimeoutMillis: 5000, // Fail fast
    });
} else {
    // In development, use a global variable to preserve the pool across module reloads
    if (!(global as any).postgresPool) {
        (global as any).postgresPool = new Pool({
            connectionString: cleanConnectionString,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000,
        });
    }
    pool = (global as any).postgresPool;
}

export default pool;
