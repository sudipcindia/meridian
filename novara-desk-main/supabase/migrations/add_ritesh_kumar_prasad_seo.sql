-- Add Ritesh Kumar Prasad as SEO Specialist
INSERT INTO team_members (id, name, initials, color, role, email, department)
SELECT gen_random_uuid(), 'Ritesh Kumar Prasad', 'RK', '#f59e0b', 'SEO Specialist', 'rkprasad@novaraconsult.co.uk', 'SEO'
WHERE NOT EXISTS (
  SELECT 1 FROM team_members WHERE email = 'rkprasad@novaraconsult.co.uk'
);
