-- Update existing positions with password hashes
-- This script adds password_hash field if not exists and sets proper passwords

-- Add password_hash field to positions table if it doesn't exist
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
        
        -- Create index for password queries
        CREATE INDEX IF NOT EXISTS idx_positions_password_hash ON positions(password_hash);
    END IF;
END $$;

-- Update positions with proper password hashes to match the hardcoded values
-- Using base64 encoding like the API expects

-- Administrator: admin123
UPDATE positions 
SET password_hash = encode('admin123'::bytea, 'base64')
WHERE name = 'Administrator' OR LOWER(name) LIKE '%admin%';

-- Pharmacist (Primary): pharmprim123  
UPDATE positions 
SET password_hash = encode('pharmprim123'::bytea, 'base64')
WHERE name = 'Pharmacist (Primary)';

-- Pharmacist (Supporting): pharmsup123
UPDATE positions 
SET password_hash = encode('pharmsup123'::bytea, 'base64')
WHERE name = 'Pharmacist (Supporting)';

-- Pharmacy Assistants: assistant123
UPDATE positions 
SET password_hash = encode('assistant123'::bytea, 'base64')
WHERE name = 'Pharmacy Assistants';

-- Dispensary Technicians: tech123  
UPDATE positions 
SET password_hash = encode('tech123'::bytea, 'base64')
WHERE name = 'Dispensary Technicians';

-- DAA Packers: packer123
UPDATE positions 
SET password_hash = encode('packer123'::bytea, 'base64') 
WHERE name = 'DAA Packers';

-- Operational/Managerial: ops123
UPDATE positions 
SET password_hash = encode('ops123'::bytea, 'base64')
WHERE name = 'Operational/Managerial';

-- Add administrator position if it doesn't exist
INSERT INTO positions (id, name, description, password_hash)
SELECT 
    'administrator'::uuid,
    'Administrator',
    'System administrator with full access',
    encode('admin123'::bytea, 'base64')
WHERE NOT EXISTS (
    SELECT 1 FROM positions 
    WHERE name = 'Administrator' OR LOWER(name) LIKE '%admin%'
);

-- Verify the update
SELECT name, 
       CASE 
         WHEN password_hash IS NOT NULL THEN 'Password Set'
         ELSE 'No Password'
       END as password_status
FROM positions
ORDER BY name;