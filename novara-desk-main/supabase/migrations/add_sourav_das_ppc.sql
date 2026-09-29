-- Add Sourav Das as PPC Specialist
INSERT INTO team_members (name, initials, color, role, email, department)
SELECT 'Sourav Das', 'SD', '#e11d48', 'PPC Specialist', 'sdas@novaraconsult.co.uk', 'PPC'
WHERE NOT EXISTS (
  SELECT 1 FROM team_members WHERE email = 'sdas@novaraconsult.co.uk'
);

