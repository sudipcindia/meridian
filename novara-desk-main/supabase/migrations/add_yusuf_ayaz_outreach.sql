-- Add Yusuf Ayaz as Outreach Specialist (additive, idempotent)
INSERT INTO team_members (id, name, initials, color, role, email, department)
SELECT gen_random_uuid(), 'Yusuf Ayaz', 'YA', '#14b8a6', 'Outreach Specialist', 'yayaz@novaraconsult.co.uk', 'Outreach'
WHERE NOT EXISTS (
  SELECT 1 FROM team_members WHERE email = 'yayaz@novaraconsult.co.uk'
);
