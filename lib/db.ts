import { Pool } from 'pg';

// Helper to clean connection string (remove sslmode param that conflicts with pg config)
const getConnectionString = () => {
    let connStr = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL;
    if (connStr) {
        return connStr.replace(/\?sslmode=.*$/, '');
    }
    return connStr;
};

const config = {
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
};

let pool: Pool;

if (process.env.NODE_ENV === 'production') {
    pool = new Pool(config);
} else {
    // In development, use a global variable to preserve pool across HMR
    if (!(global as any).postgresPool) {
        (global as any).postgresPool = new Pool(config);
    }
    pool = (global as any).postgresPool;
}

export default pool;
