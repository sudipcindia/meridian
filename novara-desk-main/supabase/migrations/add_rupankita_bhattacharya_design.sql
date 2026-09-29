-- Add Rupankita Bhattacharya as Graphics Designer (Design)
INSERT INTO team_members (id, name, initials, color, role, email, department)
SELECT gen_random_uuid(), 'Rupankita Bhattacharya', 'RB', '#f472b6', 'Graphics Designer', 'rbhattacharya@novaraconsult.co.uk', 'Design'
WHERE NOT EXISTS (
  SELECT 1 FROM team_members WHERE email = 'rbhattacharya@novaraconsult.co.uk'
);
