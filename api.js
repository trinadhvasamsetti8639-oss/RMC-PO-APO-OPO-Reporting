/* Shared backend client: Google Sheets (Apps Script) or local demo mode. Loaded by index.html and the LED displays. */
const C = window.APP_CONFIG || {};
const dist = (a, b, c, d) => { const r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r, h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(h)) };
const remote = C.API_URL ? (() => {
  const call = async (fn, a = {}) => {
    let j;
    try { const r = await fetch(C.API_URL, { method: 'POST', body: JSON.stringify({ fn, u: ME && ME.u, p: ME && ME.p, ...a }) }); j = await r.json(); }
    catch (e) { throw new Error('Cannot reach the Google Sheets backend – check API_URL, deployment access and internet'); }
    if (j.error) throw new Error(j.error);
    return j.data;
  };
  return {
    login: (u, p) => call('login', { u, p }), settings: () => call('settings'), save: s => call('saveSettings', { s }), mark: x => call('mark', { x }),
    all: () => call('all'), assign: (g, r, id) => call('assign', { g, r, id }), unassign: (g, r) => call('unassign', { g, r }), distSet: (g, st, v) => call('distSet', { g, st, v }),
    clear: sc => call('clear', { sc }), dataGet: nm => call('dataGet', { nm }), dataSave: (nm, body, wipe) => call('dataSave', { nm, body, wipe }),
    users: () => call('users'), addU: (n, p, r, g) => call('addU', { n, np: p, r, g }), delU: n => call('delU', { n })
  };
})() : (() => {
  const ld = () => JSON.parse(localStorage.getItem('demo4') || '{"users":{"admin":["admin123","admin",[]],"user":["user123","user",[]],"ro":["ro123","ro",[1,2,3,4,5]],"sec":["sec123","sec",[]],"dist":["dist123","dist",[]],"display":["led123","display",[]]},"set":{"enabled":false,"radius":200},"att":{},"asg":[],"dist":[]}'),
    sv = d => localStorage.setItem('demo4', JSON.stringify(d)), ds = () => JSON.parse(localStorage.getItem('demoData') || '{}');
  const ro = (d, r) => ME.role !== 'ro' || ME.groups.includes(r.group_no);
  return {
    login: async (u, p) => { const x = ld().users[u]; return x && x[0] === p ? { role: x[1], groups: x[2] } : null },
    settings: async () => ld().set, save: async s => { const d = ld(); d.set = s; sv(d) },
    mark: async x => {
      if (!['admin', 'user'].includes(ME.role)) throw Error('Not allowed to capture attendance');
      const d = ld(), s = d.set;
      if (s.enabled && s.lat != null) { if (x.lat == null) throw Error('Location is required'); const m = dist(s.lat, s.lng, x.lat, x.lng); if (m > s.radius) throw Error(`Outside allowed area (${Math.round(m)} m away, limit ${s.radius} m)`) }
      d.att[x.k] = { ...x, marked_by: ME.u, marked_at: Date.now() }; sv(d)
    },
    all: async () => { const d = ld(); return { att: Object.values(d.att).filter(r => ro(d, r)), asg: d.asg.filter(r => ro(d, r)), dist: d.dist.filter(r => ro(d, r)) } },
    assign: async (g, r, id) => {
      if (!['admin', 'sec'].includes(ME.role)) throw Error('Only the Administrative Secretary can assign reserve staff');
      const d = ld(); if (d.att['R' + id]?.status !== 'Attended') throw Error('Reserve staff is not present - cannot be assigned');
      const t = Object.values(d.att).find(a => a.kind === 'T' && a.group_no === g && a.role === r); if (t?.status === 'Attended') throw Error('That team member is already present');
      if (d.asg.some(a => a.rid === id && !(a.group_no === g && a.role === r))) throw Error('Reserve staff is already assigned to another team');
      d.asg = d.asg.filter(a => !(a.group_no === g && a.role === r)); d.asg.push({ group_no: g, role: r, rid: id, assigned_by: ME.u, assigned_at: Date.now() }); sv(d)
    },
    unassign: async (g, r) => { const d = ld(); d.asg = d.asg.filter(a => !(a.group_no === g && a.role === r)); sv(d) },
    distSet: async (g, st, v) => { if (!['admin', 'sec', 'dist'].includes(ME.role)) throw Error('Not allowed'); const d = ld(); st.forEach(n => { d.dist = d.dist.filter(x => !(x.group_no === g && x.stage === n)); if (v) d.dist.push({ group_no: g, stage: n, by: ME.u, time: Date.now() }) }); sv(d) },
    clear: async sc => { const d = ld(); if (sc === 'dist') d.dist = []; else { Object.keys(d.att).forEach(k => { if (sc === 'all' || (sc === 'team' && d.att[k].kind === 'T') || (sc === 'reserve' && d.att[k].kind === 'R')) delete d.att[k] }); d.asg = [] } sv(d) },
    dataGet: async nm => ds()[nm] || null, dataSave: async (nm, body, w) => { const x = ds(); x[nm] = body; localStorage.setItem('demoData', JSON.stringify(x)); if (w) { const d = ld(); d.att = {}; d.asg = []; sv(d) } },
    users: async () => Object.entries(ld().users).map(([username, v]) => ({ username, role: v[1], groups: v[2] })),
    addU: async (n, p, r, g) => { const d = ld(), o = d.users[n]; if (!p && !o) throw Error('A new user needs a password'); d.users[n] = [p || o[0], r, g]; sv(d) },
    delU: async n => { const d = ld(); delete d.users[n]; sv(d) }
  };
})();
