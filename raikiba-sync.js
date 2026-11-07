/* RaiKiba cloud sync. Stores one copy of your data in your own Supabase project.
   Sync stays off until you sign in. Nothing here changes how the app saves. */
(function (root) {
  'use strict';
  const CFG = Object.assign({
    url: 'https://rogzuvlaoqjqhwnqoipk.supabase.co',
    key: 'sb_publishable_y0DB7IhtAvpHSGxtI3YKUA_MGAW0gTD',
    debounceMs: 4000
  }, root.RAIKIBA_SYNC_CONFIG || {});

  // Only these browser keys are synced. Photos, companion look and splash day stay on each device.
  const TRACKED = [
    'bloom-zen-v1', 'levelup-mealplan-v1', 'levelup-missions-v1', 'levelup-prizes-v1',
    'levelup-prize-preferences-v1', 'bloom-training-xp', 'levelup-appearance-routine-v1', 'lu-appearance-v2'
  ];
  const META_KEY = 'raikiba-sync-meta-v1';
  let applying = false, busy = false, queued = false, timer = null;
  const ui = { status: 'signedout', message: '', conflict: null, email: '', password: '', versions: null, working: false };
  const store = () => root.localStorage;

  function rand() { return Math.random().toString(36).slice(2, 10); }
  function readMeta() {
    let m = null;
    try { m = JSON.parse(store().getItem(META_KEY) || 'null'); } catch (e) { m = null; }
    m = m && typeof m === 'object' ? m : {};
    return Object.assign({ deviceId: rand(), deviceName: '', baseVersion: null, lastHash: null, lastSyncedAt: null, session: null }, m);
  }
  function writeMeta(m) { try { store().setItem(META_KEY, JSON.stringify(m)); } catch (e) { /* ignore */ } }
  let meta = readMeta();
  if (!meta.deviceName) {
    const ua = (root.navigator && root.navigator.userAgent) || '';
    meta.deviceName = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac|Windows|Linux/.test(ua) ? 'Computer' : 'Device';
    writeMeta(meta);
  }

  function snapshot() {
    const keys = {};
    for (const k of TRACKED) { let v = null; try { v = store().getItem(k); } catch (e) { v = null; } keys[k] = v; }
    return keys;
  }
  function hashOf(keys) {
    let h = 2166136261 >>> 0, len = 0;
    for (const k of TRACKED) {
      const s = k + '\u0000' + (keys[k] == null ? '\u0001' : keys[k]);
      len += s.length;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    }
    return h.toString(16) + ':' + len;
  }
  const hasData = keys => TRACKED.some(k => keys[k] != null);
  function envelope() { return { v: 1, savedAt: new Date().toISOString(), device: meta.deviceName, keys: snapshot() }; }

  // Watch writes to the tracked keys so changes are noticed without touching the app's own code.
  const proto = root.Storage && root.Storage.prototype;
  if (proto && !proto.__raikibaSync) {
    const set = proto.setItem, rem = proto.removeItem;
    proto.setItem = function (k) { const r = set.apply(this, arguments); if (this === root.localStorage && !applying && TRACKED.indexOf(k) >= 0) touch(); return r; };
    proto.removeItem = function (k) { const r = rem.apply(this, arguments); if (this === root.localStorage && !applying && TRACKED.indexOf(k) >= 0) touch(); return r; };
    proto.__raikibaSync = true;
  }
  function touch() {
    if (!meta.session) return;
    clearTimeout(timer);
    timer = setTimeout(() => { sync('change'); }, CFG.debounceMs);
  }

  function setStatus(status, message) { ui.status = status; ui.message = message || ''; mount(); }

  // Small safety copy of this device before cloud data replaces it (IndexedDB has more room than localStorage).
  function saveSafety(env) {
    return new Promise(resolve => {
      try {
        const req = root.indexedDB.open('raikiba-sync', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('safety');
        req.onerror = () => resolve(false);
        req.onsuccess = () => {
          try {
            const tx = req.result.transaction('safety', 'readwrite');
            tx.objectStore('safety').put({ at: new Date().toISOString(), env }, 'latest');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          } catch (e) { resolve(false); }
        };
      } catch (e) { resolve(false); }
    });
  }

  async function http(path, opts, authed) {
    opts = opts || {};
    const headers = Object.assign({ apikey: CFG.key, 'Content-Type': 'application/json' }, opts.headers || {});
    if (authed !== false && meta.session) headers.Authorization = 'Bearer ' + meta.session.access_token;
    else headers.Authorization = 'Bearer ' + CFG.key;
    const res = await root.fetch(CFG.url + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    return { ok: res.ok, status: res.status, json };
  }
  async function ensureToken() {
    const s = meta.session;
    if (!s) throw new Error('not signed in');
    if (s.expires_at - Date.now() / 1000 > 90) return;
    const r = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } }, false);
    if (!r.ok || !r.json || !r.json.access_token) {
      if (r.status === 400 || r.status === 401) { meta.session = null; writeMeta(meta); throw new Error('signed-out'); }
      throw new Error('auth-unavailable');
    }
    meta.session = { access_token: r.json.access_token, refresh_token: r.json.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (r.json.expires_in || 3600), email: s.email };
    writeMeta(meta);
  }
  async function getRow() {
    const r = await http('/rest/v1/saves?select=envelope,version,updated_at,updated_by');
    if (!r.ok) { const e = new Error('http-' + r.status); e.status = r.status; throw e; }
    return Array.isArray(r.json) && r.json.length ? r.json[0] : null;
  }
  async function pushTo(base, archive) {
    const env = envelope();
    const r = await http('/rest/v1/rpc/push_save', { method: 'POST', body: { p_envelope: env, p_base_version: base, p_device: meta.deviceName, p_archive: !!archive } });
    if (!r.ok) { const e = new Error('http-' + r.status); e.status = r.status; throw e; }
    if (r.json && r.json.ok) {
      meta.baseVersion = r.json.version; meta.lastHash = hashOf(env.keys); meta.lastSyncedAt = new Date().toISOString(); writeMeta(meta);
      return { ok: true };
    }
    return { ok: false, conflict: true };
  }
  async function applyEnvelope(env, version) {
    await saveSafety(envelope());
    applying = true;
    try {
      for (const k of TRACKED) {
        const v = env && env.keys ? env.keys[k] : null;
        if (v == null) store().removeItem(k); else store().setItem(k, v);
      }
    } finally { applying = false; }
    meta.baseVersion = version; meta.lastHash = hashOf(snapshot()); meta.lastSyncedAt = new Date().toISOString(); writeMeta(meta);
    try { root.sessionStorage.setItem('raikiba-sync-applied', String(version)); } catch (e) { /* ignore */ }
    setStatus('synced', 'Updated from your other device. Reloading.');
    if (root.location && typeof root.location.reload === 'function') root.location.reload();
  }

  async function sync(reason) {
    if (!meta.session) { setStatus('signedout'); return; }
    if (busy) { queued = true; return; }
    busy = true; setStatus('syncing');
    try {
      await ensureToken();
      const row = await getRow();
      const snap = snapshot(), h = hashOf(snap);
      const localChanged = h !== meta.lastHash;
      if (!row) {
        if (!hasData(snap)) { setStatus('synced'); }
        else { const r = await pushTo(null, false); setStatus(r.ok ? 'synced' : 'error', r.ok ? '' : 'Could not save the first copy.'); }
      } else {
        const s = row.version, b = meta.baseVersion;
        const remoteHash = hashOf(row.envelope && row.envelope.keys ? row.envelope.keys : {});
        if (b == null) {
          if (!hasData(snap)) await applyEnvelope(row.envelope, s);
          else if (h === remoteHash) { meta.baseVersion = s; meta.lastHash = h; meta.lastSyncedAt = new Date().toISOString(); writeMeta(meta); setStatus('synced'); }
          else { ui.conflict = { serverVersion: s, serverAt: row.updated_at, serverBy: row.updated_by, firstTime: true }; setStatus('conflict'); }
        } else if (s === b) {
          if (localChanged) {
            const r = await pushTo(b, false);
            if (r.ok) setStatus('synced'); else if (!(reason === 'retry')) { busy = false; return sync('retry'); } else setStatus('error', 'Could not save.');
          } else setStatus('synced');
        } else if (s > b) {
          if (!localChanged) await applyEnvelope(row.envelope, s);
          else { ui.conflict = { serverVersion: s, serverAt: row.updated_at, serverBy: row.updated_by }; setStatus('conflict'); }
        } else {
          ui.conflict = { serverVersion: s, serverAt: row.updated_at, serverBy: row.updated_by }; setStatus('conflict');
        }
      }
    } catch (e) {
      const offline = (root.navigator && root.navigator.onLine === false) || e instanceof TypeError;
      if (e.message === 'signed-out') setStatus('signedout', 'Please sign in again.');
      else if (offline) setStatus('offline', 'Saved on this device. It will sync when you are back online.');
      else if (e.status >= 500 || e.status === 404 || e.message === 'auth-unavailable') setStatus('paused', 'Sync is unavailable right now. Your data is safe on this device. If it stays like this, restore the project in your Supabase dashboard.');
      else setStatus('error', 'Sync hit a problem (' + e.message + '). Your data is safe on this device.');
    } finally {
      busy = false;
      if (queued) { queued = false; setTimeout(() => sync('queued'), 500); }
    }
  }

  async function useCloudCopy() {
    ui.working = true; mount();
    try { await ensureToken(); const row = await getRow(); ui.conflict = null; if (row) await applyEnvelope(row.envelope, row.version); } catch (e) { setStatus('error', 'Could not load the cloud copy.'); } finally { ui.working = false; }
  }
  async function keepThisCopy() {
    ui.working = true; mount();
    try {
      await ensureToken(); const row = await getRow();
      const r = await pushTo(row ? row.version : null, true);
      if (r.ok) { ui.conflict = null; setStatus('synced', 'Kept this device. The cloud copy was saved as a backup.'); } else setStatus('error', 'Could not save. Try again.');
    } catch (e) { setStatus('error', 'Could not save. Try again.'); } finally { ui.working = false; }
  }

  async function signIn(email, password) {
    email = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) { ui.message = 'Enter your email and password.'; mount(); return; }
    ui.working = true; ui.email = email; ui.message = ''; mount();
    try {
      const r = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }, false);
      if (r.ok && r.json && r.json.access_token) {
        meta.session = { access_token: r.json.access_token, refresh_token: r.json.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (r.json.expires_in || 3600), email };
        writeMeta(meta); ui.password = ''; ui.working = false; await sync('signin'); return;
      }
      ui.message = r.status === 429 ? 'Too many tries. Wait a few minutes.' : 'Email or password did not match.';
    } catch (e) { ui.message = 'No connection. Try again when you are online.'; }
    ui.working = false; mount();
  }
  async function signOut() {
    try { if (meta.session) await http('/auth/v1/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    meta.session = null; meta.baseVersion = null; meta.lastHash = null; meta.lastSyncedAt = null; writeMeta(meta);
    ui.conflict = null; ui.versions = null; setStatus('signedout');
  }
  async function loadVersions() {
    ui.working = true; mount();
    try {
      await ensureToken();
      const r = await http('/rest/v1/save_versions?select=id,version,updated_by,created_at&order=id.desc&limit=10');
      ui.versions = r.ok && Array.isArray(r.json) ? r.json : [];
    } catch (e) { ui.versions = []; }
    ui.working = false; mount();
  }
  async function restoreVersion(id) {
    ui.working = true; mount();
    try {
      await ensureToken();
      const v = await http('/rest/v1/save_versions?select=envelope&id=eq.' + encodeURIComponent(id));
      const row = await getRow();
      if (!v.ok || !v.json || !v.json[0]) throw new Error('missing');
      const env = v.json[0].envelope;
      const r = await http('/rest/v1/rpc/push_save', { method: 'POST', body: { p_envelope: env, p_base_version: row ? row.version : null, p_device: meta.deviceName, p_archive: true } });
      if (!r.ok || !r.json || !r.json.ok) throw new Error('push');
      ui.working = false; await applyEnvelope(env, r.json.version);
    } catch (e) { ui.working = false; setStatus('error', 'Could not restore that version.'); }
  }

  // ---- Settings card -------------------------------------------------------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function ago(iso) {
    if (!iso) return 'never';
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; if (m < 1440) return Math.round(m / 60) + ' h ago';
    return new Date(iso).toLocaleDateString();
  }
  const dot = c => '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + c + ';margin-right:7px"></span>';
  function cardHTML() {
    const w = ui.working ? 'disabled' : '';
    const field = 'style="margin:8px 0;width:100%;padding:12px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:9px"';
    let h = '<h2 style="margin:0 0 6px">Sync across devices</h2>';
    if (!meta.session) {
      h += '<p class="hint">Sign in once on each device. Only your RaiKiba data is stored, in your own Supabase project.</p>';
      h += '<label for="rkSyncEmail">Email</label><input id="rkSyncEmail" data-sync-field="email" type="email" autocomplete="username" value="' + esc(ui.email) + '" ' + field + '><label for="rkSyncPw">Password</label><input id="rkSyncPw" data-sync-field="password" type="password" autocomplete="current-password" value="' + esc(ui.password) + '" ' + field + '><button class="subtle-button" data-sync="signin" ' + w + '>Sign in</button>';
      if (ui.message) h += '<p class="hint" role="status">' + esc(ui.message) + '</p>';
      return h;
    }
    const col = { synced: '#9bbf9f', syncing: '#9bbf9f', offline: '#e0b36a', paused: '#e0b36a', error: '#d98a7a', conflict: '#e0b36a' }[ui.status] || '#9bbf9f';
    const label = { synced: 'Synced ' + ago(meta.lastSyncedAt), syncing: 'Syncing', offline: 'Not synced, offline', paused: 'Sync paused', error: 'Sync problem', conflict: 'Two copies differ', signedout: 'Signed out' }[ui.status] || 'Ready';
    h += '<p>' + dot(col) + '<strong>' + esc(label) + '</strong><span class="small"> · ' + esc(meta.session.email) + ' · this device: ' + esc(meta.deviceName) + '</span></p>';
    if (ui.message) h += '<p class="hint" role="status">' + esc(ui.message) + '</p>';
    if (ui.status === 'conflict' && ui.conflict) {
      const c = ui.conflict;
      h += '<div class="detail"><strong>' + (c.firstTime ? 'This device already has data' : 'A newer copy was saved on ' + esc(c.serverBy || 'another device')) + '</strong><p class="small">Cloud copy saved ' + esc(ago(c.serverAt)) + '. The copy you do not pick is kept as a backup, so nothing is lost.</p><div class="row" style="justify-content:start;flex-wrap:wrap"><button class="subtle-button" data-sync="usecloud" ' + w + '>Use the cloud copy</button><button class="subtle-button" data-sync="keepthis" ' + w + '>Keep this device</button></div></div>';
    }
    h += '<div class="row" style="justify-content:start;flex-wrap:wrap"><button class="subtle-button" data-sync="now" ' + w + '>Sync now</button><button class="subtle-button" data-sync="versions" ' + w + '>Backups</button><button class="subtle-button" data-sync="signout" ' + w + '>Sign out</button></div>';
    if (ui.versions) {
      h += '<p class="hint">Last ' + ui.versions.length + ' automatic backups (a new one is kept at most every 30 minutes).</p>';
      h += ui.versions.map(v => '<div class="item"><span class="grow">' + esc(new Date(v.created_at).toLocaleString()) + ' · ' + esc(v.updated_by || 'device') + '</span><button class="subtle-button" data-sync="restore" data-id="' + esc(v.id) + '" ' + w + '>Restore</button></div>').join('') || '<p class="hint">No backups yet.</p>';
    }
    return h;
  }
  let lastSig = '', raf = null;
  function mount() {
    if (!root.document) return;
    if (raf) return;
    const run = () => {
      raf = null;
      const el = root.document.getElementById('raikibaSyncCard');
      if (!el) { lastSig = ''; return; }
      const sig = JSON.stringify([ui.status, ui.message, ui.working, !!meta.session, meta.lastSyncedAt, ui.conflict, ui.versions]);
      const typing = root.document.activeElement && el.contains(root.document.activeElement) && root.document.activeElement.tagName === 'INPUT';
      if (sig === lastSig && el.firstChild) return;
      if (typing && el.firstChild) return;
      lastSig = sig; el.innerHTML = cardHTML();
    };
    raf = (root.requestAnimationFrame || (f => setTimeout(f, 16)))(run);
  }
  function wireUI() {
    const d = root.document;
    if (!d) return;
    d.addEventListener('input', e => {
      const f = e.target && e.target.getAttribute && e.target.getAttribute('data-sync-field');
      if (f === 'email') ui.email = e.target.value; else if (f === 'password') ui.password = e.target.value;
    });
    d.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-sync]');
      if (!b) return;
      const a = b.getAttribute('data-sync');
      if (a === 'signin') signIn(ui.email, ui.password);
      else if (a === 'now') sync('manual'); else if (a === 'signout') signOut();
      else if (a === 'usecloud') useCloudCopy(); else if (a === 'keepthis') keepThisCopy();
      else if (a === 'versions') loadVersions();
      else if (a === 'restore') { if (root.confirm('Restore this backup? Your current data is saved as a backup first.')) restoreVersion(b.getAttribute('data-id')); }
    });
    if (root.MutationObserver && d.body) new root.MutationObserver(mount).observe(d.body, { childList: true, subtree: true });
    mount();
  }

  function init() {
    if (root.addEventListener) {
      root.addEventListener('online', () => sync('online'));
      root.document && root.document.addEventListener('visibilitychange', () => { if (root.document.visibilityState === 'visible') sync('visible'); });
    }
    wireUI();
    if (meta.session) sync('open'); else setStatus('signedout');
  }

  root.RaiKibaSync = { init, sync, snapshot, hashOf, TRACKED, _state: () => ({ ui, meta }), _signIn: signIn, _useCloud: useCloudCopy, _keepThis: keepThisCopy, _versions: loadVersions, _restore: restoreVersion, _touch: touch };
  if (root.document && root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
