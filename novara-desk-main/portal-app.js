/* =============================================================================
 * Novara Client Portal — frontend app logic
 * No Supabase key here. All data via /api/portal/*. Session token in localStorage.
 * ========================================================================== */
(function () {
  'use strict';

  var TOKEN_KEY = 'np_token';
  var state = { token: null, role: 'client', clientName: '', view: 'overview', me: null, ticketId: null, pollTimer: null, notifTimer: null, reports: null, currentThread: [], editingId: null, editRec: null, _pendingTicketId: null };

  // ---- tiny DOM helpers ----
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function show(el) { el.classList.add('show'); }
  function hide(el) { el.classList.remove('show'); }

  // Small inline stroke-icon set (Phase 9 redesign) — same visual language
  // as the sidebar nav icons (24x24, stroke=currentColor, stroke-width 2),
  // used everywhere an emoji glyph previously stood in for the dashboard's
  // icon system (KPI icons, empty states, inline markers).
  var ICON_PATHS = {
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4.4l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    ticket: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.3A8 8 0 1 1 21 12Z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8.3 12.5 2.6 2.6 5-5.2"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    refresh: '<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M8.2 13.6 7 22l5-3 5 3-1.2-8.4"/>',
    xcircle: '<circle cx="12" cy="12" r="9"/><path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"/>',
    chart: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
    trend: '<path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    play: '<path d="M6 4.5v15l13-7.5-13-7.5Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 19v3"/><path d="M8 22h8"/>',
    video: '<rect x="2" y="5" width="14" height="14" rx="2.5"/><path d="m16 10 5.5-3.5v11L16 14"/>',
    notepad: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  };
  function ICON(name, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICON_PATHS[name] || '') + '</svg>';
  }

  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    $('toasts').appendChild(t); setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 250); }, 3200);
  }

  // decode (not verify) token payload to read role/exp client-side
  function decodeToken(tok) {
    try { var p = tok.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(atob(p)); } catch (e) { return null; }
  }

  // ---- API ----
  function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    return fetch('/api/portal/' + path, {
      method: opts.method || 'GET', headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data; try { data = txt ? JSON.parse(txt) : {}; } catch (e) { data = {}; }
        if (r.status === 401 && state.token) { logout(); throw new Error('Session expired'); }
        if (!r.ok) { var e = new Error(data.error || ('Error ' + r.status)); e.data = data; e.status = r.status; throw e; }
        return data;
      });
    });
  }

  // ============================ AUTH ============================
  function showLogin() {
    hide($('shell')); $('auth').style.display = 'flex';
    $('login-view').style.display = 'block'; $('setup-view').style.display = 'none';
  }
  function showSetup(opts) {
    hide($('shell')); $('auth').style.display = 'flex';
    $('login-view').style.display = 'none'; $('setup-view').style.display = 'block';
    if (opts && opts.change) {
      $('setup-h').textContent = 'Change your password';
      $('setup-sub').textContent = 'Enter your current password and a new one.';
      $('cur-field').style.display = 'block';
    } else {
      $('setup-h').textContent = 'Set your password';
      $('setup-sub').textContent = 'Choose a password to access your portal.';
      $('cur-field').style.display = 'none';
    }
  }

  window.doLogin = function () {
    var err = $('login-err'); err.classList.remove('show');
    var email = $('li-email').value.trim(), pass = $('li-pass').value;
    if (!email || !pass) { err.textContent = 'Enter your email and password.'; err.classList.add('show'); return; }
    var btn = $('li-btn'); btn.disabled = true; btn.textContent = 'Signing in…';
    api('login', { method: 'POST', body: { email: email, password: pass } }).then(function (d) {
      state.token = d.token; localStorage.setItem(TOKEN_KEY, d.token);
      if (d.must_change_password) { showSetup({ change: true }); }
      else { boot(); }
    }).catch(function (e) {
      err.textContent = e.message; err.classList.add('show');
    }).finally(function () { btn.disabled = false; btn.textContent = 'Sign in'; });
  };

  window.doSetPassword = function () {
    var err = $('setup-err'); err.classList.remove('show');
    var nw = $('sp-new').value, cf = $('sp-confirm').value;
    if (nw.length < 8) { err.textContent = 'Password must be at least 8 characters.'; err.classList.add('show'); return; }
    if (nw !== cf) { err.textContent = 'Passwords do not match.'; err.classList.add('show'); return; }
    var body, useAuth = !!state.token && !state._setupFlow;
    if (state._setupFlow) body = { email: state._setupFlow.email, setup_token: state._setupFlow.token, new_password: nw };
    else body = { current_password: $('sp-cur').value, new_password: nw };
    var btn = $('sp-btn'); btn.disabled = true; btn.textContent = 'Saving…';
    api('set-password', { method: 'POST', body: body }).then(function () {
      toast('Password saved.');
      if (state._setupFlow) {
        // after setup, send them to login
        state._setupFlow = null; location.hash = '';
        $('li-email').value = body.email || ''; showLogin();
      } else { boot(); }
    }).catch(function (e) { err.textContent = e.message; err.classList.add('show'); })
      .finally(function () { btn.disabled = false; btn.textContent = 'Save password'; });
  };

  window.logout = function () {
    localStorage.removeItem(TOKEN_KEY); state.token = null; state.me = null;
    if (state.pollTimer) clearInterval(state.pollTimer);
    if (state.notifTimer) clearInterval(state.notifTimer);
    showLogin();
  };

  // ============================ SHELL ============================
  function initials(name) { return (name || 'C').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase(); }

  function boot() {
    $('auth').style.display = 'none'; show($('shell'));
    var payload = decodeToken(state.token) || {};
    state.role = payload.role || 'client';
    if (state.role === 'preview') {
      var b = $('preview-banner'); b.style.display = 'flex';
      b.innerHTML = ICON('eye', 15) + 'Developer Preview — viewing as ' + esc(state.clientName || 'client') + ' (read-only)';
    }
    api('me').then(function (d) {
      state.me = d; state.clientName = d.client.name;
      $('me-name').textContent = d.client.name;
      $('me-av').textContent = initials(d.client.name);
      if (state.role === 'preview') $('preview-banner').innerHTML = ICON('eye', 15) + 'Developer Preview — viewing as ' + esc(d.client.name) + ' (read-only)';
      // A ticket-notification email deep-link (#ticket=<id>, captured in
      // start()) is honoured here, once — whether the session was already
      // valid or the client just logged in to get here. openTicket() still
      // goes through the normal /api/portal/tickets?id=... call, so a ticket
      // that doesn't belong to this client 404s exactly as it would from any
      // other route in — the deep-link carries no extra authority.
      // Deliberately NOT calling nav('tickets') here: it kicks off its own
      // async ticket-list fetch into the same #view element, which can
      // resolve after openTicket()'s own fetch and silently clobber the
      // ticket detail (or its error state) with the list. Set the same
      // chrome nav('tickets') would (highlighted nav item, page title) and
      // let openTicket() own #view exclusively from here.
      if (state._pendingTicketId) {
        var pid = state._pendingTicketId; state._pendingTicketId = null;
        state.view = 'tickets';
        document.querySelectorAll('.nav-item,[data-view]').forEach(function (el) {
          el.classList.toggle('active', el.getAttribute('data-view') === 'tickets');
        });
        $('pg-title').textContent = 'Tickets';
        setPageHead('Tickets', VIEW_SUBTITLE.tickets);
        openTicket(pid);
      } else {
        nav(state.view);
      }
      startNotifPolling();
    }).catch(function (e) { toast(e.message); if (e.status === 401) logout(); });
  }

  var VIEW_SUBTITLE = {
    overview: 'Client performance and project progress',
    services: 'What we\'re doing for you, by service',
    tickets: 'Conversations with your team', reports: 'Published performance reports',
    performance: 'Performance, campaigns and analytics',
    team: 'Your assigned account team', meetings: 'Request a call with your team',
  };
  function setPageHead(title, sub) {
    var ph = $('page-head');
    ph.style.display = title ? '' : 'none';
    ph.innerHTML = title ? '<h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') : '';
  }
  window.nav = function (view) {
    state.view = view; state.ticketId = null;
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
    document.querySelectorAll('.nav-item,[data-view]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-view') === view);
    });
    closeNotif();
    var titles = { overview: 'Overview', services: 'Services', tickets: 'Tickets', reports: 'Reports', performance: 'Performance & Analytics', team: 'Your Team', meetings: 'Request a Meeting' };
    $('pg-title').textContent = titles[view] || '';
    setPageHead(titles[view] || '', VIEW_SUBTITLE[view] || '');
    var v = $('view'); v.innerHTML = '<div class="skel">Loading…</div>';
    if (view === 'overview') renderOverview(v);
    else if (view === 'services') renderServices(v);
    else if (view === 'tickets') renderTickets(v);
    else if (view === 'reports') renderReports(v);
    else if (view === 'performance') renderPerformance(v);
    else if (view === 'team') renderTeam(v);
    else if (view === 'meetings') renderMeetings(v);
  };

  // ============================ OVERVIEW ============================
  function ringSVG(pct, color, size, sw) {
    size = size || 128; sw = sw || 10; var r = (size - sw) / 2, c = 2 * Math.PI * r;
    var off = c * (1 - pct / 100);
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#EEF1F6" stroke-width="' + sw + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + sw + '" ' +
      'stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" ' +
      'transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')" style="transition:stroke-dashoffset .6s ease"/></svg>';
  }
  var HEALTH = {
    excellent: { c: '#16A34A', bg: 'var(--success-bg)', label: 'Excellent' },
    healthy: { c: '#16A34A', bg: 'var(--success-bg)', label: 'Healthy' },
    attention: { c: '#B45309', bg: 'var(--warn-bg)', label: 'Needs attention' },
    'at-risk': { c: '#DC2626', bg: 'var(--danger-bg)', label: 'At risk' },
  };
  // KPI icon treatment — categorical tokens, matching the internal Dashboard's
  // own icon-color language (never reusing the reserved status colors here).
  var KPI_META = {
    activeProjects: { ico: 'folder', fg: 'var(--cat-blue)', bg: 'var(--cat-blue-bg)' },
    openTickets: { ico: 'ticket', fg: 'var(--cat-aqua)', bg: 'var(--cat-aqua-bg)' },
    completedThisMonth: { ico: 'check', fg: 'var(--success)', bg: 'var(--success-bg)' },
    atRisk: { ico: 'alert', fg: 'var(--danger)', bg: 'var(--danger-bg)' },
    pendingApprovals: { ico: 'eye', fg: 'var(--cat-amber)', bg: 'var(--cat-amber-bg)' },
  };
  var KPI_LABELS = { activeProjects: 'Active Services', openTickets: 'Open Tickets', completedThisMonth: 'Completed This Month', atRisk: 'At-Risk Items', pendingApprovals: 'Pending Review' };

  function renderOverview(v) {
    var d = state.me;
    if (!d) { v.innerHTML = '<div class="skel">Loading…</div>'; return; }
    var have = state.reports;
    (have ? Promise.resolve({ reports: have }) : api('reports').catch(function () { return { reports: [] }; }))
      .then(function (res) {
        if (state.view !== 'overview') return;
        state.reports = res.reports || [];
        v.innerHTML = overviewHTML(d, state.reports);
      });
  }

  // Service-specific dashboard (Master Client Directory requirement): the
  // Overview is a short, dynamic summary — health, KPIs, completed work, a
  // teaser of this client's own tagged services (client.services, computed
  // in api/portal/me.js), and a performance teaser. No Promises anywhere
  // (removed entirely — api/portal/promises.js no longer exists), and no
  // GTM/service data is shown unless this client is actually tagged with
  // it (see the Services and Performance pages for the full breakdown).
  function overviewHTML(d, reports) {
    var h = d.health, hc = HEALTH[h.level] || HEALTH.attention;
    var k = d.kpis;
    var html = '';

    // 1. Overall progress / health — compact, analytical summary card
    // (left: score ring, middle: name + status, right: the same real
    // health.reasons the old card showed, just re-composed).
    html += '<div class="card health-card">' +
      '<div class="hc-ring">' + ringSVG(h.score, hc.c, 76, 7) + '<div class="hc-score"><b>' + h.score + '</b><span>/ 100</span></div></div>' +
      '<div><div class="hc-eyebrow">Account health</div><div class="hc-name">' + esc(d.client.name) + '</div>' +
      '<span class="health-chip" style="background:' + hc.bg + ';color:' + hc.c + '">' + hc.label + '</span></div>' +
      '<div class="hc-right">' + h.reasons.slice(0, 3).map(function (r) { return '<div class="hc-reason">' + esc(r) + '</div>'; }).join('') + '</div>' +
      '</div>';

    var kpis = ['activeProjects', 'openTickets', 'completedThisMonth', 'atRisk', 'pendingApprovals'];
    html += '<div class="grid kpis" style="margin-top:18px">' + kpis.map(function (key) {
      var m = KPI_META[key];
      return '<div class="card kpi"><div class="kpi-ico" style="background:' + m.bg + ';color:' + m.fg + '">' + ICON(m.ico, 18) + '</div>' +
        '<div class="v">' + k[key] + '</div><div class="l">' + KPI_LABELS[key] + '</div></div>';
    }).join('') + '</div>';

    // 1.5. Active Tickets — the client's current open work (Phase 2, reuses
    // the same api/portal/me.js payload that already computes openTickets
    // for the KPI above; no second ticket query). Nearest due date first,
    // capped at 10 — never a fabricated future occurrence, just whatever
    // real ticket rows already exist.
    html += activeTicketsSection(d);

    // 2. Completed work — real delivered tickets (api/portal/me.js
    // completedWork), not internal promise-tracking data. Phase 5, 2026-09:
    // each real ticket's own status/service/recurring info now shows
    // alongside its ticket # — never a fabricated "Done" for a ticket
    // that's actually 'delivered', and never a recurring badge unless that
    // ticket really is one.
    var completed = (d.completedWork || []).slice(0, 6);
    html += '<div class="sec-h"><div><div class="t">Completed Work</div><div class="sub">Recently delivered work</div></div></div>';
    if (!completed.length) html += emptyState('check', 'Nothing delivered yet', 'Completed work will appear here as it’s finished.');
    else html += '<div class="card">' + completed.map(function (p) {
      var metaBits = [p.service, p.delivered_at ? 'Completed ' + fmtDate(p.delivered_at) : null];
      if (p.recurringLabel) metaBits.push('Recurring: ' + esc(p.recurringLabel));
      return '<div class="tk-row" onclick="openTicket(\'' + esc(p.id) + '\')">' +
        '<div class="tk-main">' +
        '<div class="tk-idrow"><span class="tk-id">' + esc(p.id) + '</span>' +
        (p.isRecurring ? '<span class="recurring-tag" title="Recurring task">' + ICON('refresh', 11) + ' Recurring</span>' : '') + '</div>' +
        '<div class="tk-title">' + esc(p.title) + '</div>' +
        '<div class="tk-prev">' + esc(metaBits.filter(Boolean).join(' · ')) + '</div>' +
        '</div>' + statusBadge(p) + '</div>';
    }).join('') + '</div>';

    // 3. Your Services — a teaser of this client's own tagged services
    // (never another client's, never a service they aren't tagged with).
    // Full depth (per-service ticket list) lives on the Services page.
    html += '<div class="sec-h"><div><div class="t">Your Services</div><div class="sub">What we\'re working on for you</div></div>' +
      (d.projects.length > 4 ? '<a class="link" onclick="nav(\'services\')">View all →</a>' : '') + '</div>';
    if (!d.projects.length) html += emptyState('folder', 'No active services yet', 'Your services will appear here once your plan is live.');
    else html += '<div class="grid projects">' + d.projects.slice(0, 4).map(projCard).join('') + '</div>';

    // 4. Performance teaser (from the most recent client-facing report, if
    // any). Full analytics — including GTM, when tagged — live on Performance.
    html += '<div class="sec-h"><div><div class="t">Performance</div><div class="sub">From your latest report</div></div>' +
      '<a class="link" onclick="nav(\'performance\')">View performance →</a></div>';
    html += reports.length ? performancePreview(reports[0]) : emptyState('chart', 'No analytics yet', 'Performance data will appear here once your first report is ready.');

    return html;
  }

  // Reuses the exact same .tk-row/.tk-idrow/.tk-id/.tk-title/.tk-prev/
  // statusBadge markup and CSS the Tickets page already uses (ticketRowHTML)
  // — the Active Tickets card is visually just that same row style, with a
  // due-date + recurring subtitle instead of a last-message preview. No new
  // CSS, so it reads as a natural part of the existing portal.
  function activeTicketRowHTML(t) {
    var metaBits = ['Due: ' + fmtDueSmart(t.due)];
    if (t.recurringLabel) metaBits.push('Recurring: ' + esc(t.recurringLabel));
    return '<div class="tk-row" onclick="openTicket(\'' + esc(t.id) + '\')">' +
      '<div class="tk-main">' +
      '<div class="tk-idrow"><span class="tk-id">' + esc(t.id) + '</span></div>' +
      '<div class="tk-title">' + esc(t.title) + '</div>' +
      '<div class="tk-prev">' + metaBits.join(' · ') + '</div>' +
      '</div>' +
      statusBadge(t) + '</div>';
  }

  // "View All Tickets" always links to the existing Tickets page (nav) —
  // never a second ticket list/page — regardless of how many active
  // tickets there are, so the client always has an obvious way to see
  // everything beyond the top 10 shown here.
  function activeTicketsSection(d) {
    var list = d.activeTickets || [];
    var html = '<div class="sec-h"><div><div class="t">Active Tickets</div><div class="sub">Your current work in progress</div></div>' +
      '<a class="link" onclick="nav(\'tickets\')">View All Tickets →</a></div>';
    if (!list.length) html += emptyState('ticket', 'No active tickets right now', 'New work will appear here as soon as it starts.');
    else html += '<div class="card">' + list.map(activeTicketRowHTML).join('') + '</div>';
    return html;
  }

  var GTM_KPI_META = {
    total: { ico: 'target', fg: 'var(--cat-violet)', bg: 'var(--cat-violet-bg)', label: 'Total Opportunities' },
    active: { ico: 'refresh', fg: 'var(--cat-blue)', bg: 'var(--cat-blue-bg)', label: 'Active' },
    won: { ico: 'award', fg: 'var(--success)', bg: 'var(--success-bg)', label: 'Won' },
    lost: { ico: 'xcircle', fg: 'var(--danger)', bg: 'var(--danger-bg)', label: 'Lost' },
  };
  function gtmKpiRow(kpi) {
    return '<div class="grid kpis" style="margin-bottom:14px">' + ['total', 'active', 'won', 'lost'].map(function (key) {
      var m = GTM_KPI_META[key];
      return '<div class="card kpi"><div class="kpi-ico" style="background:' + m.bg + ';color:' + m.fg + '">' + ICON(m.ico, 18) + '</div>' +
        '<div class="v">' + (kpi[key] || 0) + '</div><div class="l">' + m.label + '</div></div>';
    }).join('') + '</div>';
  }

  // Compact segmented bar — only stages the client actually has at least one
  // opportunity in are shown (not all 11 defined pipeline stages), using the
  // real staff-set colour/label from outreach_stages. Skipped entirely when
  // there are no opportunities (nothing to break down).
  function gtmStageBar(stages) {
    if (!stages.length) return '';
    var bar = stages.map(function (s) {
      return '<div style="width:' + Math.max(s.pct, 2) + '%;background:' + esc(s.color) + '" title="' + esc(s.label) + ' — ' + s.count + '"></div>';
    }).join('');
    var legend = stages.map(function (s) {
      return '<div class="gtm-stage-leg"><span class="dl-dot" style="background:' + esc(s.color) + '"></span>' + esc(s.label) + ' <b>' + s.count + '</b></div>';
    }).join('');
    return '<div class="card" style="padding:16px 18px;margin-bottom:18px">' +
      '<div class="gtm-stage-bar">' + bar + '</div>' +
      '<div class="gtm-stage-legend">' + legend + '</div>' +
      '</div>';
  }

  function gtmGoalsGrid(goals) {
    return '<div class="grid gtm-grid">' + goals.map(function (g) {
      var pct = g.progress_pct != null ? Math.max(0, Math.min(100, g.progress_pct)) : null;
      var valueStr = g.current != null ? g.current : '—';
      if (g.target != null) valueStr += ' / ' + g.target;
      if (g.unit) valueStr += ' ' + esc(g.unit);
      return '<div class="card gtm-card">' +
        '<div class="gtm-title">' + esc(g.title) + '</div>' +
        (g.service ? '<div class="gtm-service">' + esc(g.service) + '</div>' : '') +
        '<div class="gtm-value">' + valueStr + '</div>' +
        (pct != null ? '<div class="gtm-bar-track"><div class="gtm-bar-fill" style="width:' + pct + '%"></div></div>' : '') +
        (g.status || g.by_date ? '<div class="gtm-goal-meta">' + (g.status ? '<span class="gtm-status-chip">' + esc(g.status.replace(/-/g, ' ')) + '</span>' : '') +
          (g.by_date ? ' by ' + fmtDate(g.by_date) : '') + '</div>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  function gtmLeadsList(leads) {
    if (!leads.length) return emptyState('target', 'No recent leads', 'New leads will appear here as they come in.');
    return '<div class="grid gtm-leads-grid">' + leads.map(function (l) {
      return '<div class="card gtm-lead-card">' +
        '<div class="gtm-lead-top"><div class="gtm-lead-name">' + esc(l.name || l.company || 'Lead') + '</div>' +
        (l.status ? '<span class="gtm-stage-badge" style="background:' + esc(l.statusColor || '#94A3B8') + '22;color:' + esc(l.statusColor || '#64748B') + '">' + esc(l.status) + '</span>' : '') + '</div>' +
        (l.company && l.name ? '<div class="gtm-lead-company">' + esc(l.company) + '</div>' : '') +
        (l.source ? '<div class="gtm-lead-meta">' + esc(l.source) + '</div>' : '') +
        (l.date ? '<div class="gtm-lead-date">' + fmtDate(l.date) + ' · ' + relPast(l.date) + '</div>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  // Friendly past-relative date ("3d ago"). fmtDate() is still reused for
  // the absolute date shown alongside.
  function relPast(s) {
    if (!s) return '';
    var days = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return days + 'd ago';
    if (days < 30) return Math.floor(days / 7) + 'w ago';
    if (days < 365) return Math.floor(days / 30) + 'mo ago';
    return Math.floor(days / 365) + 'y ago';
  }

  // ============================ SERVICES (full, per-service depth) ============================
  // Requirement #4: a client with e.g. SEO + GTM + Website sees each
  // service's own section, scoped strictly to that service's own tickets —
  // never mixed with another service's or another client's data. The
  // per-service stats come from api/portal/me.js (d.projects); the ticket
  // list under each service groups this client's own /tickets by
  // ticket.type, reusing the existing tickets list endpoint (no new call).
  function renderServices(v) {
    var d = state.me;
    if (!d) { v.innerHTML = '<div class="skel">Loading…</div>'; return; }
    if (!d.projects.length) { v.innerHTML = emptyState('folder', 'No services yet', 'Services assigned to your account will appear here.'); return; }
    api('tickets').then(function (td) {
      var byType = {};
      (td.tickets || []).forEach(function (t) { var key = t.type || 'other'; (byType[key] = byType[key] || []).push(t); });
      v.innerHTML = d.projects.map(function (p) { return serviceSection(p, byType[p.id] || []); }).join('');
    }).catch(function () {
      v.innerHTML = d.projects.map(function (p) { return serviceSection(p, []); }).join('');
    });
  }

  function serviceSection(p, tickets) {
    var color = p.status === 'complete' ? '#16A34A' : p.progress >= 60 ? '#2563EB' : '#0D9488';
    var statusColor = p.status === 'complete' ? '#16A34A' : p.status === 'planning' ? '#94A3B8' : '#2563EB';
    var avs = (p.team || []).map(function (m) {
      return '<div class="av" style="background:' + (m.color || '#2563EB') + '" title="' + esc(m.name) + '">' +
        (m.photo ? '<img src="' + esc(m.photo) + '" alt="">' : esc(m.initials || initials(m.name))) + '</div>';
    }).join('');
    var rows = tickets.slice(0, 8).map(ticketRowHTML).join('');
    return '<div class="card" style="padding:22px 24px;margin-bottom:18px">' +
      '<div class="proj-top" style="margin-bottom:16px">' +
      '<div class="pring">' + ringSVG(p.progress, color, 52, 6) + '<div class="pv">' + p.progress + '%</div></div>' +
      '<div style="flex:1;display:flex;align-items:center;gap:8px"><span style="color:var(--t2);display:flex">' + ICON(p.icon, 17) + '</span>' +
      '<div><div class="proj-title" style="font-size:16px">' + esc(p.label) + '</div>' +
      '<div class="proj-status" style="color:' + statusColor + '">' + (p.status === 'complete' ? 'Complete' : p.status === 'planning' ? 'Planning' : 'In progress') + '</div></div></div>' +
      (avs ? '<div class="avs">' + avs + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;gap:22px;flex-wrap:wrap;font-size:12.5px;color:var(--t2);margin-bottom:16px">' +
      '<span><b style="color:var(--t1)">' + p.total + '</b> total</span>' +
      '<span><b style="color:var(--t1)">' + p.active + '</b> active</span>' +
      '<span><b style="color:var(--t1)">' + p.done + '</b> done</span>' +
      (p.overdue ? '<span style="color:var(--danger)"><b>' + p.overdue + '</b> overdue</span>' : '') +
      '</div>' +
      (rows ? '<div style="border:1px solid var(--b1);border-radius:var(--radius-sm);overflow:hidden">' + rows + '</div>'
        : '<div style="font-size:12.5px;color:var(--t3);padding:8px 0">No tickets yet for this service.</div>') +
      '</div>';
  }

  // ============================ PERFORMANCE & ANALYTICS ============================
  // Requirement #4/#11: GTM/lead data only ever renders for a client actually
  // tagged with 'gtm' or 'sales' in the Master Client Directory — never
  // shown to (or fetched for) a client without that service.
  function renderPerformance(v) {
    var d = state.me;
    if (!d) { v.innerHTML = '<div class="skel">Loading…</div>'; return; }
    var wantsGtm = (d.services || []).indexOf('gtm') > -1 || (d.services || []).indexOf('sales') > -1;
    var have = state.reports;
    Promise.all([
      have ? Promise.resolve({ reports: have }) : api('reports').catch(function () { return { reports: [] }; }),
      wantsGtm ? api('reports?section=gtm').catch(function () { return null; }) : Promise.resolve(null),
    ]).then(function (res) {
      if (state.view !== 'performance') return;
      state.reports = res[0].reports || [];
      v.innerHTML = performanceHTML(state.reports, res[1]);
    });
  }

  function performanceHTML(reports, gtm) {
    var html = '';
    html += '<div class="sec-h"><div><div class="t">Performance</div><div class="sub">' + (reports.length ? 'Latest published report' : 'No reports yet') + '</div></div>' +
      (reports.length ? '<a class="link" onclick="nav(\'reports\')">All reports →</a>' : '') + '</div>';
    html += reports.length ? performancePreview(reports[0]) : emptyState('chart', 'No analytics yet', 'Performance data will appear here once your first report is ready.');

    if (gtm) {
      html += '<div class="sec-h"><div><div class="t">GTM Performance</div><div class="sub">Campaign activity & lead generation</div></div></div>';
      if (gtm.kpi && gtm.kpi.total > 0) {
        html += gtmKpiRow(gtm.kpi);
        html += gtmStageBar(gtm.stageBreakdown || []);
      }
      html += '<div class="sec-h" style="margin-top:' + (gtm.kpi && gtm.kpi.total > 0 ? '18px' : '4px') + '"><div><div class="t">Campaign Performance</div><div class="sub">Live KPIs from your plan</div></div></div>';
      html += (gtm.goals && gtm.goals.length) ? gtmGoalsGrid(gtm.goals)
        : emptyState('trend', 'No campaign performance data yet', 'GTM metrics will appear here once your plan is tracking them.');
      html += '<div class="sec-h" style="margin-top:4px"><div><div class="t">Recent GTM Leads</div><div class="sub">Latest leads & opportunities</div></div></div>';
      html += gtm.leadsConnected ? gtmLeadsList(gtm.leads || [])
        : emptyState('target', 'Lead data coming soon', gtm.leadsReason || 'GTM lead data will appear here once available.');
    }
    return html;
  }

  function projCard(p) {
    var color = p.status === 'complete' ? '#16A34A' : p.progress >= 60 ? '#2563EB' : '#0D9488';
    var statusColor = p.status === 'complete' ? '#16A34A' : p.status === 'planning' ? '#94A3B8' : '#2563EB';
    var avs = (p.team || []).slice(0, 4).map(function (m) {
      return '<div class="av" style="background:' + (m.color || '#2563EB') + '" title="' + esc(m.name) + '">' +
        (m.photo ? '<img src="' + esc(m.photo) + '" alt="">' : esc(m.initials || initials(m.name))) + '</div>';
    }).join('');
    var extra = p.team.length > 4 ? '<div class="av" style="background:#64748B">+' + (p.team.length - 4) + '</div>' : '';
    return '<div class="card proj"><div class="proj-top">' +
      '<div class="pring">' + ringSVG(p.progress, color, 52, 6) + '<div class="pv">' + p.progress + '%</div></div>' +
      '<div><div class="proj-title">' + esc(p.label) + '</div>' +
      '<div class="proj-status" style="color:' + statusColor + '">' + (p.status === 'complete' ? 'Complete' : p.status === 'planning' ? 'Planning' : 'In progress') + '</div></div></div>' +
      '<div style="font-size:12.5px;color:var(--t2)">' + p.done + ' of ' + p.total + ' tasks done</div>' +
      (avs ? '<div class="avs">' + avs + extra + '</div>' : '') +
      '</div>';
  }

  // Report chart_data uses this fixed categorical order for pie/status
  // slices — same hue family as the internal Dashboard's own --nd2-cat-*
  // tokens, for one consistent colour language across both products.
  var CHART_COLORS = { completed: '#16A34A', in_progress: '#2563EB', overdue: '#DC2626', pending: '#B45309' };
  var CHART_LABELS = { completed: 'Completed', in_progress: 'In Progress', overdue: 'Overdue', pending: 'Pending' };

  // ============================ PERFORMANCE / REPORTS ============================
  function performancePreview(report) {
    var cd = report.chart_data || {};
    var html = '<div class="grid perf-grid">';

    html += '<div class="card perf-card"><div class="ph">Metrics — ' + esc(report.title) + '</div>';
    if (cd.metrics) {
      html += Object.keys(cd.metrics).map(function (k) {
        return '<div class="metric-row"><span class="ml">' + esc(CHART_LABELS[k] || (k.charAt(0).toUpperCase() + k.slice(1))) + '</span><span class="mv">' + cd.metrics[k] + '</span></div>';
      }).join('');
    } else html += '<div style="font-size:12.5px;color:var(--t3)">No metrics on this report.</div>';
    html += '</div>';

    html += '<div class="card perf-card">';
    if (cd.pie && Object.keys(cd.pie).some(function (k) { return cd.pie[k] > 0; })) {
      html += '<div class="ph">Status Breakdown</div>' + donutMini(cd.pie);
    } else if (cd.bar && cd.bar.values && cd.bar.values.length) {
      html += '<div class="ph">Activity — ' + esc((report.period_start ? fmtDate(report.period_start) : '') + (report.period_end ? ' – ' + fmtDate(report.period_end) : '')) + '</div>' +
        miniBars(cd.bar);
    } else html += '<div class="ph">Trend</div><div style="font-size:12.5px;color:var(--t3);padding:16px 0">No chart data on this report yet.</div>';
    html += '</div></div>';
    return html;
  }

  function miniBars(bar) {
    var vals = bar.values || [], labels = bar.labels || [];
    var max = Math.max.apply(null, vals.concat([1]));
    return '<div class="spark-bars">' + vals.map(function (v) {
      var h = Math.max(Math.round((v / max) * 100), 4);
      return '<div class="sb" style="height:' + h + '%" title="' + v + '"></div>';
    }).join('') + '</div>' +
      '<div class="spark-labels">' + labels.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>';
  }

  function donutMini(pie) {
    var keys = Object.keys(pie).filter(function (k) { return pie[k] > 0; });
    var total = keys.reduce(function (s, k) { return s + pie[k]; }, 0) || 1;
    var r = 40, c = 2 * Math.PI * r, off = 0;
    var arcs = keys.map(function (k) {
      var frac = pie[k] / total, len = c * frac;
      var seg = '<circle cx="52" cy="52" r="' + r + '" fill="none" stroke="' + (CHART_COLORS[k] || '#94A3B8') + '" stroke-width="14" ' +
        'stroke-dasharray="' + len.toFixed(1) + ' ' + (c - len).toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '" transform="rotate(-90 52 52)"/>';
      off += len; return seg;
    }).join('');
    var legend = keys.map(function (k) {
      return '<div class="dl-row"><span class="dl-dot" style="background:' + (CHART_COLORS[k] || '#94A3B8') + '"></span>' +
        '<span class="dl-l">' + esc(CHART_LABELS[k] || k) + '</span><span class="dl-v">' + pie[k] + '</span></div>';
    }).join('');
    return '<div class="donut-mini-wrap"><svg width="104" height="104" viewBox="0 0 104 104">' + arcs + '</svg>' +
      '<div class="donut-legend-mini">' + legend + '</div></div>';
  }

  // Client Reports (2026-09-28): kind==='delivery' rows are the new
  // manually-sent PDF/URL reports (client_report_deliveries, merged in by
  // api/portal/reports.js) — same .card.rp-card grid/typography as the
  // existing narrative performance reports, just a "PDF"/"LINK" type chip
  // and a sent-date instead of a period range, so the tab never looks like
  // two different features.
  function reportCardHTML(r, i) {
    var typeLabel = r.kind === 'delivery' ? (r.type === 'link' ? 'Link' : 'PDF') : (r.type || 'report');
    var dateLine = r.kind === 'delivery' ? fmtDate(r.created_at) : (r.period_start ? fmtDate(r.period_start) + ' – ' + fmtDate(r.period_end) : fmtDate(r.created_at));
    return '<div class="card rp-card" onclick="openReport(' + i + ')"><span class="rp-type">' + esc(typeLabel) + '</span>' +
      '<div class="rp-title">' + esc(r.title) + '</div>' +
      '<div class="rp-period">' + dateLine + '</div>' +
      '<div class="rp-summary">' + esc(r.summary || '') + '</div></div>';
  }
  function renderReports(v) {
    var have = state.reports;
    (have ? Promise.resolve({ reports: have }) : api('reports')).then(function (d) {
      state.reports = d.reports || [];
      if (!state.reports.length) { v.innerHTML = emptyState('chart', 'No reports yet', 'Performance reports will appear here once your first one is published.'); return; }
      v.innerHTML = '<div class="grid rp-grid">' + state.reports.map(reportCardHTML).join('') + '</div>';
    }).catch(function (e) { v.innerHTML = errState(e.message); });
  }

  window.openReport = function (i) {
    var r = (state.reports || [])[i]; if (!r) return;
    var v = $('view'); $('pg-title').textContent = 'Report'; setPageHead('');
    var html = '<button class="btn btn-ghost" onclick="nav(\'reports\')" style="margin-bottom:14px">' + ICON('back', 14) + ' All reports</button>';
    html += '<div class="card" style="padding:24px">';
    if (r.kind === 'delivery') {
      var link = r.file_url || r.external_url;
      html += '<span class="rp-type">' + esc(r.type === 'link' ? 'Link' : 'PDF') + '</span>';
      html += '<h2 style="font-size:20px;font-weight:700;font-family:var(--font-display);margin:8px 0 4px">' + esc(r.title) + '</h2>';
      html += '<div class="rp-period" style="margin-bottom:16px">' + fmtDate(r.created_at) + '</div>';
      if (r.summary) html += '<div style="font-size:13.5px;color:var(--t2);line-height:1.7;margin-bottom:22px">' + esc(r.summary) + '</div>';
      if (link) html += '<a class="btn btn-primary" href="' + esc(link) + '" target="_blank" rel="noopener">' + (r.type === 'link' ? 'Open Link →' : 'Open PDF →') + '</a>';
      html += '</div>';
      v.innerHTML = html;
      return;
    }
    html += '<span class="rp-type">' + esc(r.type || 'report') + '</span>';
    html += '<h2 style="font-size:20px;font-weight:700;font-family:var(--font-display);margin:8px 0 4px">' + esc(r.title) + '</h2>';
    html += '<div class="rp-period" style="margin-bottom:16px">' + (r.period_start ? fmtDate(r.period_start) + ' – ' + fmtDate(r.period_end) : fmtDate(r.created_at)) + '</div>';
    if (r.summary) html += '<div style="font-size:13.5px;color:var(--t2);line-height:1.7;margin-bottom:22px">' + esc(r.summary) + '</div>';
    if (r.chart_data && Object.keys(r.chart_data).length) html += performancePreview(r);
    (r.sections || []).forEach(function (s) {
      html += '<div class="rp-detail-sec"><h3>' + esc(s.label || '') + '</h3><div class="body">' + esc(s.content || '') + '</div></div>';
    });
    html += '</div>';
    v.innerHTML = html;
  };
  // ============================ TICKETS ============================
  var STATUS_COLOR = {
    new: '#64748B', inprogress: '#2563EB', review: '#B45309', approved: '#0D9488', delivered: '#16A34A', done: '#16A34A',
    // Phase 3 ticket-request flow — same status field, two more values.
    pending_approval: '#D97706', rejected: '#DC2626',
  };
  function statusBadge(t) {
    var c = STATUS_COLOR[t.status] || '#64748B';
    return '<span class="status-badge" style="background:' + c + '1A;color:' + c + '">' + esc(t.statusLabel || t.status) + '</span>';
  }
  // Ticket "id" here is always the human-readable ticket number (e.g.
  // "NVR-1202") -- this app has no separate internal ticket UUID, so
  // showing it is safe and is exactly the reference number staff use.
  function priorityBadge(t) {
    if (!t.priority || t.priority === 'normal') return '';
    var cls = (t.priority === 'highest' || t.priority === 'urgent') ? 'pr-highest' : 'pr-high';
    return '<span class="priority-badge ' + cls + '">' + esc(t.priority) + '</span>';
  }
  function ticketRowHTML(t) {
    return '<div class="tk-row" onclick="openTicket(\'' + esc(t.id) + '\')">' +
      (t.unread ? '<span class="unread-dot" title="New update"></span>' : '') +
      '<div class="tk-main">' +
      '<div class="tk-idrow"><span class="tk-id">' + esc(t.id) + '</span>' + priorityBadge(t) + (t.isRecurring ? '<span class="recurring-tag" title="Recurring task">' + ICON('refresh', 11) + ' Recurring</span>' : '') + '</div>' +
      '<div class="tk-title">' + esc(t.title) + (t.blocked ? '<span class="blocked-tag">Blocked</span>' : '') + '</div>' +
      '<div class="tk-prev">' + (t.lastMessagePreview ? esc(t.lastMessagePreview) : '<span style="color:var(--t3)">No messages yet</span>') + '</div>' +
      '<div class="tk-meta">' + esc(fmtDueSmart(t.due)) + ' · Updated ' + fmtTime(t.updated_at) + '</div>' +
      '</div>' +
      (t.messageCount ? '<div class="tk-count">' + ICON('ticket', 13) + t.messageCount + '</div>' : '') +
      statusBadge(t) + '</div>';
  }
  // Phase 5, 2026-09: separates the one existing ticket list into four
  // client-understandable groups by the ticket's own real status — no
  // second ticket record, no duplicate fetch per tab, just a client-side
  // filter over the same /api/portal/tickets response already loaded.
  var TICKETS_TABS = [
    { id: 'active', label: 'Active', match: function (t) { return ['new', 'inprogress', 'review', 'approved'].indexOf(t.status) > -1; } },
    { id: 'pending', label: 'Waiting for Approval', match: function (t) { return t.status === 'pending_approval'; } },
    { id: 'completed', label: 'Completed', match: function (t) { return t.status === 'delivered' || t.status === 'done'; } },
    { id: 'rejected', label: 'Rejected', match: function (t) { return t.status === 'rejected'; } },
  ];
  function ticketsTabsHTML(all, activeTab) {
    return '<div class="tabs-row" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' + TICKETS_TABS.map(function (tab) {
      var count = all.filter(tab.match).length;
      var on = tab.id === activeTab;
      return '<button type="button" class="tab-chip' + (on ? ' on' : '') + '" onclick="setTicketsTab(\'' + tab.id + '\')" ' +
        'style="padding:7px 14px;font-size:12.5px;font-weight:600;border-radius:20px;cursor:pointer;font-family:inherit;' +
        (on ? 'background:var(--accent);border:1px solid var(--accent);color:#fff' : 'background:var(--card);border:1px solid var(--b1);color:var(--t2)') + '">' +
        esc(tab.label) + (count ? ' (' + count + ')' : '') + '</button>';
    }).join('') + '</div>';
  }
  function renderTicketsList() {
    var v = $('view'); if (!v || state.view !== 'tickets') return;
    var readonly = state.role === 'preview';
    var all = state._ticketsAll || [];
    var tab = TICKETS_TABS.find(function (t) { return t.id === state._ticketsTab; }) || TICKETS_TABS[0];
    var list = all.filter(tab.match);
    var header = '<div class="sec-h" style="margin-top:0"><div><div class="t">Your Tickets</div><div class="sub">Conversations and requests</div></div>' +
      (readonly ? '' : '<button class="btn btn-primary" style="padding:8px 16px;font-size:13px" onclick="openCreateTicketModal()">' + ICON('plus', 14) + ' Create Ticket</button>') + '</div>';
    var tabs = ticketsTabsHTML(all, tab.id);
    var body;
    if (!all.length) body = emptyState('ticket', 'No tickets yet', 'Conversations with your team will appear here.');
    else if (!list.length) body = emptyState('ticket', 'Nothing here yet', tab.id === 'pending' ? 'Requests waiting for approval will appear here.' : tab.id === 'rejected' ? 'Requests that weren’t approved will appear here, with the reason.' : tab.id === 'completed' ? 'Finished work will appear here once delivered.' : 'Your active work will appear here.');
    else body = '<div class="card">' + list.map(ticketRowHTML).join('') + '</div>';
    v.innerHTML = header + tabs + body;
  }
  window.setTicketsTab = function (tabId) { state._ticketsTab = tabId; renderTicketsList(); };
  function renderTickets(v) {
    if (!state._ticketsTab) state._ticketsTab = 'active';
    v.innerHTML = '<div class="skel">Loading…</div>';
    api('tickets').then(function (d) {
      if (state.view !== 'tickets') return;
      state._ticketsAll = d.tickets || [];
      renderTicketsList();
    }).catch(function (e) { v.innerHTML = errState(e.message); });
  }

  // ============================ CREATE TICKET (Phase 3) ============================
  // Mirrors SELECTABLE_CLIENT_SERVICES / QT_PROJECTS_BY_SERVICE in index.html —
  // the one existing Service -> Project/Sub-service taxonomy, id+label only
  // (no icons/recurring flags — not needed for a request form). Kept
  // identical to that source by hand, same convention already used between
  // index.html/api/recurring/_engine.js/api/portal/tickets.js for their own
  // shared vocabularies.
  var PORTAL_SERVICES = [
    { id: 'sales', label: 'Sales/Outreach' },
    { id: 'seo', label: 'SEO' },
    { id: 'ppc', label: 'PPC / Paid Ads' },
    { id: 'social', label: 'Social Media' },
    { id: 'web', label: 'Web Dev' },
    { id: 'weboptimisation', label: 'Website Optimisation' },
    { id: 'uiux', label: 'UI/UX' },
    { id: 'email', label: 'Email Campaign' },
    { id: 'content', label: 'Content' },
  ];
  var PORTAL_PROJECTS_BY_SERVICE = {
    sales: [
      { id: 'sales-icp-research', label: 'ICP & Prospect Research' },
      { id: 'sales-data-rescrape-enrichment', label: 'Fresh Data Rescrape & Enrichment' },
      { id: 'sales-leadgen-campaign', label: 'Lead Generation Campaign' },
      { id: 'sales-cold-email-campaign', label: 'Cold Email Campaign Management' },
      { id: 'sales-linkedin-outreach', label: 'LinkedIn Outreach Campaign' },
      { id: 'sales-lead-qualification', label: 'Lead Qualification & Enrichment' },
      { id: 'sales-outreach-campaign-setup', label: 'Outreach Campaign Setup' },
      { id: 'sales-email-ab-testing', label: 'Email A/B Testing' },
      { id: 'sales-linkedin-ab-testing', label: 'LinkedIn A/B Testing' },
      { id: 'sales-campaign-performance-review', label: 'Campaign Performance Review' },
    ],
    seo: [
      { id: 'seo-technical-audit', label: 'Technical SEO Audit' },
      { id: 'seo-onpage', label: 'On-Page Optimisation' },
      { id: 'seo-offpage-linkbuilding', label: 'Off-Page Link Building' },
      { id: 'seo-keyword-strategy', label: 'Keyword Research & Strategy' },
      { id: 'seo-local-gbp', label: 'Local SEO/Google Business Profile' },
      { id: 'seo-schema-markup', label: 'Schema Markup Implementation' },
      { id: 'seo-competitor-analysis', label: 'Competitor Analysis' },
      { id: 'seo-content-implementation', label: 'SEO Content Implementation' },
    ],
    ppc: [
      { id: 'ppc-google-ads', label: 'Google Ads Setup & Management' },
      { id: 'ppc-meta-ads', label: 'Meta Ads Setup & Management' },
      { id: 'ppc-ad-copy-creative', label: 'Ad Copy & Creative Development' },
      { id: 'ppc-campaign-audit', label: 'Campaign Audit & Optimisation' },
      { id: 'ppc-landing-page', label: 'Landing Page Build for Ads' },
      { id: 'ppc-conversion-tracking', label: 'Conversion Tracking Setup' },
    ],
    social: [
      { id: 'social-content-calendar', label: 'Content Calendar & Scheduled Posting' },
      { id: 'social-strategy-planning', label: 'Social Strategy & Planning' },
      { id: 'social-community-management', label: 'Community Management' },
      { id: 'social-story-reels', label: 'Story/Reels Content' },
      { id: 'social-paid-boosting', label: 'Paid Social Boosting' },
    ],
    web: [
      { id: 'web-new-build', label: 'New Website Build' },
      { id: 'web-migration', label: 'Website Migration' },
      { id: 'web-new-page-feature', label: 'New Page/Feature Development' },
      { id: 'web-form-integration', label: 'Form & Third-Party Integration Build' },
      { id: 'web-design-mockups', label: 'Design Mockups & Wireframing' },
    ],
    weboptimisation: [
      { id: 'weboptimisation-site-speed', label: 'Site Speed Optimisation' },
      { id: 'weboptimisation-cro', label: 'Conversion Rate Optimisation (CRO)' },
      { id: 'weboptimisation-ux-improvements', label: 'UX Improvements' },
      { id: 'weboptimisation-content-blog', label: 'Existing Content/Blog Optimisation' },
    ],
    uiux: [
      { id: 'uiux-audit', label: 'UI/UX Audit' },
      { id: 'uiux-research-user-flows', label: 'UX Research & User Flows' },
      { id: 'uiux-wireframing', label: 'Wireframing' },
      { id: 'uiux-website-design', label: 'Website UI Design' },
      { id: 'uiux-landing-page-design', label: 'Landing Page Design' },
      { id: 'uiux-ads-creatives', label: 'Ads Creatives' },
      { id: 'uiux-saas-dashboard-design', label: 'SaaS/Dashboard UI Design' },
      { id: 'uiux-mobile-responsive-design', label: 'Mobile/Responsive UI Design' },
      { id: 'uiux-design-system-components', label: 'Design System & Components' },
      { id: 'uiux-figma-prototype', label: 'Figma Prototype' },
      { id: 'uiux-redesign-improvements', label: 'UI Redesign / UI Improvements' },
    ],
    email: [
      { id: 'email-newsletter', label: 'Newsletter Campaign' },
      { id: 'email-automation-drip', label: 'Automation/Drip Sequence Setup' },
      { id: 'email-platform-management', label: 'Email Platform Account Management' },
      { id: 'email-oneoff-send', label: 'One-off Campaign Send' },
      { id: 'email-list-segmentation', label: 'List Segmentation & Cleanup' },
    ],
    content: [
      { id: 'content-blog-recurring', label: 'Weekly/Recurring Blog Writing' },
      { id: 'content-blog-template-author', label: 'Blog Template & Author Page Development' },
      { id: 'content-landing-copy', label: 'Landing Page Copywriting' },
      { id: 'content-case-study-whitepaper', label: 'Case Study/Whitepaper' },
      { id: 'content-social-copy', label: 'Social Copy' },
    ],
  };
  function ntProjectOptions(svc) {
    return (PORTAL_PROJECTS_BY_SERVICE[svc] || []).map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.label) + '</option>';
    }).join('');
  }
  function ntShowErr(msg) { var el = $('nt-err'); if (el) { el.textContent = msg; el.classList.add('show'); } }

  window.openCreateTicketModal = function () {
    state.newTicketAttachments = [];
    var svcOptions = PORTAL_SERVICES.map(function (s) { return '<option value="' + s.id + '">' + esc(s.label) + '</option>'; }).join('');
    var html = '<div style="font-size:16px;font-weight:800;margin-bottom:4px">Create Ticket</div>' +
      '<div style="color:var(--t3);font-size:12.5px;margin-bottom:18px">Submit a new work request — your team will review and approve it.</div>' +
      '<div class="err" id="nt-err"></div>' +
      '<div class="field"><label>Ticket Title</label><input id="nt-title" type="text" placeholder="e.g. Prepare campaign for approval"></div>' +
      '<div class="field"><label>Description</label><textarea id="nt-desc" rows="4" placeholder="Describe what you need…"></textarea></div>' +
      '<div style="display:flex;gap:10px">' +
      '<div class="field" style="flex:1"><label>Service</label><select id="nt-service" onchange="onCreateTicketServiceChange()">' + svcOptions + '</select></div>' +
      '<div class="field" style="flex:1"><label>Project</label><select id="nt-project"></select></div>' +
      '</div>' +
      '<div class="field"><label>Requested Due Date <span style="font-weight:400;color:var(--t3)">(optional)</span></label><input id="nt-due" type="date"></div>' +
      '<div class="field">' +
      '<label>Attachments <span style="font-weight:400;color:var(--t3)">(optional, up to 5)</span></label>' +
      '<div class="catt-list" id="nt-att-list"></div>' +
      '<button type="button" class="btn btn-ghost" style="padding:7px 14px;font-size:12.5px;margin-top:6px" onclick="document.getElementById(\'nt-att-input\').click()">' + ICON('folder', 13) + ' Attach files</button>' +
      '<input type="file" id="nt-att-input" multiple style="display:none" onchange="onCreateTicketAttachmentPicked(event)">' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-top:6px">' +
      '<button class="btn btn-ghost btn-block" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary btn-block" id="nt-submit-btn" onclick="submitCreateTicket()">Submit Request</button>' +
      '</div>';
    openModal(html);
    $('nt-project').innerHTML = ntProjectOptions(PORTAL_SERVICES[0].id);
  };

  window.onCreateTicketServiceChange = function () {
    var sel = $('nt-service'); if (!sel) return;
    $('nt-project').innerHTML = ntProjectOptions(sel.value);
  };

  function renderCreateTicketAttachments() {
    var el = $('nt-att-list'); if (!el) return;
    el.innerHTML = (state.newTicketAttachments || []).map(function (f, i) {
      return '<div class="catt-chip">' + esc(f.name) + '<button type="button" onclick="removeCreateTicketAttachment(' + i + ')">&times;</button></div>';
    }).join('');
  }
  window.onCreateTicketAttachmentPicked = function (e) {
    var files = Array.prototype.slice.call((e.target && e.target.files) || []);
    e.target.value = '';
    if (!state.newTicketAttachments) state.newTicketAttachments = [];
    if (state.newTicketAttachments.length + files.length > 5) { toast('Up to 5 attachments.'); return; }
    files.forEach(function (f) {
      if (f.size > 20 * 1024 * 1024) { toast(f.name + ' is too large (20MB max)'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        state.newTicketAttachments.push({ name: f.name, mimeType: f.type || 'application/octet-stream', dataBase64: reader.result });
        renderCreateTicketAttachments();
      };
      reader.readAsDataURL(f);
    });
  };
  window.removeCreateTicketAttachment = function (i) {
    state.newTicketAttachments.splice(i, 1);
    renderCreateTicketAttachments();
  };

  window.submitCreateTicket = function () {
    var errEl = $('nt-err'); if (errEl) errEl.classList.remove('show');
    var title = ($('nt-title').value || '').trim();
    var description = ($('nt-desc').value || '').trim();
    var service = $('nt-service').value;
    var projSel = $('nt-project');
    var projOpt = projSel && projSel.options[projSel.selectedIndex];
    var due = $('nt-due').value || null;
    if (!title) { ntShowErr('Please enter a ticket title.'); return; }
    if (!description) { ntShowErr('Please describe your request.'); return; }
    var btn = $('nt-submit-btn'); btn.disabled = true; btn.textContent = 'Submitting…';
    api('tickets', {
      method: 'POST',
      body: {
        title: title,
        description: description,
        service: service,
        project: projOpt ? { id: projOpt.value, label: projOpt.textContent } : null,
        due: due,
        attachments: state.newTicketAttachments || [],
      },
    }).then(function () {
      closeModal();
      toast('Your request has been submitted and is waiting for approval.');
      // Land on the tab that actually shows it — a freshly submitted request
      // is 'pending_approval', so the default 'Active' tab would otherwise
      // hide the very thing the client just did.
      state._ticketsTab = 'pending';
      nav('tickets');
    }).catch(function (e) {
      ntShowErr(e.message);
    }).finally(function () {
      btn.disabled = false; btn.textContent = 'Submit Request';
    });
  };

  window.openTicket = function (id) {
    state.ticketId = id;
    state.editingId = null; resetEditRec();
    var v = $('view'); $('pg-title').textContent = 'Ticket'; setPageHead('');
    v.innerHTML = '<button class="btn btn-ghost" onclick="nav(\'tickets\')" style="margin-bottom:14px">' + ICON('back', 14) + ' All tickets</button>' +
      '<div class="card" id="tk-detail"><div class="skel">Loading…</div></div>';
    loadTicket(id, true, true);
    if (state.pollTimer) clearInterval(state.pollTimer);
    // Poll refreshes only swap the message list in-place (fresh=false) so an
    // in-progress draft, attachment picks, or an active voice recording in
    // the composer are never wiped out from under the client.
    state.pollTimer = setInterval(function () { if (state.ticketId === id) loadTicket(id, false, false); }, 5000);
  };

  // ---- message bubble rendering (text, voice note + transcript, Loom card,
  // attachments, notes, resolved staff author name, edit/delete state) ----
  function msgHTML(m) {
    var cls = m.fromClient ? 'in' : 'out';
    if (m.deleted) {
      return '<div class="msg ' + cls + ' msg-deleted">' + ICON('xcircle', 12) + '<i>Message deleted</i><div class="mt">' + fmtTime(m.time) + '</div></div>';
    }
    if (m.fromClient && state.editingId === m.id) return editMsgHTML(m);
    var body = '';
    if (!m.fromClient && m.authorName) body += '<div class="msg-author">' + esc(m.authorName) + '</div>';
    if (m.text) body += linkify(esc(m.text));
    if (m.audioUrl) body += '<div style="margin-top:8px"><audio controls src="' + esc(m.audioUrl) + '" style="width:100%;height:32px;max-width:260px"></audio></div>';
    if (m.transcript) body += '<div class="msg-transcript">' + ICON('play', 11) + ' ' + esc(m.transcript) + '</div>';
    if (m.loom && m.loom.url) {
      body += '<a class="msg-loom" href="' + esc(m.loom.url) + '" target="_blank" rel="noopener">' +
        (m.loom.thumbnail ? '<img src="' + esc(m.loom.thumbnail) + '" alt="">' : '') +
        '<div><div class="msg-loom-title">' + esc(m.loom.title || 'Loom video') + '</div><div class="msg-loom-cta">Watch on Loom →</div></div></a>';
    }
    if (m.attachments && m.attachments.length) {
      body += '<div class="msg-att-row">' + m.attachments.map(function (a) {
        return '<a class="msg-att" href="' + esc(a.url) + '" target="_blank" rel="noopener">' + ICON('folder', 12) + esc(a.name) + '</a>';
      }).join('') + '</div>';
    }
    if (m.notes) body += '<div class="msg-notes">' + esc(m.notes) + '</div>';
    body += '<div class="mt">' + fmtTime(m.time) + (m.edited ? ' · edited' : '') + '</div>';
    // Only the client's own comments are editable/deletable — never a staff
    // message — and never while previewing (read-only).
    if (m.fromClient && state.role !== 'preview') {
      body += '<div class="msg-actions">' +
        '<button type="button" onclick="startEditMessage(\'' + esc(m.id) + '\')">Edit</button>' +
        '<button type="button" onclick="confirmDeleteMessage(\'' + esc(m.id) + '\')">Delete</button>' +
        '</div>';
    }
    return '<div class="msg ' + cls + '">' + body + '</div>';
  }

  function renderMessagesHTML() {
    var list = state.currentThread || [];
    return list.map(msgHTML).join('') || '<div class="empty"><div class="empty-ico">' + ICON('ticket', 20) + '</div><div class="empty-t">Start the conversation below</div></div>';
  }

  // ---- inline edit form for one of the client's own messages — a plain
  // text edit for a text comment, or (for a voice note) an editable
  // transcript plus an optional re-record, reusing the same recording
  // engine as the composer (target:'edit' instead of 'compose') ----
  function editMsgHTML(m) {
    var er = state.editRec;
    var html = '<div class="msg-edit-box">';
    if (!m.audioUrl) {
      html += '<textarea class="cnotes-ta" id="edit-text-ta" style="min-height:60px">' + esc(m.text || '') + '</textarea>';
    } else {
      if (er.recording) {
        html += '<div class="cvoice-bar"><span class="cvoice-dot"></span><span class="cvoice-timer" id="evoice-timer">0:00</span>' +
          '<button type="button" class="btn btn-ghost" style="padding:5px 12px;font-size:12px" onclick="stopVoiceRecording(\'edit\')">Stop</button></div>';
      } else if (er.audioUrl) {
        html += '<div class="cvoice-bar"><audio controls src="' + er.audioUrl + '"></audio>' +
          '<button type="button" class="btn btn-ghost" style="padding:5px 10px;font-size:12px" onclick="discardVoiceNote(\'edit\')">Undo re-record</button></div>';
      } else {
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
          '<audio controls src="' + esc(m.audioUrl) + '" style="height:32px;flex:1;min-width:0"></audio>' +
          '<button type="button" class="ctool-btn" onclick="toggleVoice(\'edit\')">' + ICON('mic', 13) + ' Re-record</button></div>';
      }
      html += '<textarea class="cnotes-ta" id="edit-transcript-ta" placeholder="Transcript…">' + esc(er.audioUrl ? er.transcript : (m.transcript || '')) + '</textarea>';
    }
    html += '<div style="display:flex;gap:8px;margin-top:8px">' +
      '<button type="button" class="btn btn-ghost" style="padding:6px 14px;font-size:12.5px" onclick="cancelEditMessage()">Cancel</button>' +
      '<button type="button" class="btn btn-primary" style="padding:6px 14px;font-size:12.5px" onclick="saveEditMessage(\'' + esc(m.id) + '\')">Save</button>' +
      '</div></div>';
    return '<div class="msg in msg-editing">' + html + '</div>';
  }

  window.startEditMessage = function (id) {
    var m = (state.currentThread || []).find(function (x) { return x.id === id; });
    if (!m || !m.fromClient || m.deleted) return;
    state.editingId = id;
    resetEditRec();
    var body = $('chat-body'); if (body) body.innerHTML = renderMessagesHTML();
  };
  window.cancelEditMessage = function () {
    var er = state.editRec;
    if (er) {
      if (er.recording && er.recorder && er.recorder.state !== 'inactive') { try { er.recorder.stop(); } catch (e) {} }
      if (er.audioUrl) URL.revokeObjectURL(er.audioUrl);
    }
    state.editingId = null; resetEditRec();
    var body = $('chat-body'); if (body) body.innerHTML = renderMessagesHTML();
  };
  window.saveEditMessage = function (id) {
    var m = (state.currentThread || []).find(function (x) { return x.id === id; });
    if (!m) return;
    var er = state.editRec;
    if (er.recording) { toast('Finish or stop your re-recording first.'); return; }
    var payload = { commentId: id };
    if (!m.audioUrl) {
      var ta = $('edit-text-ta');
      var text = ta ? ta.value.trim() : '';
      if (!text && !(m.attachments && m.attachments.length) && !m.loom) { toast('Message cannot be empty.'); return; }
      payload.text = text;
      sendEdit(payload);
      return;
    }
    var tta = $('edit-transcript-ta');
    var transcript = tta ? tta.value.trim() : '';
    var finish = function (audioB64) {
      if (audioB64) payload.audio = { dataBase64: audioB64, mimeType: (er.audioBlob && er.audioBlob.type) || 'audio/webm', duration: er.audioDuration };
      payload.transcript = transcript;
      sendEdit(payload);
    };
    if (er.audioBlob) {
      var reader = new FileReader();
      reader.onload = function () { finish(reader.result); };
      reader.readAsDataURL(er.audioBlob);
    } else finish(null);
  };
  // Refreshes just the message thread after an edit/delete — deliberately
  // NOT loadTicket(...,fresh:true), which would also rebuild the composer
  // (and wipe any unrelated draft/attachments/recording the client has in
  // progress in the main composer while editing a different message).
  function refreshThread() {
    var id = state.ticketId; if (!id) return;
    api('tickets?id=' + encodeURIComponent(id)).then(function (d) {
      if (state.ticketId !== id || !d || !d.ticket) return;
      state.ticketMentionable = d.ticket.mentionable || [];
      state.currentThread = d.ticket.thread || [];
      var body = $('chat-body'); if (body) body.innerHTML = renderMessagesHTML();
    }).catch(function (e) { toast(e.message); });
  }
  function sendEdit(payload) {
    api('tickets?id=' + encodeURIComponent(state.ticketId), { method: 'PATCH', body: payload })
      .then(function () { state.editingId = null; resetEditRec(); refreshThread(); })
      .catch(function (e) { toast(e.message); });
  }

  window.confirmDeleteMessage = function (id) {
    openModal('<div style="font-size:16px;font-weight:800;margin-bottom:6px">Delete this message?</div>' +
      '<div style="color:var(--t2);margin-bottom:18px;font-size:13.5px">This can\'t be undone. Your team will still see that a message was deleted.</div>' +
      '<div style="display:flex;gap:10px"><button class="btn btn-ghost btn-block" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-danger btn-block" onclick="doDeleteMessage(\'' + esc(id) + '\')">Delete</button></div>');
  };
  window.doDeleteMessage = function (id) {
    closeModal();
    api('tickets?id=' + encodeURIComponent(state.ticketId), { method: 'DELETE', body: { commentId: id } })
      .then(function () {
        if (state.editingId === id) { state.editingId = null; resetEditRec(); }
        refreshThread();
      })
      .catch(function (e) { toast(e.message); });
  };

  function composerHTML() {
    return '<div class="composer-wrap">' +
      '<div class="composer" style="position:relative">' +
      '<div class="mention-menu" id="mention-menu"></div>' +
      '<textarea id="msg-in" rows="1" placeholder="Write a message… (@ to mention Admin, Operations or your team)" oninput="onMsgInput(this)" onkeydown="msgKey(event)"></textarea>' +
      '<button class="btn btn-primary" onclick="sendMsg()">Send</button>' +
      '</div>' +
      '<div class="composer-tools">' +
      '<button type="button" class="ctool-btn" id="ctool-voice" onclick="toggleVoice()">' + ICON('mic', 14) + ' Voice</button>' +
      '<button type="button" class="ctool-btn" onclick="pickAttachment()">' + ICON('folder', 14) + ' Attach</button>' +
      '<button type="button" class="ctool-btn" id="ctool-loom" onclick="toggleLoomInput()">' + ICON('video', 14) + ' Loom</button>' +
      '<button type="button" class="ctool-btn" id="ctool-notes" onclick="toggleNotesInput()">' + ICON('notepad', 14) + ' Notes</button>' +
      '<input type="file" id="att-input" multiple style="display:none" onchange="onAttachmentPicked(event)">' +
      '</div>' +
      '<div class="composer-extra" id="composer-extra"></div>' +
      '</div>';
  }

  function loadTicket(id, scroll, fresh) {
    api('tickets?id=' + encodeURIComponent(id)).then(function (d) {
      if (state.ticketId !== id) return;
      var t = d.ticket;
      state.ticketMentionable = t.mentionable || [];
      state.currentThread = t.thread || [];
      if (fresh) {
        var readonly = state.role === 'preview';
        var assignRow = (t.assignedTo && t.assignedTo.length) ? '<div class="assignee-row">' + t.assignedTo.map(function (m) {
          return '<div class="assignee-av" title="' + esc(m.name) + '">' + (m.photo ? '<img src="' + esc(m.photo) + '" alt="">' : esc(initials(m.name))) + '</div>';
        }).join('') + '<span style="font-size:11.5px;color:var(--t3)">' + t.assignedTo.map(function (m) { return esc(m.name); }).join(', ') + '</span></div>' : '';
        var metaBits = [];
        if (t.serviceLabel) metaBits.push(esc(t.serviceLabel));
        if (t.project) metaBits.push(esc(t.project));
        if (t.isRecurring) {
          metaBits.push(t.recurringLabel ? ('Recurring: ' + esc(t.recurringLabel)) : 'Recurring task');
          if (t.nextDue) metaBits.push('Next due: ' + fmtDate(t.nextDue));
        } else {
          metaBits.push('One-time task');
        }
        var metaRow = '<div style="font-size:12px;color:var(--t3);margin-top:4px">' + metaBits.join(' · ') + '</div>';

        // Phase 3 ticket-request states: a 'pending_approval'/'rejected'
        // ticket isn't an active piece of work yet (no team assigned, often
        // no thread), so the chat body shows the client's own request text
        // instead of an empty "start the conversation" state, and the
        // composer is hidden until there's an actual ticket to discuss. Once
        // approved, this collapses to a small "Requested by you / Approved
        // by X" line above the normal thread+composer — nothing else changes.
        var pendingOrRejected = t.status === 'pending_approval' || t.status === 'rejected';

        // Phase 5, 2026-09: the client-request lifecycle (Submitted ->
        // Approved/Rejected) is shown as a short, dated timeline instead of
        // one prose line — built entirely from quick_meta.client_request's
        // own timestamps (already fetched for reqBanner below), never a new
        // history/audit system. Every ticket also gets a lightweight
        // "Action required" banner when there's a staff update the client
        // hasn't seen yet (t.unread, computed server-side the exact same way
        // the Tickets list's own unread dot already is) — reusing that
        // existing signal, never new workflow logic.
        var timelineHTML = '';
        if (t.clientRequest && (t.clientRequest.requestedAt || t.clientRequest.approvedAt || t.clientRequest.rejectedAt)) {
          var steps = [];
          if (t.clientRequest.requestedAt) steps.push({ date: t.clientRequest.requestedAt, label: 'Request submitted' });
          if (t.clientRequest.approvedAt) {
            steps.push({ date: t.clientRequest.approvedAt, label: t.clientRequest.approvedByName ? 'Approved by ' + esc(t.clientRequest.approvedByName) : 'Request approved' });
            if (t.assignedTo && t.assignedTo.length) steps.push({ date: t.clientRequest.approvedAt, label: 'Assigned to ' + esc(t.assignedTo.map(function (m) { return m.name; }).join(', ')) });
          }
          if (t.clientRequest.rejectedAt) steps.push({ date: t.clientRequest.rejectedAt, label: 'Request not approved' });
          timelineHTML = '<div style="font-size:12px;color:var(--t3);margin:10px 20px 0;padding:10px 12px;background:var(--surface-2);border-radius:var(--radius-sm)">' +
            steps.map(function (s) { return '<div style="display:flex;gap:8px;padding:2px 0"><span style="color:var(--t4);min-width:64px">' + esc(fmtDate(s.date)) + '</span><span>' + s.label + '</span></div>'; }).join('') +
            '</div>';
        }

        var reqBanner = '';
        if (t.status === 'pending_approval') {
          reqBanner = '<div style="background:var(--warn-bg);border:1px solid rgba(180,83,9,.25);color:var(--warn);padding:13px 20px;font-size:13.5px;font-weight:600;margin:16px 20px 0;border-radius:var(--radius-sm)">' +
            'Your request has been submitted and is waiting for approval from our team.</div>' + timelineHTML;
        } else if (t.status === 'rejected') {
          reqBanner = '<div style="background:var(--danger-bg);border:1px solid rgba(220,38,38,.25);color:var(--danger);padding:13px 20px;font-size:13.5px;margin:16px 20px 0;border-radius:var(--radius-sm)">' +
            '<div style="font-weight:700;margin-bottom:4px">Your ticket request was not approved.</div>' +
            (t.clientRequest && t.clientRequest.rejectionReason ? '<div>Reason: ' + esc(t.clientRequest.rejectionReason) + '</div>' : '') +
            '</div>' + timelineHTML;
        } else if (t.clientRequest) {
          reqBanner = timelineHTML;
        }

        var actionBanner = (!pendingOrRejected && t.unread)
          ? '<div style="background:var(--accent-soft);border:1px solid var(--accent);color:var(--accent-2);padding:12px 20px;font-size:13px;font-weight:600;margin:16px 20px 0;border-radius:var(--radius-sm);display:flex;align-items:center;gap:8px">' +
            ICON('alert', 14) + '<span>Action required — your team posted a new update. Please review and reply.</span></div>'
          : '';

        var bodyContent = pendingOrRejected
          ? '<div style="padding:6px 4px 10px"><div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Your Request</div>' +
            '<div style="font-size:14px;color:var(--t1);line-height:1.6;white-space:pre-wrap">' + esc(t.description || '') + '</div></div>'
          : renderMessagesHTML();

        var html = '<div class="chat-head"><div style="flex:1">' +
          '<div class="tk-idrow"><span class="tk-id">' + esc(t.id) + '</span>' + priorityBadge(t) + (t.isRecurring ? '<span class="recurring-tag" title="Recurring task">' + ICON('refresh', 11) + ' Recurring' + (t.recurringLabel ? ': ' + esc(t.recurringLabel) : '') + '</span>' : '') + '</div>' +
          '<div style="font-weight:800;font-size:16px">' + esc(t.title) + '</div>' +
          metaRow +
          '<div style="font-size:12px;color:var(--t2);margin-top:3px">' + esc(fmtDueSmart(t.due)) + '</div>' + assignRow + '</div>' +
          '<div style="text-align:right;flex-shrink:0"><div class="hc-eyebrow" style="margin-bottom:5px">Status</div>' + statusBadge(t) + '</div>' +
          '</div>' +
          reqBanner + actionBanner +
          '<div class="chat-body" id="chat-body">' + bodyContent + '</div>' +
          (readonly || pendingOrRejected ? '' : composerHTML());
        $('tk-detail').innerHTML = html;
        if (!readonly && !pendingOrRejected) initComposer();
      } else if (!state.editingId) {
        // A poll tick never overwrites the thread while the client is
        // mid-edit on one of their own messages — state.currentThread above
        // still picks up the latest data for when they finish.
        var body = $('chat-body');
        if (body) body.innerHTML = renderMessagesHTML();
      }
      if (scroll) { var b = $('chat-body'); if (b) b.scrollTop = b.scrollHeight; }
    }).catch(function (e) { if (state.ticketId === id && fresh) $('tk-detail').innerHTML = errState(e.message); });
  }

  window.autoGrow = function (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; };

  // ============================ COMPOSER (voice / attachments / Loom / notes / @mentions) ============================
  function resetComposer() {
    state.composer = {
      attachments: [], audioBlob: null, audioUrl: null, audioDuration: 0, transcript: '',
      recording: false, recorder: null, stream: null, chunks: [], recTimer: null, recStart: 0, speech: null,
      loomOpen: false, loomUrl: '', notesOpen: false, notes: '', mentions: [],
    };
  }
  function initComposer() { resetComposer(); renderComposerExtra(); syncToolButtons(); }

  // A re-record while editing an already-sent voice note uses the exact
  // same MediaRecorder/SpeechRecognition engine as composing a new one
  // (startVoiceRecording/stopVoiceRecording/discardVoiceNote below), just
  // pointed at this separate store instead of state.composer so re-recording
  // one of your own messages never touches an in-progress new message.
  function resetEditRec() {
    state.editRec = {
      recording: false, recorder: null, stream: null, chunks: [], recTimer: null, recStart: 0, speech: null,
      audioBlob: null, audioUrl: null, audioDuration: 0, transcript: '',
    };
  }
  function recStore(target) { return target === 'edit' ? state.editRec : state.composer; }

  function syncToolButtons() {
    var c = state.composer; if (!c) return;
    var vb = $('ctool-voice'); if (vb) vb.classList.toggle('on', c.recording || !!c.audioUrl);
    var lb = $('ctool-loom'); if (lb) lb.classList.toggle('on', c.loomOpen || !!c.loomUrl);
    var nb = $('ctool-notes'); if (nb) nb.classList.toggle('on', c.notesOpen || !!c.notes);
  }

  function renderComposerExtra() {
    var c = state.composer, box = $('composer-extra'); if (!c || !box) return;
    var html = '';
    if (c.attachments.length) {
      html += '<div class="catt-list">' + c.attachments.map(function (a, i) {
        return '<div class="catt-chip">' + ICON('folder', 12) + esc(a.name) + '<button type="button" onclick="removeAttachment(' + i + ')">×</button></div>';
      }).join('') + '</div>';
    }
    if (c.recording) {
      html += '<div class="cvoice-bar"><span class="cvoice-dot"></span><span class="cvoice-timer" id="cvoice-timer">0:00</span>' +
        '<button type="button" class="btn btn-ghost" style="padding:5px 12px;font-size:12px" onclick="stopVoiceRecording()">Stop</button></div>';
    } else if (c.audioUrl) {
      html += '<div class="cvoice-bar"><audio controls src="' + c.audioUrl + '"></audio>' +
        '<button type="button" class="btn btn-ghost" style="padding:5px 10px;font-size:12px" onclick="discardVoiceNote()">Remove</button></div>' +
        '<textarea class="cnotes-ta" id="voice-transcript-ta" placeholder="Transcript (auto-generated where supported — edit if needed)…" oninput="onTranscriptEdit(this)">' + esc(c.transcript) + '</textarea>';
    }
    if (c.loomOpen) {
      html += '<input type="text" class="cnotes-ta" style="min-height:auto" id="loom-url-in" placeholder="Paste a Loom link (https://www.loom.com/share/…)" value="' + esc(c.loomUrl) + '" oninput="onLoomInput(this)">';
    }
    if (c.notesOpen) {
      html += '<textarea class="cnotes-ta" id="notes-ta" placeholder="Add context or notes for your team…" oninput="onNotesInput(this)">' + esc(c.notes) + '</textarea>';
    }
    box.innerHTML = html;
  }

  window.pickAttachment = function () { var el = $('att-input'); if (el) el.click(); };
  window.onAttachmentPicked = function (e) {
    var files = Array.prototype.slice.call((e.target && e.target.files) || []);
    e.target.value = '';
    files.forEach(function (f) {
      if (f.size > 20 * 1024 * 1024) { toast(f.name + ' is too large (20MB max)'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        state.composer.attachments.push({ name: f.name, mimeType: f.type || 'application/octet-stream', dataBase64: reader.result });
        renderComposerExtra(); syncToolButtons();
      };
      reader.readAsDataURL(f);
    });
  };
  window.removeAttachment = function (i) { state.composer.attachments.splice(i, 1); renderComposerExtra(); syncToolButtons(); };

  window.toggleLoomInput = function () {
    var c = state.composer; c.loomOpen = !c.loomOpen; renderComposerExtra(); syncToolButtons();
    var el = $('loom-url-in'); if (el) el.focus();
  };
  window.onLoomInput = function (el) { state.composer.loomUrl = el.value.trim(); };
  window.toggleNotesInput = function () {
    var c = state.composer; c.notesOpen = !c.notesOpen; renderComposerExtra(); syncToolButtons();
    var el = $('notes-ta'); if (el) el.focus();
  };
  window.onNotesInput = function (el) { state.composer.notes = el.value; };
  window.onTranscriptEdit = function (el) { state.composer.transcript = el.value; };

  // target: 'compose' (default, new message) or 'edit' (re-recording one of
  // the client's own already-sent voice notes) — same engine, separate store
  // (recStore above) so the two never clobber each other.
  function refreshRecUI(target) {
    if (target === 'edit') {
      var body = $('chat-body'); if (body) body.innerHTML = renderMessagesHTML();
    } else { renderComposerExtra(); syncToolButtons(); }
  }
  window.toggleVoice = function (target) {
    target = target || 'compose';
    var c = recStore(target);
    if (c.recording) { stopVoiceRecording(target); return; }
    if (c.audioUrl) discardVoiceNote(target);
    startVoiceRecording(target);
  };
  function startVoiceRecording(target) {
    var c = recStore(target);
    var timerId = target === 'edit' ? 'evoice-timer' : 'cvoice-timer';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast('Voice recording is not supported in this browser.'); return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      c.stream = stream; c.chunks = []; c.transcript = '';
      var mr;
      try { mr = new MediaRecorder(stream); } catch (e) { toast('Voice recording is not supported in this browser.'); return; }
      c.recorder = mr;
      mr.ondataavailable = function (e) { if (e.data && e.data.size) c.chunks.push(e.data); };
      mr.onstop = function () {
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        var blob = new Blob(c.chunks, { type: mr.mimeType || 'audio/webm' });
        c.audioBlob = blob; c.audioUrl = URL.createObjectURL(blob);
        c.audioDuration = Math.round((Date.now() - c.recStart) / 1000);
        c.recording = false;
        if (c.recTimer) { clearInterval(c.recTimer); c.recTimer = null; }
        if (c.speech) { try { c.speech.stop(); } catch (e2) {} c.speech = null; }
        refreshRecUI(target);
      };
      c.recStart = Date.now(); c.recording = true;
      mr.start();
      refreshRecUI(target);
      c.recTimer = setInterval(function () {
        var el = $(timerId); if (!el) return;
        var sec = Math.floor((Date.now() - c.recStart) / 1000);
        el.textContent = Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60);
      }, 500);
      // Live transcript, best-effort (Chrome/Edge only) — never blocks the
      // recording itself if unsupported or denied.
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        try {
          var rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-GB';
          rec.onresult = function (ev) {
            var t = ''; for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
            c.transcript = t.trim();
          };
          rec.onerror = function () {};
          rec.start(); c.speech = rec;
        } catch (e3) {}
      }
    }).catch(function () { toast('Microphone access was denied.'); });
  }
  window.stopVoiceRecording = function (target) {
    var c = recStore(target || 'compose');
    if (c.recorder && c.recorder.state !== 'inactive') c.recorder.stop();
  };
  window.discardVoiceNote = function (target) {
    target = target || 'compose';
    var c = recStore(target);
    if (c.audioUrl) URL.revokeObjectURL(c.audioUrl);
    c.audioBlob = null; c.audioUrl = null; c.audioDuration = 0; c.transcript = '';
    refreshRecUI(target);
  };

  // ---- @mentions autocomplete — restricted to this ticket's own people
  // plus the always-available Admin/Operations pool (ticket.mentionable
  // from the GET response); never the full internal roster. ----
  window.onMsgInput = function (el) {
    autoGrow(el);
    var val = el.value, pos = el.selectionStart;
    var m = /@([A-Za-z]*)$/.exec(val.slice(0, pos));
    var menu = $('mention-menu');
    if (!menu) return;
    if (!m) { menu.classList.remove('show'); return; }
    var q = m[1].toLowerCase();
    var pool = state.ticketMentionable || [];
    var matches = pool.filter(function (p) { return p.name.toLowerCase().indexOf(q) === 0; }).slice(0, 6);
    if (!matches.length) { menu.classList.remove('show'); return; }
    menu.innerHTML = matches.map(function (p) {
      return '<div class="mention-item" data-id="' + esc(p.id) + '" data-name="' + esc(p.name) + '"><b>' + esc(p.name) + '</b><span>' + esc(p.group) + '</span></div>';
    }).join('');
    menu.classList.add('show');
  };
  window.onMentionMenuClick = function (e) {
    var item = e.target.closest && e.target.closest('.mention-item'); if (!item) return;
    if (e.preventDefault) e.preventDefault();
    var id = item.getAttribute('data-id'), name = item.getAttribute('data-name');
    var el = $('msg-in'); if (!el) return;
    var val = el.value, pos = el.selectionStart;
    var newUpto = val.slice(0, pos).replace(/@([A-Za-z]*)$/, '@' + name + ' ');
    el.value = newUpto + val.slice(pos);
    if (state.composer.mentions.indexOf(id) === -1) state.composer.mentions.push(id);
    $('mention-menu').classList.remove('show');
    el.focus();
  };

  window.msgKey = function (e) {
    var menu = $('mention-menu');
    if (menu && menu.classList.contains('show') && e.key === 'Enter') {
      e.preventDefault();
      var first = menu.querySelector('.mention-item');
      if (first) onMentionMenuClick({ target: first, preventDefault: function () {} });
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  window.sendMsg = function () {
    var ta = $('msg-in'); if (!ta) return;
    var c = state.composer || {};
    var text = ta.value.trim();
    var hasContent = text || c.notes || (c.attachments && c.attachments.length) || c.audioBlob || c.loomUrl;
    if (!hasContent) return;
    if (c.recording) { toast('Finish or stop your voice recording first.'); return; }

    var payload = { text: text, mentions: c.mentions || [] };
    if (c.notes) payload.notes = c.notes;
    if (c.attachments && c.attachments.length) payload.attachments = c.attachments.map(function (a) { return { name: a.name, mimeType: a.mimeType, dataBase64: a.dataBase64 }; });
    if (c.loomUrl) payload.loom = { url: c.loomUrl };
    if (c.transcript) payload.transcript = c.transcript;

    var sendBtn = document.querySelector('#tk-detail .composer .btn-primary'); if (sendBtn) sendBtn.disabled = true;
    var finish = function (audioB64) {
      if (audioB64) payload.audio = { dataBase64: audioB64, mimeType: (c.audioBlob && c.audioBlob.type) || 'audio/webm', duration: c.audioDuration };
      var body = $('chat-body');
      var preview = text || (payload.audio ? 'Voice note' : payload.loom ? 'Loom video' : payload.attachments ? 'Attachment' : '');
      body.insertAdjacentHTML('beforeend', '<div class="msg in" style="opacity:.6">' + linkify(esc(preview)) + '<div class="mt">Sending…</div></div>');
      body.scrollTop = body.scrollHeight;
      api('tickets?id=' + encodeURIComponent(state.ticketId), { method: 'POST', body: payload })
        .then(function () { loadTicket(state.ticketId, true, true); })
        .catch(function (e) { toast(e.message); if (sendBtn) sendBtn.disabled = false; });
    };
    if (c.audioBlob) {
      var reader = new FileReader();
      reader.onload = function () { finish(reader.result); };
      reader.readAsDataURL(c.audioBlob);
    } else finish(null);
  };

  // ============================ TEAM ============================
  var AVAIL = { available: { c: '#16A34A', l: 'Available' }, active: { c: '#2563EB', l: 'Active' }, busy: { c: '#B45309', l: 'Busy' } };
  function renderTeam(v) {
    api('team').then(function (d) {
      if (!d.team.length) { v.innerHTML = emptyState('users', 'No team assigned yet', 'Your assigned team will appear here.'); return; }
      v.innerHTML = '<div class="grid team-grid">' + d.team.map(function (m) {
        var a = AVAIL[m.availability] || AVAIL.active;
        return '<div class="card tm"><div class="tm-av" style="background:' + (m.color || '#2563EB') + '">' +
          (m.photo ? '<img src="' + esc(m.photo) + '" alt="">' : esc(m.initials || initials(m.name))) + '</div>' +
          '<div class="tm-name">' + esc(m.name) + '</div><div class="tm-role">' + esc(m.role) + '</div>' +
          '<div class="avail" style="color:' + a.c + '"><span class="d" style="background:' + a.c + '"></span>' + a.l + '</div></div>';
      }).join('') + '</div>';
    }).catch(function (e) { v.innerHTML = errState(e.message); });
  }

  // ============================ MEETINGS ============================
  function renderMeetings(v) {
    api('meetings').then(function (d) {
      var upcoming = d.meetings.filter(function (m) { return !m.isPast && m.status !== 'cancelled'; });
      var past = d.meetings.filter(function (m) { return m.isPast || m.status === 'cancelled'; });
      var html = '<button class="btn btn-primary" onclick="bookCall()" ' + (state.role === 'preview' ? 'disabled' : '') + ' style="margin-bottom:18px">' + ICON('plus', 15) + ' Book a call</button>';
      html += '<div class="sec-h">Upcoming</div>';
      html += upcoming.length ? '<div class="card">' + upcoming.map(meetingRow).join('') + '</div>' : emptyState('calendar', 'No upcoming meetings', 'Book a call and it will show here.');
      if (past.length) html += '<div class="sec-h">Past</div><div class="card">' + past.map(meetingRow).join('') + '</div>';
      v.innerHTML = html;
    }).catch(function (e) { v.innerHTML = errState(e.message); });
  }
  function meetingRow(m) {
    var dt = m.when ? new Date(m.when) : null;
    var d = dt ? dt.getDate() : '—', mon = dt ? dt.toLocaleString('en-GB', { month: 'short' }) : 'TBD';
    var join = m.meeting_url && !m.isPast ? '<a class="btn btn-primary" href="' + esc(m.meeting_url) + '" target="_blank" rel="noopener">Join</a>' : '';
    var rec = m.recording_url ? '<a class="btn btn-ghost" href="' + esc(m.recording_url) + '" target="_blank" rel="noopener">' + ICON('play', 13) + ' Recording</a>' : '';
    var sub = dt ? dt.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'Awaiting confirmation';
    return '<div class="mt-row"><div class="mt-date"><div class="d">' + d + '</div><div class="m">' + mon + '</div></div>' +
      '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14.5px">' + esc(m.title) + '</div>' +
      '<div style="font-size:12.5px;color:var(--t2);margin-top:2px">' + esc(sub) + (m.requested_by === 'client' && m.status === 'upcoming' && !m.meeting_url ? ' · requested' : '') + '</div>' +
      (m.notes ? '<div style="font-size:12.5px;color:var(--t3);margin-top:6px">' + esc(m.notes) + '</div>' : '') + '</div>' +
      '<div style="display:flex;gap:8px">' + join + rec + '</div></div>';
  }
  window.bookCall = function () {
    openModal('<div style="font-size:18px;font-weight:800;margin-bottom:6px">Book a call</div>' +
      '<div style="color:var(--t2);margin-bottom:18px;font-size:13.5px">Tell us what you\'d like to discuss and a preferred time. Your account manager will confirm.</div>' +
      '<div class="field"><label>Topic</label><input id="bc-title" placeholder="e.g. Monthly review"></div>' +
      '<div class="field"><label>Preferred date & time</label><input id="bc-when" type="datetime-local"></div>' +
      '<div class="field"><label>Notes (optional)</label><input id="bc-note" placeholder="Anything to prepare"></div>' +
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn btn-ghost btn-block" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary btn-block" onclick="submitCall()">Send request</button></div>');
  };
  window.submitCall = function () {
    var title = $('bc-title').value.trim() || 'Call request';
    api('meetings', { method: 'POST', body: { title: title, preferred_at: $('bc-when').value || null, note: $('bc-note').value.trim() } })
      .then(function () { closeModal(); toast('Call requested — we\'ll confirm shortly.'); nav('meetings'); })
      .catch(function (e) { toast(e.message); });
  };

  // ============================ NOTIFICATIONS ============================
  function startNotifPolling() {
    loadNotifs();
    if (state.notifTimer) clearInterval(state.notifTimer);
    state.notifTimer = setInterval(loadNotifs, 30000);
  }
  function loadNotifs() {
    api('notifications').then(function (d) {
      state._notifs = d.notifications;
      var dot = $('notif-dot');
      if (d.unread > 0) { dot.textContent = d.unread > 9 ? '9+' : d.unread; dot.classList.add('show'); } else dot.classList.remove('show');
      if ($('notif-panel').classList.contains('show')) renderNotifPanel();
    }).catch(function () {});
  }
  function renderNotifPanel() {
    var list = state._notifs || [];
    var html = '<div style="padding:14px 16px;border-bottom:1px solid var(--b1);display:flex;justify-content:space-between;align-items:center">' +
      '<b style="font-size:14px">Notifications</b>' + (list.some(function (n) { return !n.read; }) ? '<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px" onclick="markAllRead()">Mark all read</button>' : '') + '</div>';
    if (!list.length) html += '<div class="empty" style="padding:30px"><div class="empty-ico">' + ICON('bell', 20) + '</div><div class="empty-t">No notifications</div></div>';
    else html += list.map(function (n) {
      return '<div class="notif-item ' + (n.read ? '' : 'unread') + '"' + (n.ticket_id ? ' style="cursor:pointer" onclick="closeNotif();openTicket(\'' + esc(n.ticket_id) + '\')"' : '') + '>' +
        '<div class="notif-t">' + (n.ticket_id ? '<span class="notif-ticket-id">' + esc(n.ticket_id) + '</span>' : '') + esc(n.title || 'Update') + '</div><div class="notif-b">' + esc(n.body || '') + '</div>' +
        '<div style="font-size:11px;color:var(--t3);margin-top:4px">' + fmtTime(n.created_at) + '</div></div>';
    }).join('');
    $('notif-panel').innerHTML = html;
  }
  window.toggleNotif = function (e) { e.stopPropagation(); var p = $('notif-panel'); if (p.classList.contains('show')) closeNotif(); else { renderNotifPanel(); show(p); markAllRead(true); } };
  window.closeNotif = function () { hide($('notif-panel')); };
  window.markAllRead = function (silent) {
    if (state.role === 'preview') return;
    api('notifications', { method: 'POST', body: {} }).then(function () {
      (state._notifs || []).forEach(function (n) { n.read = true; }); $('notif-dot').classList.remove('show');
      if (!silent) renderNotifPanel();
    }).catch(function () {});
  };
  document.addEventListener('click', function (e) { if (!e.target.closest('#notif-panel') && !e.target.closest('.bell')) closeNotif(); });
  document.addEventListener('click', function (e) {
    if (e.target.closest && (e.target.closest('#mention-menu') || e.target.closest('#msg-in'))) return;
    var mm = $('mention-menu'); if (mm) mm.classList.remove('show');
  });
  document.addEventListener('mousedown', function (e) {
    var menu = $('mention-menu');
    if (menu && menu.classList.contains('show') && e.target.closest && e.target.closest('#mention-menu')) onMentionMenuClick(e);
  });

  // ============================ modal / utils ============================
  window.openModal = function (html) { $('modal').innerHTML = html; show($('modal-bg')); };
  window.closeModal = function () { hide($('modal-bg')); };

  function emptyState(icoName, title, sub) { return '<div class="empty"><div class="empty-ico">' + ICON(icoName, 20) + '</div><div class="empty-t">' + title + '</div><div class="empty-sub">' + sub + '</div></div>'; }
  function errState(msg) { return '<div class="empty"><div class="empty-ico empty-ico-danger">' + ICON('alert', 20) + '</div><div class="empty-t">' + esc(msg) + '</div><div style="margin-top:10px"><button class="btn btn-ghost" onclick="nav(state.view)">Retry</button></div></div>'; }
  function linkify(s) { return s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="text-decoration:underline">$1</a>'); }
  function fmtDate(s) { if (!s) return ''; var d = new Date(s); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  // "Due today"/"Due tomorrow"/"23 Sep 2026"/"No due date" — never invents a
  // date: an empty/missing ticket.due always falls through to the last case.
  function fmtDueSmart(s) {
    if (!s) return 'No due date';
    var d = new Date(s); if (isNaN(d.getTime())) return 'No due date';
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var dd = new Date(d); dd.setHours(0, 0, 0, 0);
    var days = Math.round((dd - today) / 86400000);
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return fmtDate(s);
  }
  function fmtTime(s) { if (!s) return ''; var d = new Date(s), now = new Date(); var sameDay = d.toDateString() === now.toDateString();
    return sameDay ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  // expose state for retry button
  window.state = state;

  // ============================ STARTUP ============================
  function start() {
    var hash = location.hash || '';
    // Ticket-notification email deep link: #ticket=<id>. Captured before the
    // setup/preview checks below and stashed on state (not persisted) so it
    // survives however the client reaches a valid session from here — already
    // logged in (boot() opens it immediately) or needs to log in first
    // (boot() opens it right after). The id itself is not a credential: the
    // portal API still enforces that the authenticated client owns this
    // ticket before returning anything for it.
    if (hash.indexOf('ticket=') >= 0) {
      var tid = decodeURIComponent(hash.split('ticket=')[1].split('&')[0]);
      if (tid) state._pendingTicketId = tid;
      history.replaceState(null, '', location.pathname);
      hash = '';
    }
    // first-time setup link: #setup=<token>&email=<email>
    if (hash.indexOf('setup=') >= 0) {
      var params = {}; hash.replace(/^#/, '').split('&').forEach(function (kv) { var p = kv.split('='); params[p[0]] = decodeURIComponent(p[1] || ''); });
      state._setupFlow = { token: params.setup, email: params.email };
      showSetup({ change: false }); return;
    }
    // developer preview: #preview=<token>
    if (hash.indexOf('preview=') >= 0) {
      var tok = hash.split('preview=')[1].split('&')[0];
      state.token = decodeURIComponent(tok); history.replaceState(null, '', location.pathname); boot(); return;
    }
    state.token = localStorage.getItem(TOKEN_KEY);
    var p = state.token && decodeToken(state.token);
    if (state.token && p && (!p.exp || p.exp > Date.now())) boot();
    else { if (state.token) localStorage.removeItem(TOKEN_KEY); state.token = null; showLogin(); }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && $('auth').style.display !== 'none' && $('login-view').style.display !== 'none') doLogin(); });
  start();
})();
