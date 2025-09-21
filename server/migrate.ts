import { db, migrationClient } from './db';
import { sql } from 'drizzle-orm';
import * as schema from '../shared/db-schema';

async function createTables() {
  console.log('🚀 Starting database migration...');
  
  try {
    // Enable UUID extension for PostgreSQL
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    console.log('✅ UUID extension enabled');
    
    // Create Users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Users table created');
    
    // Create Sessions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)`);
    console.log('✅ Sessions table created');
    
    // Create GameProjects table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS game_projects (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        game_type TEXT NOT NULL,
        components JSON NOT NULL DEFAULT '{}',
        description TEXT,
        published BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        published_at TIMESTAMP,
        thumbnail_data_url TEXT,
        files JSON NOT NULL DEFAULT '[]',
        assets JSON NOT NULL DEFAULT '[]'
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS game_projects_user_id_idx ON game_projects(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS game_projects_published_idx ON game_projects(published)`);
    console.log('✅ GameProjects table created');
    
    // Create Lessons table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        "order" INTEGER NOT NULL,
        intro TEXT,
        learning_objectives JSON DEFAULT '[]',
        goal_description TEXT,
        preview_code TEXT,
        content JSON NOT NULL,
        prerequisites JSON DEFAULT '[]',
        difficulty TEXT,
        estimated_time INTEGER
      )
    `);
    console.log('✅ Lessons table created');
    
    // Create UserProgress table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_progress (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        current_step INTEGER NOT NULL DEFAULT 0,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        code TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS user_progress_user_lesson_idx ON user_progress(user_id, lesson_id)`);
    console.log('✅ UserProgress table created');
    
    // Create a default test user
    const testUserExists = await db.select()
      .from(schema.users)
      .where(sql`username = 'test-user'`)
      .limit(1);
    
    if (testUserExists.length === 0) {
      await db.insert(schema.users)
        .values({
          username: 'test-user',
          email: 'test@example.com',
          passwordHash: 'test-password-hash',
        });
      console.log('✅ Test user created');
    } else {
      console.log('✅ Test user already exists');
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
createTables()
  .then(() => {
    console.log('✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });