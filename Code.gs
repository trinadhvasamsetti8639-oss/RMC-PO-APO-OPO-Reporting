/**
 * Polling Duty Attendance - Google Sheets backend (Google Apps Script)
 * Paste into: your Google Sheet > Extensions > Apps Script.  Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone).  Sheets are created automatically on first use.
 * Default login created on first use: admin / admin123  (change it immediately).
 */
const H = {
  Users: ['username', 'pwd', 'role', 'groups'],
  Settings: ['key', 'value'],
  Attendance: ['k', 'kind', 'group_no', 'idno', 'role', 'status', 'lat', 'lng', 'marked_by', 'marked_at'],
  Assignments: ['group_no', 'role', 'rid', 'assigned_by', 'assigned_at'],
  Datasets: ['nm', 'idx', 'chunk'],
  Distribution: ['group_no', 'stage', 'by', 'time']
};
const ROLES = ['admin', 'user', 'ro', 'sec', 'dist', 'display'];
const STATUS = ['Attended', 'Leave', 'Health Issues', 'Duties Cancelled', 'Changed to Reserve'];
const WRITE = { saveSettings: 1, mark: 1, assign: 1, unassign: 1, distSet: 1, clear: 1, dataSave: 1, addU: 1, delU: 1 };

/* ---------- sheet helpers ---------- */
function sh(n) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(n);
  if (!s) {
    s = ss.insertSheet(n);
    s.appendRow(H[n]);
    s.setFrozenRows(1);
    if (n === 'Users') { s.getRange('A:A').setNumberFormat('@'); s.appendRow(['admin', hash('admin123'), 'admin', '[]']); }
    if (n === 'Settings') { s.appendRow(['enabled', false]); s.appendRow(['lat', '']); s.appendRow(['lng', '']); s.appendRow(['radius', 200]); }
  }
  return s;
}
function rows(n) { const s = sh(n), l = s.getLastRow(); return l < 2 ? [] : s.getRange(2, 1, l - 1, H[n].length).getValues(); }
function setRows(n, a) {
  const s = sh(n), l = s.getLastRow();
  if (l > 1) s.getRange(2, 1, l - 1, H[n].length).clearContent();
  if (a.length) s.getRange(2, 1, a.length, H[n].length).setValues(a);
}

/* ---------- passwords ---------- */
function hash(p, salt) {
  salt = salt || Utilities.getUuid().slice(0, 8);
  const h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + p).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
  return salt + ':' + h;
}
function auth(u, p) {
  const r = rows('Users').find(x => String(x[0]) === String(u));
  if (!r || hash(String(p || ''), String(r[1]).split(':')[0]) !== String(r[1])) return null;
  let g = []; try { g = JSON.parse(r[3] || '[]'); } catch (e) {}
  return { u: String(r[0]), role: r[2], groups: g };
}
const need = (me, list) => { if (list.indexOf(me.role) < 0) throw new Error('Not allowed for your role'); };

/* ---------- cache of the "all" payload (shared by every screen/user, cleared on any write) ---------- */
function cacheGet() {
  const c = CacheService.getScriptCache(), m = c.get('allN'); if (!m) return null;
  const ks = []; for (let i = 0; i < +m; i++) ks.push('all' + i);
  const o = c.getAll(ks); let s = '';
  for (let i = 0; i < +m; i++) { if (!o['all' + i]) return null; s += o['all' + i]; }
  return JSON.parse(s);
}
function cachePut(d) {
  const s = JSON.stringify(d), o = {}; let n = 0;
  for (let i = 0; i < s.length; i += 90000) o['all' + n++] = s.slice(i, i + 90000);
  o.allN = '' + n; CacheService.getScriptCache().putAll(o, 10);
}
const cacheClear = () => CacheService.getScriptCache().remove('allN');

/* ---------- readers ---------- */
const num = v => (v === '' || v == null) ? null : +v;
const attAll = () => rows('Attendance').map(r => ({ k: String(r[0]), kind: r[1], group_no: num(r[2]), idno: num(r[3]), role: r[4], status: r[5], lat: num(r[6]), lng: num(r[7]), marked_by: r[8], marked_at: +r[9] }));
const asgAll = () => rows('Assignments').map(r => ({ group_no: +r[0], role: r[1], rid: +r[2], assigned_by: r[3], assigned_at: +r[4] }));
const distAll = () => rows('Distribution').map(r => ({ group_no: +r[0], stage: +r[1], by: r[2], time: +r[3] }));
function getSettings() {
  const o = {}; rows('Settings').forEach(r => o[r[0]] = r[1]);
  return { enabled: o.enabled === true || o.enabled === 'TRUE', lat: num(o.lat), lng: num(o.lng), radius: +o.radius || 200 };
}
function hav(a, b, c, d) {
  const r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r, h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
}

