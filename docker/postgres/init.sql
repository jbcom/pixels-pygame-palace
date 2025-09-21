-- PostgreSQL initialization script for Pixel's PyGame Palace
-- This script sets up the initial database schema and configurations

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create application user with limited privileges (if not using default postgres user)
-- DO $$ 
-- BEGIN
--     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pixel_app') THEN
--         CREATE ROLE pixel_app WITH LOGIN PASSWORD 'changeme';
--     END IF;
-- END
-- $$;

-- Create database schema
-- Note: In production, you might want to use a proper migration system

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lessons table  
CREATE TABLE IF NOT EXISTS lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_num INTEGER NOT NULL,
    content JSONB NOT NULL,
    prerequisites JSONB DEFAULT '[]',
    difficulty VARCHAR(50),
    estimated_time INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user progress table
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    current_step INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    template VARCHAR(100) NOT NULL,
    description TEXT,
    published BOOLEAN DEFAULT FALSE,
    files JSONB DEFAULT '[]',
    assets JSONB DEFAULT '[]',
    thumbnail_data_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(order_num);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_lesson_id ON user_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_published ON projects(published);

-- Grant permissions (adjust based on your user strategy)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pixel_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pixel_app;

-- Insert sample data for development/testing
INSERT INTO users (id, username) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'demo_user')
ON CONFLICT (username) DO NOTHING;

-- Log initialization completion
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully';
END
$$;