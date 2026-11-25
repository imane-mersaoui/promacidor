// Interface d'administration. Règle de sécurité : les données ne sont JAMAIS injectées avec innerHTML (textContent uniquement).
'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const STATUS = { nouveau: 'Nouveau', en_cours: 'En cours', retenu: 'Retenu', refuse: 'Refusé' };
  const ROLE = { admin: 'Administrateur', editeur: 'Éditeur', lecteur: 'Lecteur' };
  let csrf = '', me = null, page = 1, pages = 1, current = null, searchT;

  async function api(method, url, body) {
    const res = await fetch('api/' + url, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: { 'X-CSRF-Token': csrf, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && me) { me = null; show('login'); toast('Session expirée, reconnectez-vous.'); }
    const isJson = (res.headers.get('content-type') || '').includes('json');
    const data = isJson ? await res.json() : await res.blob();
    if (!res.ok) throw new Error((data && data.error) || 'Erreur ' + res.status);
    return data;
  }

  const el = (tag, props = {}, ...children) => {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => (k === 'class' ? (n.className = v) : k.startsWith('data-') ? n.setAttribute(k, v) : (n[k] = v)));
    children.flat().forEach(c => n.append(c instanceof Node ? c : document.createTextNode(c ?? '')));
    return n;
  };
  const fmtDate = d => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2800); };
  const busy = (btn, on) => { btn.disabled = on; };

  function show(view) {
    ['login', '2fa', 'app'].forEach(v => { $('#view-' + v).hidden = v !== view; });
    if (view === 'login') { $('#form-login').reset(); $('#login-email').focus(); }
    if (view === '2fa') { $('#totp').value = ''; $('#totp').focus(); }
  }

  function applyRole() {
    $$('[data-role]').forEach(n => { n.hidden = !n.dataset.role.split(' ').includes(me.role); });
    $('#who-name').textContent = me.name;
    $('#who-role').textContent = ROLE[me.role] || me.role;
  }

  // ── Connexion ──
  $('#form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter; busy(btn, true); $('#login-error').textContent = '';
    try {
      if (!csrf) csrf = (await api('GET', 'auth/csrf')).csrf;
      const r = await api('POST', 'auth/login', { email: $('#login-email').value.trim(), password: $('#login-password').value });
      csrf = r.csrf; show('2fa');
    } catch (err) { $('#login-error').textContent = err.message; $('#login-password').value = ''; }
    finally { busy(btn, false); }
  });

  $('#totp').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); if (e.target.value.length === 6) $('#form-2fa').requestSubmit(); });
  $('#form-2fa').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#form-2fa .btn-primary'); busy(btn, true); $('#totp-error').textContent = '';
    try {
      const r = await api('POST', 'auth/2fa', { code: $('#totp').value });
      csrf = r.csrf; me = r.user; startApp();
    } catch (err) {
      $('#totp-error').textContent = err.message; $('#totp').value = '';
      if (/reconnectez/i.test(err.message)) setTimeout(() => show('login'), 1500);
    } finally { busy(btn, false); }
  });
  $('#back-login').addEventListener('click', () => show('login'));

  $('#logout').addEventListener('click', async () => {
    try { await api('POST', 'auth/logout'); } catch { /* déjà déconnecté */ }
    me = null; csrf = ''; show('login');
  });

  // ── Onglets ──
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('is-on', x === t));
    ['leads', 'audit', 'account'].forEach(k => { $('#tab-' + k).hidden = k !== t.dataset.tab; });
    if (t.dataset.tab === 'audit') loadAudit();
  }));

  // ── Demandes ──
  async function loadStats() {
    const s = await api('GET', 'stats');
    const items = [['total', 'Total'], ['semaine', '7 derniers jours'], ['nouveau', 'Nouvelles'], ['en_cours', 'En cours'], ['retenu', 'Retenues'], ['refuse', 'Refusées']];
    $('#stats').replaceChildren(...items.map(([k, label]) => el('div', { class: 'stat s-' + k }, el('b', {}, String(s[k] ?? 0)), el('span', {}, label))));
  }

  const filters = () => {
    const p = new URLSearchParams();
    if ($('#q').value.trim()) p.set('q', $('#q').value.trim());
    if ($('#f-status').value) p.set('status', $('#f-status').value);
    return p;
  };

  async function loadLeads() {
    const p = filters(); p.set('page', page); p.set('pageSize', 20);
    const r = await api('GET', 'leads?' + p);
    pages = Math.max(1, Math.ceil(r.total / r.pageSize));
    $('#rows').replaceChildren(...r.items.map(l => {
      const tr = el('tr', { tabIndex: 0 },
        el('td', {}, fmtDate(l.created_at)),
        el('td', {}, el('strong', {}, l.societe), el('small', {}, l.fonction || '')),
        el('td', {}, l.nom, el('small', {}, l.email), el('small', {}, l.telephone)),
        el('td', {}, l.ville || '—', el('small', {}, l.pays)),
        el('td', {}, el('span', { class: 'badge b-' + l.status }, STATUS[l.status])),
        el('td', {}, '›'));
      tr.addEventListener('click', () => openLead(l.id));
      tr.addEventListener('keydown', e => { if (e.key === 'Enter') openLead(l.id); });
      return tr;
    }));
    $('#empty').hidden = r.items.length > 0;
    $('#page-info').textContent = `Page ${r.page} / ${pages} · ${r.total} demande${r.total > 1 ? 's' : ''}`;
    $('#prev').disabled = page <= 1; $('#next').disabled = page >= pages;
  }

  $('#q').addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(() => { page = 1; loadLeads().catch(err => toast(err.message)); }, 300); });
  $('#f-status').addEventListener('change', () => { page = 1; loadLeads().catch(err => toast(err.message)); });
  $('#prev').addEventListener('click', () => { if (page > 1) { page--; loadLeads(); } });
  $('#next').addEventListener('click', () => { if (page < pages) { page++; loadLeads(); } });

  $('#export').addEventListener('click', async e => {
    busy(e.target, true);
    try {
      const blob = await api('GET', 'leads/export.csv?' + filters());
      const a = el('a', { href: URL.createObjectURL(blob), download: `partenaires-${new Date().toISOString().slice(0, 10)}.csv` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err) { toast(err.message); } finally { busy(e.target, false); }
  });

  async function openLead(id) {
    try {
      const l = await api('GET', 'leads/' + id);
      current = l;
      $('#d-title').textContent = l.societe;
      const rows = [['Contact', l.nom], ['Fonction', l.fonction], ['E-mail', l.email], ['Téléphone', l.telephone], ['Pays', l.pays], ['Ville', l.ville],
        ['Catégories', l.categories], ['Points de vente', l.points_vente], ['Zones couvertes', l.zones], ['Reçue le', fmtDate(l.created_at)], ['Mise à jour', fmtDate(l.updated_at)]];
      $('#d-fields').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v == null || v === '' ? '—' : String(v))]));
      $('#d-status').value = l.status; $('#d-note').value = l.note || ''; $('#d-error').textContent = '';
      $('#drawer').showModal();
    } catch (err) { toast(err.message); }
  }

  $('#d-save').addEventListener('click', async e => {
    busy(e.target, true);
    try {
      await api('PATCH', 'leads/' + current.id, { status: $('#d-status').value, note: $('#d-note').value });
      $('#drawer').close(); toast('Demande mise à jour.'); refresh();
    } catch (err) { $('#d-error').textContent = err.message; } finally { busy(e.target, false); }
  });

  $('#d-delete').addEventListener('click', async e => {
    if (!confirm(`Supprimer définitivement la demande de « ${current.societe} » ? Cette action est irréversible.`)) return;
    busy(e.target, true);
    try { await api('DELETE', 'leads/' + current.id); $('#drawer').close(); toast('Demande supprimée.'); refresh(); }
    catch (err) { $('#d-error').textContent = err.message; } finally { busy(e.target, false); }
  });

  // ── Journal ──
  const ACTIONS = { 'login.success': 'Connexion', 'login.fail': 'Échec de connexion', 'login.2fa_fail': 'Code 2FA erroné', 'login.locked': 'Compte verrouillé', logout: 'Déconnexion',
    'lead.update': 'Demande modifiée', 'lead.delete': 'Demande supprimée', 'leads.export': 'Export CSV', 'password.change': 'Mot de passe changé', 'password.change_fail': 'Échec changement de mot de passe' };
  async function loadAudit() {
    try {
      const rows = await api('GET', 'audit');
      $('#audit-rows').replaceChildren(...rows.map(r => el('tr', {}, el('td', {}, fmtDate(r.created_at)), el('td', {}, r.user || '—'),
        el('td', {}, ACTIONS[r.action] || r.action), el('td', {}, r.target || '—'), el('td', {}, r.ip || '—'))));
    } catch (err) { toast(err.message); }
  }

  // ── Mon compte ──
  $('#form-pwd').addEventListener('submit', async e => {
    e.preventDefault(); const btn = e.submitter; busy(btn, true); $('#pwd-error').textContent = '';
    try {
      await api('POST', 'account/password', { current: $('#pwd-current').value, next: $('#pwd-next').value });
      me = null; toast('Mot de passe modifié. Reconnectez-vous.'); show('login');
    } catch (err) { $('#pwd-error').textContent = err.message; } finally { busy(btn, false); e.target.reset(); }
  });

  const refresh = () => Promise.all([loadStats(), loadLeads()]).catch(err => toast(err.message));
  function startApp() { applyRole(); show('app'); refresh(); }

  // Démarrage : session encore valide ?
  (async () => {
    try { const r = await api('GET', 'me'); csrf = r.csrf; me = r.user; startApp(); }
    catch { show('login'); }
  })();
})();
