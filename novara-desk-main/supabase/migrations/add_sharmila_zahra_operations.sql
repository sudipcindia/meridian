-- Add Sharmila Zahra as Operations member
INSERT INTO team_members (id, name, initials, color, role, email, department)
SELECT gen_random_uuid(), 'Sharmila Zahra', 'SZ', '#06b6d4', 'Operations', 'szahra@novaraconsult.co.uk', 'Operations'
WHERE NOT EXISTS (
  SELECT 1 FROM team_members WHERE email = 'szahra@novaraconsult.co.uk'
);
