import { Pool, types } from 'pg';

// Force `timestamp without time zone` (OID 1114) to be parsed as UTC.
// node-postgres' default parser treats the bare timestamp string as the Node
// process's local time, which on dev machines running in IST shifts every
// timestamp by 5h30 before it ever reaches the client. Treating bare
// timestamps as UTC matches how the rest of the app stores them (NOW() at
// UTC) and keeps `formatIST` correct on the frontend.
types.setTypeParser(1114, (value: string) => {
    if (!value) return value as unknown as Date;
    return new Date(`${value.replace(' ', 'T')}Z`);
});

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
