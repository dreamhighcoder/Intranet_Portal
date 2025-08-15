-- Add password support for position-based authentication
-- This allows positions to have passwords for direct login

-- Add password_hash field to positions table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'positions' 
        AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE positions 
        ADD COLUMN password_hash TEXT;
        
        COMMENT ON COLUMN positions.password_hash IS 'Hashed password for position-based authentication';
    END IF;
END $$;

-- Update existing positions with default password hashes if needed
-- This is for development/testing purposes - in production, passwords should be set explicitly
UPDATE positions 
SET password_hash = encode(digest('password123', 'sha256'), 'base64')
WHERE password_hash IS NULL;

-- Create index for password queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_positions_password_hash ON positions(password_hash);

COMMENT ON INDEX idx_positions_password_hash IS 'Index for position password lookups during authentication';