-- Add department column to team_members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT '';

-- Seed departments for existing members by name
UPDATE team_members SET department = 'UI/UX'       WHERE name IN ('Harshita Das', 'Sourav Mondal');
UPDATE team_members SET department = 'Developer'   WHERE name IN ('Vishal Vishwakarma', 'Sudip Chatterjee');
UPDATE team_members SET department = 'SEO'         WHERE name = 'Moumita Bhowmik';
UPDATE team_members SET department = 'Ecommerce'   WHERE name = 'Sayantani Dey';
UPDATE team_members SET department = 'Operations'  WHERE name = 'Sahil Jaswani';
UPDATE team_members SET department = 'Outreach'    WHERE name = 'Adarsh Mishra';
UPDATE team_members SET department = 'Admin'       WHERE id = 'jk' OR name = 'Jayson Kandiah';
