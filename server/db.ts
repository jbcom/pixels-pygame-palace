import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/db-schema';

// Get database connection from environment variables
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create postgres connection
const queryClient = postgres(connectionString);

// Create drizzle database instance
export const db = drizzle(queryClient, { schema });

// Export the postgres client for migrations
export const migrationClient = queryClient;