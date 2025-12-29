-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bakeries Table
CREATE TABLE IF NOT EXISTS bakeries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    specialties TEXT, -- Comma separated or JSON, simple text for now
    city VARCHAR(255) NOT NULL,
    average_price DECIMAL(10, 2),
    rating DECIMAL(3, 2),
    opening_hours VARCHAR(255),
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'closed'
    image_url TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL, -- The user who added the bakery
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Favorites Table
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    bakery_id UUID REFERENCES bakeries(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, bakery_id)
);

-- Ratings Table
CREATE TABLE IF NOT EXISTS ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    bakery_id UUID REFERENCES bakeries(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, bakery_id)
);

-- Scraped Leads Table (for n8n workflow)
CREATE TABLE IF NOT EXISTS scraped_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    email VARCHAR(255),
    address TEXT,
    instagram VARCHAR(255),
    website TEXT,
    rating DECIMAL(3, 2),
    category VARCHAR(255),
    phone VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
