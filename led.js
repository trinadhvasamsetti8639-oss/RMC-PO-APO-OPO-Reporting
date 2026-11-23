/* Full-screen LED display. window.LED = 'T' (team) or 'R' (reserve). */
let ME = null;
const T = LED === 'T', $ = id => document.getElementById(id), SLIDE_SEC = 120, POLL = 10000, PERS = T ? 25 : 50, COL = { g: '#22c55e', r: '#ef4444', y: '#facc15' };
let DATA = [], RES = [], ATT = {}, ASG = {}, ASR = {}, slide = 0, left = SLIDE_SEC, paused = false, off = false, timers = [];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cl = a => !a ? 'r' : a.status === 'Attended' ? 'g' : 'y';
const person = (c, b) => `<svg viewBox="0 0 24 24" fill="${COL[c]}"><circle cx="12" cy="7" r="4.5"/><path d="M3 22c0-5 4-8.5 9-8.5s9 3.5 9 8.5z"/>${b ? '<circle cx="19" cy="18" r="5.2" fill="#0a7a35" stroke="#fff" stroke-width="1.2"/><path d="M16.8 15.8l4.4 4.4M21.2 15.8l-4.4 4.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>' : ''}</svg>`;
const sc = ms => { let g = 0, y = 0; ms.forEach(a => { const c = cl(a); c === 'g' ? g++ : c === 'y' && y++ }); return { g, y, r: ms.length - g - y } };
document.title = (T ? 'Team' : 'Reserve') + ' Attendance – LED Display';
document.head.insertAdjacentHTML('beforeend', `<style>
*{box-sizing:border-box}body{margin:0;background:#0b1220;color:#e8ecf2;font-family:system-ui,sans-serif;height:100vh;overflow:hidden}
#lg{max-width:360px;margin:12vh auto;background:#151e2f;padding:20px;border-radius:12px}#lg input,#lg button{width:100%;padding:12px;margin-top:8px;font:inherit;border-radius:8px;border:1px solid #26334a;background:#0b1220;color:#fff}#lg button{background:#2563eb;border:0;font-weight:700;cursor:pointer}
#hd{display:flex;align-items:center;justify-content:space-between;gap:1vw;padding:1vh 1.5vw;height:11vh}#hd h1{font-size:3.4vh;margin:0}
.kp{display:flex;gap:2vw;align-items:center;font-size:2.2vh}.kp b{font-size:3.6vh}.kp i{display:inline-block;width:1.6vh;height:1.6vh;border-radius:50%;margin-right:.5vw}
#bar{height:.8vh;background:#2563eb;transition:width 1s linear}
#grid{height:86.5vh;padding:1vh 1vw;display:grid;gap:.8vh .6vw;grid-template-columns:repeat(${T ? 5 : 10},1fr);grid-template-rows:repeat(5,1fr)}
.tile{background:#151e2f;border:1px solid #26334a;border-radius:1vh;padding:.6vh .4vw;display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden;text-align:center}
.tile .th{font-weight:800;font-size:${T ? '2.6vh' : '1.6vh'};color:#93c5fd}.pp{display:flex;gap:.2vw;flex:1;min-height:0}.pp span{flex:1;display:flex;flex-direction:column;align-items:center;min-width:0;min-height:0}
.tile svg{flex:1;min-height:0;width:100%}.tile i{font-style:normal;color:#9aa6b8;font-size:${T ? '1.5vh' : '1.3vh'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.tile b{font-size:1.5vh;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
#ctl{display:flex;gap:6px;opacity:.35}#ctl:hover{opacity:1}#ctl button{background:#1e293b;color:#fff;border:0;border-radius:6px;padding:.8vh 1vw;cursor:pointer;font-size:1.8vh}
@media(max-width:900px){body{height:auto;overflow:auto}#hd{height:auto;flex-wrap:wrap}#grid{height:auto;grid-template-columns:repeat(${T ? 3 : 4},1fr);grid-template-rows:none}.tile{min-height:90px}.tile svg{max-height:60px}}
</style>`);
function showLogin(m) {
  document.body.innerHTML = `<div id="lg"><h2 style="margin-top:0">${T ? 'Team' : 'Reserve'} LED Display</h2><div style="color:#f87171">${esc(m || '')}</div><input id="lu" placeholder="Display user name"><input id="lp" type="password" placeholder="Password" onkeydown="event.key=='Enter'&&doLogin()"><button onclick="doLogin()">Start display</button><small style="color:#9aa6b8;display:block;margin-top:8px">Create a user with role "LED Display" in the Admin tab. Login is remembered on this device.</small></div>`;
}
async function doLogin() {
  const u = $('lu').value.trim(), p = $('lp').value;
  try { const r = await remote.login(u, p); if (!r) return showLogin('Invalid user name or password'); ME = { u, p, role: r.role, groups: r.groups || [] }; localStorage.setItem('ledcred', JSON.stringify({ u, p })); await go(); }
  catch (e) { showLogin(e.message); }
}
async function load() { const r = await remote.all(); ATT = {}; ASG = {}; ASR = {}; r.att.forEach(x => ATT[x.k] = x); r.asg.forEach(x => { ASG[x.group_no + '|' + x.role] = x; ASR[x.rid] = x }); }
async function go() {
  let t = null, r = null; try { t = await remote.dataGet('team'); r = await remote.dataGet('reserve'); } catch (e) {}
  DATA = t || await fetch('data.json').then(x => x.json()); RES = r || await fetch('reserve.json').then(x => x.json());
  if (ME.role === 'ro') DATA = DATA.filter(g => ME.groups.includes(g.g));
  await load();
  document.body.innerHTML = `<div id="hd"><h1>${T ? '🗳️ TEAM ATTENDANCE – LIVE' : '🗳️ RESERVE STAFF ATTENDANCE – LIVE'}</h1><div class="kp" id="kp"></div><div style="text-align:right"><div id="si" style="font-size:2.2vh"></div><div id="ctl"><button onclick="nextS(-1)">◀</button><button id="pb" onclick="togglePause()">❚❚</button><button onclick="nextS(1)">▶</button><button onclick="fs()">⛶</button><button onclick="logoutLed()">⎋</button></div></div></div><div id="bar"></div><div id="grid"></div>`;
  slide = 0; left = SLIDE_SEC; draw();
  timers.forEach(clearInterval);
  timers = [setInterval(tick, 1000), setInterval(async () => { try { await load(); off = false } catch (e) { off = true } draw() }, POLL)];
  try { navigator.wakeLock && navigator.wakeLock.request('screen'); } catch (e) {}
}
const fs = () => document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
const togglePause = () => { paused = !paused; $('pb').textContent = paused ? '▶' : '❚❚' };
function logoutLed() { localStorage.removeItem('ledcred'); location.reload(); }
function tick() { if (paused) return; left--; if (left <= 0) nextS(1); else bar(); }
function bar() { $('bar').style.width = (left / SLIDE_SEC * 100) + '%'; const m = Math.floor(left / 60), s = String(left % 60).padStart(2, '0'); $('cd').textContent = ' · next slide in ' + m + ':' + s; }
function nextS(d) { const n = Math.max(1, Math.ceil((T ? DATA : RES).length / PERS)); slide = (slide + d + n) % n; left = SLIDE_SEC; draw(); }
function draw() {
  const L = T ? DATA : RES, n = Math.max(1, Math.ceil(L.length / PERS)); if (slide >= n) slide = 0;
  const part = L.slice(slide * PERS, slide * PERS + PERS); let s;
  if (T) { s = { g: 0, y: 0, r: 0 }; DATA.forEach(x => { const t = sc(x.m.map(m => ATT['T' + m[1]])); s.g += t.g; s.y += t.y; s.r += t.r }); } else s = sc(RES.map(r => ATT['R' + r[0]]));
  const rng = part.length ? (T ? `PS ${part[0].g}–${part[part.length - 1].g}` : `S.No ${part[0][0]}–${part[part.length - 1][0]}`) : '';
  $('kp').innerHTML = `<span><i style="background:${COL.g}"></i>Present <b style="color:${COL.g}">${s.g}</b></span><span><i style="background:${COL.y}"></i>Reason <b style="color:${COL.y}">${s.y}</b></span><span><i style="background:${COL.r}"></i>Absent <b style="color:${COL.r}">${s.r}</b></span>${T ? '' : `<span><i style="background:#0a7a35"></i>✕ Assigned <b>${Object.keys(ASR).length}</b></span>`}`;
  $('si').innerHTML = `Slide ${slide + 1}/${n} · ${rng}<span id="cd"></span>${off ? ' <b style="color:#f87171">⚠ offline – showing last data</b>' : ''}`; bar();
  $('grid').innerHTML = T ? part.map(x => `<div class="tile"><span class="th">PS ${x.g}</span><div class="pp">${x.m.map(m => { const as = ASG[x.g + '|' + m[0]]; return `<span>${person(as ? 'g' : cl(ATT['T' + m[1]]), !!as)}<i>${m[0].replace('OPO', 'O')}${as ? '+R' : ''}</i></span>` }).join('')}</div></div>`).join('')
    : part.map(r => { const as = ASR[r[0]]; return `<div class="tile"><span class="th">#${r[0]}</span>${person(cl(ATT['R' + r[0]]), !!as)}<b>${esc(r[3])}</b><i>${r[8]}${as ? ' → PS ' + as.group_no : ''}</i></div>` }).join('');
}
document.addEventListener('keydown', e => { if (!ME) return; if (e.key === 'ArrowRight') nextS(1); else if (e.key === 'ArrowLeft') nextS(-1); else if (e.key === ' ') togglePause(); else if (e.key === 'f') fs(); });
document.addEventListener('dblclick', () => ME && fs());
(async () => { const sv = JSON.parse(localStorage.getItem('ledcred') || 'null'); if (!sv) return showLogin(); try { const r = await remote.login(sv.u, sv.p); if (!r) return showLogin('Saved login is no longer valid'); ME = { ...sv, role: r.role, groups: r.groups || [] }; await go(); } catch (e) { showLogin(e.message); } })();
