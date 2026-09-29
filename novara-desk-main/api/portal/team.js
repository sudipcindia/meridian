// GET /api/portal/team  -> the client's assigned team directory
const L = require('./_lib');

const OPEN = new Set(['new', 'inprogress', 'review', 'approved']);

module.exports = L.withClient(async function (req, res, session) {
  const enc = encodeURIComponent(session.cid);

  const [tickets, plans, team] = await Promise.all([
    L.sbSelect('tickets', 'select=status,assignees,owner&client=eq.' + enc + '&is_deleted=not.is.true'),
    L.sbSelect('performance_plans', 'select=plan&client_id=eq.' + enc),
    L.sbSelect('team_members', 'select=id,name,initials,color,role,department,profile_photo_url,bio'),
  ]);

  const teamById = {};
  (team || []).forEach(m => { teamById[m.id] = m; });

  // Collect member ids assigned to this client + how many open tickets each holds.
  const ids = new Set();
  const openLoad = {};
  (tickets || []).forEach(t => {
    const people = [...(t.assignees || []), t.owner].filter(Boolean);
    people.forEach(id => {
      ids.add(id);
      if (OPEN.has(t.status)) openLoad[id] = (openLoad[id] || 0) + 1;
    });
  });
  (plans || []).forEach(p => {
    const weeks = (p.plan && Array.isArray(p.plan.weeks)) ? p.plan.weeks : [];
    weeks.forEach(w => (w.tasks || []).forEach(tk => (tk.assignees || []).forEach(id => ids.add(id))));
  });

  const members = Array.from(ids).map(id => teamById[id]).filter(Boolean).map(m => {
    const load = openLoad[m.id] || 0;
    const availability = load === 0 ? 'available' : load <= 4 ? 'active' : 'busy';
    return {
      id: m.id,
      name: m.name,
      initials: m.initials,
      color: m.color,
      role: m.department || m.role || 'Team',
      photo: m.profile_photo_url || null,
      bio: m.bio || '',
      availability,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return L.send(res, 200, { team: members });
});
