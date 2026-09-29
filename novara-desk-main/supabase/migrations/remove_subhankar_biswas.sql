-- Remove Subhankar Biswas from team_members
DELETE FROM team_members WHERE email = 'sbiswas@novaraconsult.co.uk';

-- Fallback: also match by name in case email differs
DELETE FROM team_members WHERE name = 'Subhankar Biswas';
