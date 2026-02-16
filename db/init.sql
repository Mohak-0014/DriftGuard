-- Initialize/update database schema for portfolio rebalancing system
-- This script is run on container startup

-- Create tables if they don't exist (handled by SQLAlchemy)
-- Add currency column to holdings table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'holdings' AND column_name = 'currency'
    ) THEN
        ALTER TABLE holdings ADD COLUMN currency VARCHAR(10) DEFAULT 'USD';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'portfolios' AND column_name = 'currency'
    ) THEN
        ALTER TABLE portfolios ADD COLUMN currency VARCHAR(10) DEFAULT 'USD';
    END IF;
END $$;