/* ---------- web app entry ---------- */
function doGet() { return ContentService.createTextOutput('Attendance API is running'); }
function doPost(e) {
  let out;
  try { out = { data: handle(JSON.parse(e.postData.contents)) }; } catch (err) { out = { error: err.message }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function handle(a) {
  if (a.fn === 'login') { const x = auth(a.u, a.p); return x ? { role: x.role, groups: x.groups } : null; }
  const me = auth(a.u, a.p);
  if (!me) throw new Error('Invalid login');
  if (!WRITE[a.fn]) return route(a, me);
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return route(a, me); } finally { cacheClear(); lock.releaseLock(); }
}

function route(a, me) {
  switch (a.fn) {
    case 'settings': return getSettings();
    case 'all': {
      let f = cacheGet();
      if (!f) { f = { att: attAll(), asg: asgAll(), dist: distAll() }; cachePut(f); }
      if (me.role !== 'ro') return f;
      const ok = r => me.groups.indexOf(r.group_no) >= 0;
      return { att: f.att.filter(ok), asg: f.asg.filter(ok), dist: f.dist.filter(ok) };
    }
    case 'saveSettings': {
      need(me, ['admin']); const s = a.s;
      setRows('Settings', [['enabled', !!s.enabled], ['lat', s.lat == null ? '' : s.lat], ['lng', s.lng == null ? '' : s.lng], ['radius', s.radius || 200]]);
      return null;
    }
    case 'mark': {
      need(me, ['admin', 'user']); const x = a.x, st = getSettings();
      if (STATUS.indexOf(x.status) < 0) throw new Error('Invalid status');
      if (st.enabled && st.lat != null) {
        if (x.lat == null || x.lng == null) throw new Error('Location is required');
        const d = hav(st.lat, st.lng, x.lat, x.lng);
        if (d > st.radius) throw new Error('Outside allowed area (' + Math.round(d) + ' m away, limit ' + st.radius + ' m)');
      }
      const s = sh('Attendance'), l = s.getLastRow();
      const keys = l > 1 ? s.getRange(2, 1, l - 1, 1).getValues().map(r => String(r[0])) : [];
      const i = keys.indexOf(String(x.k));
      const row = [x.k, x.kind, x.group_no == null ? '' : x.group_no, x.idno, x.role, x.status, x.lat == null ? '' : x.lat, x.lng == null ? '' : x.lng, me.u, Date.now()];
      if (i >= 0) s.getRange(i + 2, 1, 1, row.length).setValues([row]); else s.appendRow(row);
      return null;
    }
    case 'assign': {
      need(me, ['admin', 'sec']);
      const att = attAll(), ra = att.find(r => r.k === 'R' + a.id);
      if (!ra || ra.status !== 'Attended') throw new Error('Reserve staff is not present - cannot be assigned');
      const sa = att.find(r => r.kind === 'T' && r.group_no === a.g && r.role === a.r);
      if (sa && sa.status === 'Attended') throw new Error('That team member is already present');
      let A = rows('Assignments');
      if (A.some(r => +r[2] === a.id && !(+r[0] === a.g && r[1] === a.r))) throw new Error('Reserve staff is already assigned to another team');
      A = A.filter(r => !(+r[0] === a.g && r[1] === a.r)); A.push([a.g, a.r, a.id, me.u, Date.now()]);
      setRows('Assignments', A); return null;
    }
    case 'unassign': need(me, ['admin', 'sec']); setRows('Assignments', rows('Assignments').filter(r => !(+r[0] === a.g && r[1] === a.r))); return null;
    case 'distSet': {
      need(me, ['admin', 'sec', 'dist']);
      let D = rows('Distribution'); const now = Date.now();
      a.st.forEach(n => {
        const i = D.findIndex(r => +r[0] === a.g && +r[1] === n);
        if (a.v && i < 0) D.push([a.g, n, me.u, now]);
        if (!a.v && i >= 0) D.splice(i, 1);
      });
      setRows('Distribution', D); return null;
    }
    case 'clear': {
      need(me, ['admin']);
      if (a.sc === 'dist') { setRows('Distribution', []); return null; }
      setRows('Attendance', rows('Attendance').filter(r => !(a.sc === 'all' || (a.sc === 'team' && r[1] === 'T') || (a.sc === 'reserve' && r[1] === 'R'))));
      setRows('Assignments', []); return null;
    }
    case 'dataGet': {
      const c = rows('Datasets').filter(r => r[0] === a.nm).sort((x, y) => x[1] - y[1]);
      return c.length ? JSON.parse(c.map(r => String(r[2]).slice(1)).join('')) : null;
    }
    case 'dataSave': {
      need(me, ['admin']);
      const s = JSON.stringify(a.body), D = rows('Datasets').filter(r => r[0] !== a.nm);
      for (let i = 0, n = 0; i < s.length; i += 45000) D.push([a.nm, n++, '~' + s.slice(i, i + 45000)]);   // '~' stops Sheets treating a chunk as a formula
      setRows('Datasets', D);
      if (a.wipe) { setRows('Attendance', []); setRows('Assignments', []); }
      return null;
    }
    case 'users': need(me, ['admin']); return rows('Users').map(r => { let g = []; try { g = JSON.parse(r[3] || '[]'); } catch (e) {} return { username: String(r[0]), role: r[2], groups: g }; });
    case 'addU': {
      need(me, ['admin']);
      const U = rows('Users'), i = U.findIndex(r => String(r[0]) === String(a.n)), role = ROLES.indexOf(a.r) >= 0 ? a.r : 'user', g = JSON.stringify(a.g || []);
      if (!a.n) throw new Error('User name required');
      if (a.np) { const row = [a.n, hash(String(a.np)), role, g]; if (i >= 0) U[i] = row; else U.push(row); }
      else { if (i < 0) throw new Error('A new user needs a password'); U[i][2] = role; U[i][3] = g; }
      setRows('Users', U); return null;
    }
    case 'delU': {
      need(me, ['admin']);
      if (String(a.n) === me.u) throw new Error('Cannot delete yourself');
      setRows('Users', rows('Users').filter(r => String(r[0]) !== String(a.n))); return null;
    }
  }
  throw new Error('Unknown request');
}
