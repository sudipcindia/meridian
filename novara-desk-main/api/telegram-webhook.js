// Vercel Serverless Function — receives POST from Telegram servers
// Env vars required (set in Vercel dashboard):
//   TELEGRAM_BOT_TOKEN
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   TELEGRAM_COMMS_CHAT_ID (optional)
const L = require('./portal/_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing env vars:', { BOT_TOKEN: !!BOT_TOKEN, SUPABASE_URL: !!SUPABASE_URL, SUPABASE_KEY: !!SUPABASE_KEY });
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const update = req.body;
  const msg = update && update.message;
  if (!msg) return res.status(200).json({ ok: true });

  const chatId = msg.chat && msg.chat.id;
  const text = msg.text || msg.caption || '';
  const username = (msg.from && msg.from.username) || '';
  const firstName = (msg.from && msg.from.first_name) || '';

  // Extract media attachments from message
  var attachments = [];
  if (msg.photo && msg.photo.length) {
    var p = msg.photo[msg.photo.length - 1];
    attachments.push({ type: 'photo', file_id: p.file_id, width: p.width, height: p.height });
  }
  if (msg.document) {
    attachments.push({ type: 'document', file_id: msg.document.file_id,
      file_name: msg.document.file_name || 'file', mime_type: msg.document.mime_type || '' });
  }
  if (msg.video) {
    attachments.push({ type: 'video', file_id: msg.video.file_id,
      file_name: msg.video.file_name || 'video.mp4', mime_type: msg.video.mime_type || 'video/mp4' });
  }
  if (msg.voice) {
    attachments.push({ type: 'voice', file_id: msg.voice.file_id, mime_type: 'audio/ogg' });
  }

  // Persistent reply keyboard shown to all clients
  var CLIENT_KEYBOARD = {
    keyboard: [
      [{ text: '📋 My Tickets' }, { text: '💬 Pool Chat' }]
    ],
    resize_keyboard: true,
    persistent: true
  };

  // Helper: call Telegram sendMessage (with optional reply_markup)
  async function sendTelegram(chat_id, message, reply_markup) {
    var payload = { chat_id: chat_id, text: message };
    if (reply_markup) payload.reply_markup = reply_markup;
    await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  // Helper: Supabase REST call
  async function supaFetch(path, method, body) {
    method = method || 'GET';
    var opts = {
      method: method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': (method === 'PATCH' || method === 'POST') ? 'return=representation' : ''
      }
    };
    if (body) opts.body = JSON.stringify(body);
    var r = await fetch(SUPABASE_URL + '/rest/v1/' + path, opts);
    if (!r.ok) {
      var err = await r.text();
      throw new Error('Supabase ' + method + ' ' + path + ' failed: ' + err);
    }
    var ct = r.headers.get('content-type') || '';
    if (ct.indexOf('application/json') !== -1) return r.json();
    return null;
  }

  // Case 1: /start CLIENT_ID — register client's Telegram chat
  var startMatch = text.match(/^\/start\s+(.+)$/);
  if (startMatch) {
    var clientId = startMatch[1].trim();
    var clients;
    try {
      clients = await supaFetch('clients?id=eq.' + encodeURIComponent(clientId) + '&select=id,name,telegram_chat_id');
    } catch (e) {
      console.error('Client lookup failed:', e.message);
      return res.status(200).json({ ok: true });
    }

    if (!clients || clients.length === 0) {
      await sendTelegram(chatId, "Sorry, that invite link doesn't match any client on file. Please ask your contact for a new link.");
      return res.status(200).json({ ok: true });
    }

    try {
      await supaFetch('clients?id=eq.' + encodeURIComponent(clientId), 'PATCH', {
        telegram_chat_id: chatId,
        telegram_username: username
      });
    } catch (e) {
      console.error('Failed to update client telegram_chat_id:', e.message);
      await sendTelegram(chatId, "Something went wrong linking your account. Please try again.");
      return res.status(200).json({ ok: true });
    }

    // Log the Telegram join as a system_log entry on the client's most recent open ticket
    try {
      var openTix = await supaFetch(
        'tickets?client=eq.' + encodeURIComponent(clientId) +
        '&status=neq.closed&order=id.desc&limit=1&select=id,comms'
      );
      if (openTix && openTix.length > 0) {
        var tk = openTix[0];
        var joinLegacyId = 'c' + Date.now();
        // Durable, race-free append (see appendTicketCommunication) —
        // replaces the old SELECT-comms/splice-in-JS/PATCH-whole-row
        // pattern used everywhere in this file.
        await L.appendTicketCommunication({
          ticketId: tk.id, clientId: clientId, senderType: 'system', senderId: 'system',
          direction: 'system', visibility: 'client_visible', messageType: 'system_log',
          body: (username ? '@' + username : (firstName || 'Client')) + ' joined via Telegram bot',
          idempotencyKey: 'tgjoin_' + tk.id + '_' + joinLegacyId,
          legacyCommId: joinLegacyId,
          createdBy: 'telegram-webhook',
        });
      }
    } catch (e) {
      console.error('Failed to log Telegram join:', e.message);
    }

    await sendTelegram(
      chatId,
      'Hello' + (firstName ? ' ' + firstName : '') + '! You\'re now connected to Meridian. Your team will message you here — you may hear from different team members, and each message will include their name so you always know who you\'re speaking with.\n\nUse the buttons below anytime to manage your conversation.',
      CLIENT_KEYBOARD
    );
    return res.status(200).json({ ok: true });
  }

  // Case 2: Regular message — find client by chat_id
  var clientsByChat;
  try {
    clientsByChat = await supaFetch('clients?telegram_chat_id=eq.' + chatId + '&select=id,name,telegram_active_ticket_id');
  } catch (e) {
    console.error('Client lookup by chat_id failed:', e.message);
    return res.status(200).json({ ok: true });
  }

  if (!clientsByChat || clientsByChat.length === 0) {
    return res.status(200).json({ ok: true });
  }

  var client = clientsByChat[0];
  var now = new Date();

  // /refresh — resend the keyboard (fixes cases where buttons disappear)
  if (text === '/refresh' || text === '/start') {
    await sendTelegram(chatId, '✅ Buttons refreshed! Use the buttons below to manage your conversation.', CLIENT_KEYBOARD);
    return res.status(200).json({ ok: true });
  }

  // --- Keyboard button handlers ---

  // 📋 My Tickets — show open tickets and let client pick one to discuss (ticket-thread mode)
  if (text === '📋 My Tickets') {
    var myTix;
    try {
      myTix = await supaFetch(
        'tickets?client=eq.' + encodeURIComponent(client.id) + '&status=neq.done&order=id.desc&select=id,title,status'
      );
    } catch (e) { myTix = []; }
    if (!myTix || myTix.length === 0) {
      await sendTelegram(chatId, 'You have no open tickets at the moment. Your team will be in touch.', CLIENT_KEYBOARD);
      return res.status(200).json({ ok: true });
    }
    // Clear any existing session before starting selection
    try { await supaFetch('telegram_sessions?chat_id=eq.' + chatId, 'DELETE'); } catch (e) {}
    if (myTix.length === 1) {
      // Only one ticket — auto-select it in ticket-thread mode
      try {
        await supaFetch('telegram_sessions', 'POST', {
          chat_id: chatId, selected_ticket_id: myTix[0].id,
          mode: 'ticket-thread', pending_selection: false,
          expires_at: new Date(Date.now() + 30 * 60000).toISOString()
        });
      } catch (e) {}
      await saveFallbackSelection(myTix[0].id, 'ticket-thread');
      var statusLabel0 = { new: 'New', inprogress: 'In Progress', review: 'Review', approved: 'Approved', blocked: 'Blocked' };
      await sendTelegram(chatId,
        '📋 Your ticket:\n\n1. #' + myTix[0].id + ' — ' + myTix[0].title + ' [' + (statusLabel0[myTix[0].status] || myTix[0].status) + ']\n\n✅ Switched to Ticket Chat — send your message now.',
        CLIENT_KEYBOARD);
      return res.status(200).json({ ok: true });
    }
    // Multiple tickets — show list and prompt selection
    var statusLabel = { new: 'New', inprogress: 'In Progress', review: 'Review', approved: 'Approved', blocked: 'Blocked' };
    var tixList = myTix.map(function(t, i) {
      return (i + 1) + '. #' + t.id + ' — ' + t.title + ' [' + (statusLabel[t.status] || t.status) + ']';
    }).join('\n');
    await sendTelegram(chatId, '📋 Your open tickets:\n\n' + tixList + '\n\nReply with a number to start chatting on that ticket.');
    try {
      await supaFetch('telegram_sessions', 'POST', {
        chat_id: chatId, pending_selection: true, mode: 'ticket-thread',
        expires_at: new Date(Date.now() + 5 * 60000).toISOString()
      });
    } catch (e) {}
    try { await supaFetch('clients?id=eq.' + encodeURIComponent(client.id), 'PATCH', { telegram_active_ticket_id: 'PENDING' }); } catch (e) {}
    return res.status(200).json({ ok: true });
  }

  // 💬 Pool Chat — switch current session to pool/general mode
  if (text === '💬 Pool Chat') {
    var poolTix;
    try {
      poolTix = await supaFetch(
        'tickets?client=eq.' + encodeURIComponent(client.id) + '&status=neq.done&order=id.desc&limit=1&select=id,title'
      );
    } catch (e) { poolTix = []; }
    var poolTicketId = poolTix && poolTix[0] ? poolTix[0].id : null;
    try {
      await supaFetch('telegram_sessions?chat_id=eq.' + chatId, 'DELETE');
    } catch (e) {}
    if (poolTicketId) {
      try {
        await supaFetch('telegram_sessions', 'POST', {
          chat_id: chatId, selected_ticket_id: poolTicketId,
          mode: 'pool', pending_selection: false,
          expires_at: new Date(Date.now() + 30 * 60000).toISOString()
        });
      } catch (e) {}
      await saveFallbackSelection(poolTicketId, 'pool');
    }
    await sendTelegram(chatId, '💬 Switched to Pool Chat — your messages will appear in the general Telegram channel on your ticket.', CLIENT_KEYBOARD);
    return res.status(200).json({ ok: true });
  }

  // --- Session-based routing ---

  // Helper: route a message to a specific ticket
  async function routeClientMessage(ticketId, commMode) {
    var ticketRows;
    try {
      ticketRows = await supaFetch('tickets?id=eq.' + encodeURIComponent(ticketId) + '&select=id,title,comms,owner,assignees,status');
    } catch (e) {
      console.error('Ticket lookup failed:', e.message);
      return;
    }
    if (!ticketRows || ticketRows.length === 0) return;
    var ticket = ticketRows[0];
    var tgLegacyId = 'tg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    var isThreadMode = (commMode || 'telegram-in') === 'ticket-thread-in';

    var commId;
    try {
      // Durable, race-free append (see appendTicketCommunication) — this is
      // the highest-traffic write in this file (every inbound client
      // Telegram message), and the exact class of "SELECT comms, splice in
      // JS, PATCH whole row" pattern that caused NVR-1279's history loss —
      // a client sending two messages in quick succession, or a staff send
      // landing in the same window, could previously overwrite one write
      // with the other.
      commId = await L.appendTicketCommunication({
        ticketId: ticket.id, clientId: client.id, senderType: 'client', senderId: 'telegram:' + chatId,
        direction: 'client_to_staff', visibility: 'client_visible',
        messageType: isThreadMode ? 'ticket_thread' : 'telegram',
        body: text, attachments: attachments,
        idempotencyKey: 'tgmsg_' + ticket.id + '_' + tgLegacyId,
        legacyCommId: tgLegacyId, createdBy: 'telegram-webhook',
        metadata: isThreadMode ? {} : { legacy_mode: commMode || 'telegram-in' },
      });
    } catch (e) {
      console.error('Failed to save incoming telegram message:', e.message);
      return;
    }

    // Collect team member IDs to notify (owner + assignees, deduplicated)
    var teamMemberIds = [];
    if (ticket.owner) teamMemberIds.push(ticket.owner);
    (ticket.assignees || []).forEach(function(aid) {
      if (aid && teamMemberIds.indexOf(aid) === -1) teamMemberIds.push(aid);
    });

    // Fetch team member emails by ID (ticket.owner and assignees store IDs, not emails)
    var teamMembers = [];
    if (teamMemberIds.length) {
      try {
        teamMembers = await supaFetch(
          'team_members?id=in.(' + teamMemberIds.join(',') + ')&select=id,name,email'
        ) || [];
      } catch (e) {
        console.error('team_members lookup failed:', e.message);
      }
    }

    var notifyEmails = [];
    var notifTitle = '\u2708 New message from ' + (client.name || 'Client');
    var notifBody = '#' + ticket.id + ' \u00b7 ' + (ticket.title || '') + '\n' + (text || '(attachment)').slice(0, 120);

    // Insert in-app notification for each team member and collect emails
    for (var ti = 0; ti < teamMembers.length; ti++) {
      var tmem = teamMembers[ti];
      if (!tmem.email) continue;
      try {
        await supaFetch('notifications', 'POST', {
          user_email: tmem.email,
          type: 'telegram-in',
          title: notifTitle,
          body: notifBody,
          ticket_id: ticket.id,
          ticket_title: ticket.title || '',
          triggered_by: 'client',
          comm_id: commId || null,
          read: false,
          created_at: new Date().toISOString()
        });
        if (notifyEmails.indexOf(tmem.email) === -1) notifyEmails.push(tmem.email);
      } catch (e) {
        console.error('Failed to create notification for', tmem.email, ':', e.message);
      }
    }

    // Detect @mentions — notify mentioned team members not already in owner/assignees
    var mentions = (text || '').match(/@(\w+)/g) || [];
    if (mentions.length) {
      var allTeamData;
      try { allTeamData = await supaFetch('team_members?select=id,name,email'); } catch (e) { allTeamData = []; }
      for (var mi = 0; mi < mentions.length; mi++) {
        var nm = mentions[mi].replace('@', '').toLowerCase();
        var mmem = (allTeamData || []).find(function(x) {
          return x.name.toLowerCase().startsWith(nm) ||
                 (x.email || '').split('@')[0].toLowerCase() === nm;
        });
        if (mmem && mmem.email && notifyEmails.indexOf(mmem.email) === -1) {
          try {
            await supaFetch('notifications', 'POST', {
              user_email: mmem.email,
              type: 'telegram-mention',
              title: (client.name || 'Client') + ' mentioned you',
              body: notifBody,
              ticket_id: ticket.id,
              ticket_title: ticket.title || '',
              triggered_by: 'client',
              read: false,
              created_at: new Date().toISOString()
            });
            notifyEmails.push(mmem.email);
          } catch (e) {}
        }
      }
    }

    // Send emails via Resend API directly (server-side, no Supabase DB Webhook needed)
    var resendKey = process.env.RESEND_API_KEY;
    if (resendKey && notifyEmails.length) {
      var clientName = client.name || 'Client';
      var ticketTitle = ticket.title || ('Ticket #' + ticket.id);
      var messageText = (text || '[media attachment]').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var appUrl = process.env.APP_URL || 'https://novara-desk.vercel.app';
      var isPoolChat = commMode === 'telegram-in';
      var emailSubject, emailHtml;
      if (isPoolChat) {
        // Pool Chat email template
        emailSubject = '\u2708 New message from ' + clientName + ' in Client Chat';
        emailHtml = '<div style="font-family:sans-serif;max-width:500px">' +
          '<h3 style="color:#FF5B04">New Client Chat message</h3>' +
          '<p><b>' + clientName + '</b> sent a message in <b>Client Chat</b>:</p>' +
          '<blockquote style="border-left:3px solid #FF5B04;padding:8px 16px;background:#fff8f5">' + messageText + '</blockquote>' +
          '<a href="' + appUrl + '#/client-chat" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#FF5B04;color:#fff;text-decoration:none;font-weight:700">Open Client Chat \u2192</a>' +
          '</div>';
      } else {
        // Ticket Chat email template
        emailSubject = '\u2708 New message from ' + clientName + ' \u2014 ' + ticketTitle;
        emailHtml = '<div style="font-family:sans-serif;max-width:500px">' +
          '<h3 style="color:#FF5B04">New Ticket Chat message</h3>' +
          '<p><b>' + clientName + '</b> sent a message on ticket <b>' + ticketTitle + '</b>:</p>' +
          '<blockquote style="border-left:3px solid #FF5B04;padding:8px 16px;background:#fff8f5">' + messageText + '</blockquote>' +
          '<a href="' + appUrl + '" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#FF5B04;color:#fff;text-decoration:none;font-weight:700">Open Meridian \u2192</a>' +
          '</div>';
      }
      for (var ei = 0; ei < notifyEmails.length; ei++) {
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + resendKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Meridian <operations@novaraconsult.co.uk>',
            reply_to: 'desk+reply@novaraconsult.co.uk',
            to: [notifyEmails[ei]],
            subject: emailSubject,
            html: emailHtml
          })
        }).catch(function(e) { console.warn('Resend email failed:', e.message); });
      }
    }

    // Forward to team comms group
    const COMMS_CHAT_ID = process.env.TELEGRAM_COMMS_CHAT_ID;
    if (COMMS_CHAT_ID) {
      var forwardText =
        '\uD83D\uDCE9 ' + client.name + ' says:\n' +
        (text ? '"' + text + '"\n\n' : '[media attachment]\n\n') +
        '\uD83C\uDFAB Ticket: ' + ticket.id +
        (username ? '\n\uD83D\uDC64 @' + username : '');
      try { await sendTelegram(COMMS_CHAT_ID, forwardText); } catch (e) {}
    }
  }

  // --- Session routing (uses telegram_sessions table if available, else falls back to clients.telegram_active_ticket_id) ---

  // 1. Try to load session from telegram_sessions table
  var session = null;
  var sessionsTableAvailable = true;
  try {
    var sessions = await supaFetch('telegram_sessions?chat_id=eq.' + chatId + '&select=*');
    session = sessions && sessions[0];
    // Expire stale sessions
    if (session && new Date(session.expires_at) < now) {
      try { await supaFetch('telegram_sessions?chat_id=eq.' + chatId, 'DELETE'); } catch (e) {}
      session = null;
    }
  } catch (e) {
    sessionsTableAvailable = false; // table doesn't exist yet — use fallback
  }

  // Helper: save/update session (no-op if table unavailable)
  async function saveSession(data) {
    if (!sessionsTableAvailable) return;
    try {
      if (session) {
        await supaFetch('telegram_sessions?chat_id=eq.' + chatId, 'PATCH', data);
      } else {
        await supaFetch('telegram_sessions', 'POST', Object.assign({ chat_id: chatId }, data));
      }
    } catch (e) {}
  }

  // Helper: save ticket selection to clients table as fallback (always available)
  // mode: 'ticket-thread' → saves as 'THREAD:id', 'pool' → saves as 'POOL:id'
  async function saveFallbackSelection(ticketId, mode) {
    var val = ticketId; // null or 'PENDING' passed as-is
    if (ticketId && ticketId !== 'PENDING') {
      val = (mode === 'ticket-thread' ? 'THREAD:' : 'POOL:') + ticketId;
    }
    try {
      await supaFetch('clients?id=eq.' + encodeURIComponent(client.id), 'PATCH', {
        telegram_active_ticket_id: val
      });
    } catch (e) {}
  }

  // 2. Get all open tickets for this client — safe columns only (telegram_thread_started fetched separately)
  var openTickets;
  try {
    openTickets = await supaFetch(
      'tickets?client=eq.' + encodeURIComponent(client.id) + '&status=neq.done&order=id.desc&select=id,title'
    );
  } catch (e) { openTickets = []; }

  if (!openTickets || openTickets.length === 0) {
    await sendTelegram(chatId, "We received your message, but there's no open ticket for your account right now. Your team will be in touch.");
    return res.status(200).json({ ok: true });
  }

  // 3. Check if client is in "pending selection" state
  var isPendingSelection = session
    ? session.pending_selection
    : client.telegram_active_ticket_id === 'PENDING';

  if (isPendingSelection) {
    var choice = parseInt(text.trim(), 10);
    // My Tickets flow stores mode:'ticket-thread' in the pending session — no "General message" option
    var isTicketChatPending = session && session.mode === 'ticket-thread';
    var selOptions = isTicketChatPending ? openTickets : openTickets.concat([{ id: '__pool__', title: 'General message' }]);
    var picked = selOptions[choice - 1];
    if (!picked || isNaN(choice)) {
      await sendTelegram(chatId, 'Please reply with a number from 1 to ' + selOptions.length);
      return res.status(200).json({ ok: true });
    }
    var selTicketId = picked.id === '__pool__' ? null : picked.id;
    var selMode = isTicketChatPending ? 'ticket-thread' : (picked.id === '__pool__' ? 'pool' : 'ticket-thread');
    var ttl30 = new Date(Date.now() + 30 * 60000).toISOString();
    await saveSession({ selected_ticket_id: selTicketId, mode: selMode, pending_selection: false, expires_at: ttl30 });
    // Fallback: store selected ticket ID in clients table with mode prefix
    await saveFallbackSelection(selTicketId || (openTickets[0] && openTickets[0].id), selMode);
    await sendTelegram(chatId, picked.id === '__pool__'
      ? 'Got it \u2014 sending as a general message. You can change this anytime with the buttons below.'
      : '✅ Got it \u2014 your messages will go to ticket #' + picked.id + ': ' + picked.title + '\n\nNow send your message.',
      CLIENT_KEYBOARD);
    return res.status(200).json({ ok: true });
  }

  // 4. Active session — route accordingly
  if (session && !session.pending_selection) {
    var routeTicketId = session.selected_ticket_id;
    var routeMode = session.mode === 'ticket-thread' ? 'ticket-thread-in' : 'telegram-in';
    if (!routeTicketId) {
      routeTicketId = openTickets[0] && openTickets[0].id;
      routeMode = 'telegram-in';
    }
    if (!routeTicketId) {
      await sendTelegram(chatId, "We received your message, but there's no open ticket right now. Your team will be in touch.");
      return res.status(200).json({ ok: true });
    }
    await saveSession({ expires_at: new Date(Date.now() + 30 * 60000).toISOString() });
    await routeClientMessage(routeTicketId, routeMode);
    return res.status(200).json({ ok: true });
  }

  // 5. Fallback routing using clients.telegram_active_ticket_id (prefix-encoded mode)
  if (!sessionsTableAvailable) {
    var activeId = client.telegram_active_ticket_id;
    if (activeId && activeId !== 'PENDING') {
      var fbMode = 'telegram-in';
      var fbTicketId = activeId;
      if (activeId.indexOf('THREAD:') === 0) { fbMode = 'ticket-thread-in'; fbTicketId = activeId.slice(7); }
      else if (activeId.indexOf('POOL:') === 0) { fbMode = 'telegram-in'; fbTicketId = activeId.slice(5); }
      var activeTix = openTickets.find(function(t) { return t.id === fbTicketId; });
      if (activeTix) {
        await routeClientMessage(activeTix.id, fbMode);
        return res.status(200).json({ ok: true });
      }
      // Ticket no longer open — reset and fall through to routing decision below
      await saveFallbackSelection(null);
    }
  }

  // 6. No session / no fallback state — decide routing
  if (openTickets.length === 1) {
    var solo = openTickets[0];
    await saveSession({ selected_ticket_id: solo.id, mode: 'ticket-thread', pending_selection: false, expires_at: new Date(Date.now() + 30 * 60000).toISOString() });
    await saveFallbackSelection(solo.id, 'ticket-thread');
    // First message to single ticket — confirm routing with keyboard
    await sendTelegram(chatId, 'Your message will go to ticket #' + solo.id + ' \u2014 ' + solo.title + '\n\nUse the buttons below to change ticket or switch modes anytime.', CLIENT_KEYBOARD);
    await routeClientMessage(solo.id, 'ticket-thread-in');
    return res.status(200).json({ ok: true });
  }

  // Multiple tickets — ask client which one
  var optList = openTickets.map(function(t, i) {
    return (i + 1) + '. #' + t.id + ' \u2014 ' + t.title;
  }).join('\n');
  await sendTelegram(chatId,
    'Which ticket are you replying about?\n\n' + optList + '\n' + (openTickets.length + 1) + '. General message\n\nReply with a number.',
    CLIENT_KEYBOARD
  );
  await saveSession({ pending_selection: true, expires_at: new Date(Date.now() + 5 * 60000).toISOString() });
  await saveFallbackSelection('PENDING');

  return res.status(200).json({ ok: true });
};
