// ============================================================
//  감귤 수송·콘테이너 통합 관리 — 메인 앱
//  Supabase 연동 버전
// ============================================================

const PER = 7;
const OT = ['노랑', '초록', '헌콘'];

// 상태
let farms = [], drivers = [], dispatches = [], picks = [];
let ownIns = [], ownOuts = [], nhfIns = [], nhfOuts = [], reports = [], harvests = [], vehicles = [];
let stock = { 노랑: { init: 500 }, 초록: { init: 300 }, 헌콘: { init: 200 } };
let stockEd = { 노랑: false, 초록: false, 헌콘: false };

let _msgTxt = '', _msgDrvTel = '';
let _editFarmId = null, _editDrvId = null, _editPickId = null;
let _XT = null, _XI = null;
let _dt = 'w', _dt2 = 'w', _ft = 'n';
let _dp = 1, _d2p = 1, _rp = 1;
let _repOpen = false;
let _pinHidden = {};
const foldSt = { 'own-tb': false, 'nhf-sum': false, 'nhf-tb': false };
const secSt = { alert: true, 'disp-dash': true, 'farm-dash': true, 'ext-dash': true, 'bk-dash': true };

// PIN 상태
let _loggedDrv = null, _pinBuf = '', _pinMode = 'drv';

// ── 로딩 UI
function showLoading(msg = '불러오는 중...') {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,.85);z-index:999;display:flex;align-items:center;justify-content:center;font-size:16px;color:#C05800;gap:10px';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span style="font-size:24px">🍊</span> ${msg}`;
  el.style.display = 'flex';
}
function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'none';
}

// ── 앱 초기화
async function initApp() {
  showLoading('데이터 불러오는 중...');
  
// 저장된 관리자 PIN 불러오기
const savedAdmPin = localStorage.getItem('citrus_adm_pin');
if (savedAdmPin) window.ADM_PIN = savedAdmPin;
  
  // stock은 loadAllData 안에서 가져옴  

  try {
    const data = await loadAllData();
farms = data.farms;
drivers = data.drivers;
dispatches = data.dispatches;
picks = data.picks;
ownIns = data.ownIns;
ownOuts = data.ownOuts;
nhfIns = data.nhfIns;
nhfOuts = data.nhfOuts;
reports = data.reports;
stock = data.stockData;
harvests = data.harvests || [];
vehicles = data.vehicles || [];
  } catch (e) {
    console.error('데이터 로드 실패:', e);
    alert('⚠ 데이터를 불러오지 못했습니다.\n\nsupabase-client.js에서 URL과 API 키를 확인해 주세요.\n\n' + e.message);
  }

  setDates();
  popSels();
  renderAll();
  
  // 새로고침 후 로그인 상태 복원
  const savedRole = sessionStorage.getItem('citrus_role');
  const savedDrvName = sessionStorage.getItem('citrus_drv');
  
if (savedRole === 'admin') {
    document.getElementById('pin-screen').style.display = 'none';
    document.getElementById('hdr-btns').style.display = 'flex';
    document.getElementById('hdr-logged').style.display = 'none';
    document.getElementById('rbtn-logout').style.display = '';
    setRole('admin');
  } else if (savedRole === 'driver' && savedDrvName) {
    const drv = drivers.find(d => d.name === savedDrvName);
    if (drv && drv.pin_active !== false) {
      _loggedDrv = drv;
      document.getElementById('hdr-btns').style.display = 'none';
      document.getElementById('hdr-logged').style.display = 'flex';
      document.getElementById('logged-name').textContent = drv.name + ' 기사님 👋';
      document.getElementById('anav').style.display = 'none';
      document.getElementById('dnav').style.display = 'flex';
      document.querySelectorAll('.panel').forEach(p => { p.classList.remove('active'); });
      document.getElementById('p-dmy').style.display = '';
      document.getElementById('p-drep').style.display = '';
      DT('dmy');
      const wel = document.getElementById('drv-welcome');
      if (wel) wel.innerHTML = `안녕하세요 <strong>${esc(drv.name)}</strong> 기사님! 🍊<br><span style="font-size:12px;color:#888">${drv.type} · ${esc(drv.car || '차량 미등록')}</span>`;
      renderMyAssign(); renderMyPending();
    } else {
      document.getElementById('pin-screen').style.display = 'flex';
    }
 } else {
    // 기사 목록 채우고 PIN 화면 표시
    const sel = document.getElementById('pin-sel');
    sel.innerHTML = '<option value="">-- 기사를 선택하세요 --</option>';
    drivers.filter(d => d.pin_active !== false).forEach(d => {
      sel.innerHTML += `<option value="${esc(d.name)}">${esc(d.name)} (${d.type})</option>`;
    });
    document.getElementById('pin-screen').style.display = 'flex';
  }
  hideLoading();
}

// ── PIN 시스템
function showPin() {
  _pinBuf = ''; updDots();
  const sel = document.getElementById('pin-sel');
  sel.innerHTML = '<option value="">-- 기사를 선택하세요 --</option>';
  drivers.filter(d => d.pin_active !== false).forEach(d => {
    sel.innerHTML += `<option value="${esc(d.name)}">${esc(d.name)} (${d.type})</option>`;
  });
  document.getElementById('pin-error').style.display = 'none';
  setPinMode('drv');
  document.getElementById('pin-screen').style.display = 'flex';
}

function setPinMode(m) {
  _pinMode = m; _pinBuf = ''; updDots();
  document.getElementById('ptab-drv').className = 'pin-mode-tab' + (m === 'drv' ? ' active' : '');
  document.getElementById('ptab-adm').className = 'pin-mode-tab' + (m === 'adm' ? ' active' : '');
  document.getElementById('pin-drv-sec').style.display = m === 'drv' ? '' : 'none';
  document.getElementById('pin-adm-sec').style.display = m === 'adm' ? '' : 'none';
}

function pinReset() { _pinBuf = ''; updDots(); document.getElementById('pin-error').style.display = 'none'; }

function pinKey(k) {
  if (_pinMode === 'adm') return;
  if (!document.getElementById('pin-sel').value) { alert('기사를 먼저 선택해 주세요'); return; }
  if (_pinBuf.length >= 4) return;
  _pinBuf += k; updDots();
  if (_pinBuf.length === 4) setTimeout(checkPin, 120);
}

function pinDel() { _pinBuf = _pinBuf.slice(0, -1); updDots(); }

function updDots() {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('pd' + i);
    if (el) el.className = 'pin-dot' + (i < _pinBuf.length ? ' on' : '');
  }
}

function checkPin() {
  const name = document.getElementById('pin-sel').value;
  const drv = drivers.find(d => d.name === name);
  if (!drv || drv.pin_active === false) { pinErr('❌ 비활성화된 계정입니다.'); return; }
  if (drv.pin === _pinBuf) {
    _loggedDrv = drv;
    sessionStorage.setItem('citrus_role', 'driver');
    sessionStorage.setItem('citrus_drv', drv.name);
    document.getElementById('pin-screen').style.display = 'none';
    document.getElementById('hdr-btns').style.display = 'none';
    document.getElementById('hdr-logged').style.display = 'flex';
    document.getElementById('logged-name').textContent = drv.name + ' 기사님 👋';
    document.getElementById('anav').style.display = 'none';
    document.getElementById('dnav').style.display = 'flex';
    document.querySelectorAll('.panel').forEach(p => { p.classList.remove('active'); });
    document.getElementById('p-dmy').style.display = '';
    document.getElementById('p-drep').style.display = '';
    DT('dmy');
    const wel = document.getElementById('drv-welcome');
    if (wel) wel.innerHTML = `안녕하세요 <strong>${esc(drv.name)}</strong> 기사님! 🍊<br><span style="font-size:12px;color:#888">${drv.type} · ${esc(drv.car || '차량 미등록')}</span>`;
    const rf = document.getElementById('rp-farm');
    if (rf) { rf.innerHTML = '<option value="">선택</option>'; farms.forEach(f => rf.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`); }
  renderMyAssign(); renderMyPending();
    const myReports = reports.filter(r => r.driver === drv.name);
    const repCnt = document.getElementById('rep-cnt');
    if (repCnt) repCnt.textContent = myReports.length + '건';
  } else {
    pinErr('❌ PIN이 맞지 않습니다.');
  }
}

function pinErr(msg) {
  _pinBuf = ''; updDots();
  const el = document.getElementById('pin-error');
  el.textContent = msg; el.style.display = '';
  setTimeout(() => el.style.display = 'none', 2500);
}

function chkAdmPin() {
  const v = document.getElementById('adm-pin-in').value;
  const currentPin = localStorage.getItem('citrus_adm_pin') || ADM_PIN;
  if (v === currentPin) {
    sessionStorage.setItem('citrus_role', 'admin');
    document.getElementById('pin-screen').style.display = 'none';
    setRole('admin');
    document.getElementById('adm-pin-in').value = '';
    document.getElementById('adm-err').style.display = 'none';
  } else {
    document.getElementById('adm-err').style.display = '';
    document.getElementById('adm-pin-in').value = '';
    setTimeout(() => document.getElementById('adm-err').style.display = 'none', 2000);
  }
}

function doLogout() {
  sessionStorage.removeItem('citrus_role');
  sessionStorage.removeItem('citrus_drv');
  _loggedDrv = null;
  document.getElementById('hdr-btns').style.display = 'flex';
  document.getElementById('hdr-logged').style.display = 'none';
  document.getElementById('anav').style.display = 'flex';
  document.getElementById('dnav').style.display = 'none';
  document.querySelectorAll('.panel').forEach(p => { p.classList.remove('active'); p.style.display = ''; });
  document.getElementById('anav').style.display = 'none';
  document.getElementById('pin-screen').style.display = 'flex';
setPinMode('drv');
}

function gotoAdmin() {
  document.getElementById('rbtn-adm').className = 'rbtn active';
  document.getElementById('hdr-btns').style.display = 'flex';
  document.getElementById('hdr-logged').style.display = 'none';
  setRole('admin');
}
function adminLogout() {
  sessionStorage.removeItem('citrus_role');
  sessionStorage.removeItem('citrus_drv');
  document.getElementById('pin-screen').style.display = 'flex';
  document.getElementById('rbtn-logout').style.display = 'none';
  document.getElementById('rbtn-adm').className = 'rbtn active';
  setPinMode('adm');
}

// ── PIN 관리
function genPin() { return String(Math.floor(1000 + Math.random() * 9000)); }

async function regenPin(id) {
  if (!confirm('PIN을 새로 발급할까요?\n기사에게 새 PIN을 전달해야 합니다.')) return;
  const np = genPin();
  try {
    await dbUpdateDriver(id, { pin: np });
    drivers = drivers.map(d => d.id === id ? { ...d, pin: np } : d);
    _pinHidden[id] = false;
    renderDrivers();
    alert(`새 PIN이 발급되었습니다!\n\n📌 PIN: ${np}\n\n기사에게 전달해 주세요.`);
  } catch (e) { alert('오류: ' + e.message); }
}

function togglePinVis(id) { _pinHidden[id] = !_pinHidden[id]; renderDrivers(); }

async function togglePinActive(id) {
  const drv = drivers.find(d => d.id === id);
  if (!drv) return;
  const newState = !drv.pin_active;
  if (!newState && !confirm(`${drv.name} 기사의 접속을 차단할까요?\n차단하면 즉시 로그인 불가 상태가 됩니다.`)) return;
  try {
    await dbUpdateDriver(id, { pin_active: newState });
    drivers = drivers.map(d => d.id === id ? { ...d, pin_active: newState } : d);
    renderDrivers();
  } catch (e) { alert('오류: ' + e.message); }
}

// ── 토글
function togS(k) {
  secSt[k] = !secSt[k]; const e = secSt[k];
  const det = document.getElementById(k === 'alert' ? 'alert-detail' : k + '-detail');
  const sum = document.getElementById(k === 'alert' ? 'alert-summary' : k + '-summary');
  const txt = document.getElementById(k === 'alert' ? 'alert-txt' : k + '-txt');
  if (det) det.style.display = e ? '' : 'none';
  if (sum) sum.style.display = e ? 'none' : '';
  if (txt) txt.textContent = e ? '간략히' : '자세히';
}

function togF(k) {
  foldSt[k] = !foldSt[k]; const o = foldSt[k];
  const w = document.getElementById(k + '-wrap');
  const ic = document.getElementById(k + '-icon');
  if (w) w.style.display = o ? '' : 'none';
  if (ic) ic.textContent = o ? '▲ 접기' : '▼ 자세히';
}

function togRepH() {
  _repOpen = !_repOpen;
  document.getElementById('rep-history').style.display = _repOpen ? '' : 'none';
  document.getElementById('rep-h-icon').textContent = _repOpen ? '▲ 접기' : '▼ 자세히';
  renderRep();
}

function switchMsgTab(t) {
  document.getElementById('msgtab-c').className = 'msg-tab' + (t === 'c' ? ' active' : '');
  document.getElementById('msgtab-s').className = 'msg-tab' + (t === 's' ? ' active' : '');
  document.getElementById('msgtab-c-panel').style.display = t === 'c' ? '' : 'none';
  document.getElementById('msgtab-s-panel').style.display = t === 's' ? '' : 'none';
}

// ── 재고
function getSt(t) {
  const init = stock[t]?.init || 0;
  const out = dispatches.filter(d => d.ctype === t).reduce((s, d) => s + d.qty, 0);
  return { init, out, remain: init - out };
}

function renderSC() {
  const el = document.getElementById('stock-cards');
  const cc = { 노랑: 'yellow', 초록: 'green', 헌콘: 'old' };
  const ic = { 노랑: '🟡', 초록: '🟢', 헌콘: '⬜' };
  el.innerHTML = OT.map(t => {
    const st = getSt(t);
    const p = st.init > 0 ? st.remain / st.init : 1;
    const rc = p > 0.3 ? 'sok' : p > 0.1 ? 'swarn' : 'sdanger';
    const ed = stockEd[t];
    return `<div class="stock-card ${cc[t]}">
      <div style="font-size:20px;margin-bottom:4px">${ic[t]}</div>
      <div style="font-size:12px;color:#888;margin-bottom:6px;font-weight:500">${t} 콘테이너</div>
      <div class="stock-nums">
        <div class="stock-num-box"><div class="stock-num">${st.init.toLocaleString()}</div><div class="stock-sub">초기재고</div></div>
        <div class="stock-divider"></div>
        <div class="stock-num-box"><div class="stock-num out">-${st.out.toLocaleString()}</div><div class="stock-sub">배출</div></div>
        <div class="stock-divider"></div>
        <div class="stock-num-box"><div class="stock-num remain ${rc}">${st.remain.toLocaleString()}</div><div class="stock-sub">잔여</div></div>
      </div>
      <div class="stock-edit-area">
        ${ed
          ? `<div class="stock-input-row" style="display:flex"><input type="number" id="si-${t}" value="${st.init}" min="0"><button class="ssave" onclick="saveStock('${t}')">저장</button><button class="scancel" onclick="cancelStock('${t}')">취소</button></div>`
          : `<div class="stock-display"><span>초기 <span class="val">${st.init.toLocaleString()}개</span></span><button class="sedit" onclick="editStock('${t}')">✏️ 수정</button></div>`
        }
      </div>
    </div>`;
  }).join('');
}

function editStock(t) { stockEd[t] = true; renderSC(); }
function cancelStock(t) { stockEd[t] = false; renderSC(); }
function saveStock(t) {
  const v = parseInt(document.getElementById('si-' + t)?.value) || 0;
  stock[t] = { init: v };
  stockEd[t] = false;
  saveStockSettings(stock);
  renderSC(); chkStW();
}

function chkStW() {
  const c = gv('dp-ctype'), q = parseInt(document.getElementById('dp-qty')?.value) || 0;
  const w = document.getElementById('dp-stw');
  if (!w) return;
  if (OT.includes(c) && q > 0) {
    const st = getSt(c);
    if (q > st.remain) { w.style.display = ''; w.textContent = `⚠ ${c} 잔여 재고 ${st.remain}개보다 ${q - st.remain}개 많습니다. 그래도 등록 가능.`; }
    else w.style.display = 'none';
  } else w.style.display = 'none';
}

// ── 네비
function setRole(r) {
  document.getElementById('anav').style.display = r === 'admin' ? 'flex' : 'none';
  document.getElementById('dnav').style.display = r === 'driver' ? 'flex' : 'none';
  document.querySelectorAll('.panel').forEach(p => { p.classList.remove('active'); p.style.display = ''; });
  if (r === 'admin') {
  document.getElementById('rbtn-adm').className = 'rbtn active';
  document.getElementById('rbtn-logout').style.display = '';
  T('dash');
}}

function T(id) {
  document.querySelectorAll('#anav .nbtn').forEach((b, i) => b.classList.toggle('active', ['dash', 'disp', 'ext', 'cal', 'dboard', 'farm', 'drv', 'stats', 'export'][i] === id));
  ['dash', 'disp', 'ext', 'cal', 'dboard', 'farm', 'drv', 'stats', 'export'].forEach(p => {
    const el = document.getElementById('p-' + p); if (el) el.classList.remove('active');
  });
  const el = document.getElementById('p-' + id); if (el) el.classList.add('active');
  if (id === 'dash') renderDash();
  if (id === 'cal') renderCal();
  if (id === 'drv') renderAdmPinChange();
  if (id === 'stats') renderStats();
  if (id === 'dboard') { if (_dbView === 'sched') renderDSchedule(); else renderDBoard(); }
  if (id === 'export') {
    const t = new Date().toISOString().slice(0, 10);
    const fd = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const ef = document.getElementById('exp-from');
    const et = document.getElementById('exp-to');
    if (ef && !ef.value) ef.value = fd;
    if (et && !et.value) et.value = t;
  }
}
function DT(id) {
  document.querySelectorAll('#dnav .nbtn').forEach((b, i) => b.classList.toggle('active', ['dmy', 'drep'][i] === id));
  ['dmy', 'drep'].forEach(p => { const el = document.getElementById('p-' + p); if (el) el.classList.remove('active'); });
  const el = document.getElementById('p-' + id); if (el) el.classList.add('active');
}

function extTab(t) {
  document.getElementById('ext-f-div').style.display = t === 'f' ? '' : 'none';
  document.getElementById('ext-n-div').style.display = t === 'n' ? '' : 'none';
  document.getElementById('ext-b-div').style.display = t === 'b' ? '' : 'none';
  document.getElementById('et-f').className = 'etab' + (t === 'f' ? ' af' : '');
  document.getElementById('et-n').className = 'etab' + (t === 'n' ? ' an' : '');
  document.getElementById('et-b').className = 'etab' + (t === 'b' ? ' af' : '');
}
function ownTab(t) {
  document.getElementById('ot-i').className = 'etab' + (t === 'i' ? ' af' : '');
  document.getElementById('ot-o').className = 'etab' + (t === 'o' ? ' af' : '');
  document.getElementById('own-in').style.display = t === 'i' ? '' : 'none';
  document.getElementById('own-out').style.display = t === 'o' ? '' : 'none';
}
function nhfTab(t) {
  document.getElementById('nt-i').className = 'etab' + (t === 'i' ? ' an' : '');
  document.getElementById('nt-o').className = 'etab' + (t === 'o' ? ' an' : '');
  document.getElementById('nhf-in').style.display = t === 'i' ? '' : 'none';
  document.getElementById('nhf-out').style.display = t === 'o' ? '' : 'none';
}
function switchPT(t) {
  document.getElementById('pt-disp-sec').style.display = t === 'disp' ? '' : 'none';
  document.getElementById('pt-pick-sec').style.display = t === 'pick' ? '' : 'none';
  document.getElementById('ptab-disp').className = 'dtab' + (t === 'disp' ? ' active' : '');
  document.getElementById('ptab-pick').className = 'dtab' + (t === 'pick' ? ' active' : '');
  if (t === 'pick') renderPick();
}
function switchDT(t) { _dt = t; _dp = 1; document.getElementById('dtab-w').className = 'dtab' + (t === 'w' ? ' active' : ''); document.getElementById('dtab-d').className = 'dtab' + (t === 'd' ? ' active' : ''); renderDDash(); }
function switchDT2(t) { _dt2 = t; _d2p = 1; document.getElementById('dtab2-w').className = 'dtab' + (t === 'w' ? ' active' : ''); document.getElementById('dtab2-d').className = 'dtab' + (t === 'd' ? ' active' : ''); renderDisp(); }
function switchFT(t) { _ft = t; document.getElementById('ftab-n').className = 'dtab' + (t === 'n' ? ' active' : ''); document.getElementById('ftab-o').className = 'dtab' + (t === 'o' ? ' active' : ''); renderFarmTbl(); }
function selCt(v) { document.getElementById('dp-ctype').value = v; document.querySelectorAll('.ctype-btn').forEach(b => b.classList.toggle('sel', b.textContent.includes(v))); chkStW(); }

function mkPg(cid, total, cur, fn) {
  const pages = Math.ceil(total / PER) || 1;
  const el = document.getElementById(cid);
  if (pages <= 1) { el.innerHTML = ''; return; }
  let h = `<span>${total}건 · ${Math.min((cur - 1) * PER + 1, total)}~${Math.min(cur * PER, total)}</span><div class="pg-btns">`;
  h += `<button class="pg-btn" onclick="${fn}(${cur - 1})" ${cur === 1 ? 'disabled' : ''}>◀</button>`;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - cur) <= 1) h += `<button class="pg-btn ${i === cur ? 'cur' : ''}" onclick="${fn}(${i})">${i}</button>`;
    else if (Math.abs(i - cur) === 2) h += `<span style="padding:0 4px">…</span>`;
  }
  h += `<button class="pg-btn" onclick="${fn}(${cur + 1})" ${cur === pages ? 'disabled' : ''}>▶</button></div>`;
  el.innerHTML = h;
}
function goDP(p) { _dp = p; renderDDash(); }
function goD2P(p) { _d2p = p; renderDisp(); }
function goRP(p) { _rp = p; renderRep(); }

// ── 유틸
function gf(n) { return farms.find(f => f.name === n) || {}; }
function gd(n) { return drivers.find(d => d.name === n) || {}; }
function afF(p) {
  const f = gf(gv(p + '-farm'));
  sv(p + '-tel', f.tel || ''); sv(p + '-ftel', f.tel || ''); sv(p + '-addr', f.addr || '');
  if (p === 'dp' && f.variety) sv('dp-item', f.variety);
}
function afD(p) { const d = gd(gv(p + '-drv')); sv(p + '-dtel', d.tel || ''); sv(p + '-car', d.car || ''); }

function popSels() {
  ['dp-farm', 'pk-farm', 'oi-farm', 'oo-farm', 'bk-farm'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const v = el.value; el.innerHTML = '<option value="">선택</option>';
    farms.forEach(f => el.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`);
    el.value = v;
  });
  ['dp-drv', 'pk-drv', 'bk-drv'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const v = el.value;
    el.innerHTML = id === 'pk-drv' ? '<option value="">선택사항</option>' : '<option value="">선택</option>';
    drivers.forEach(d => el.innerHTML += `<option value="${esc(d.name)}">${esc(d.name)} (${d.type})</option>`);
    el.value = v;
  });
  ['mp-farm'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const v = el.value; el.innerHTML = '<option value="">선택</option>';
    farms.forEach(f => el.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`);
    el.value = v;
  });
  ['mp-drv'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const v = el.value; el.innerHTML = '<option value="">선택사항</option>';
    drivers.forEach(d => el.innerHTML += `<option value="${esc(d.name)}">${esc(d.name)}</option>`);
    el.value = v;
  });
 ['oi-staff', 'oo-staff'].forEach(id => {
  const el = document.getElementById(id); if (!el) return;
  const v = el.value; el.innerHTML = '<option value="">선택</option>';
  drivers.forEach(d => el.innerHTML += `<option value="${esc(d.name)}">${esc(d.name)}</option>`);
  el.value = v;
});
  const rf = document.getElementById('rp-farm');
  if (rf) { rf.innerHTML = '<option value="">선택</option>'; farms.forEach(f => rf.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`); }
}

function setDates() {
  const t = new Date().toISOString().slice(0, 10);
  ['dp-date', 'pk-date', 'oi-date', 'oo-date', 'ni-date', 'no-date', 'rp-date', 'bk-date'].forEach(id => {
    const el = document.getElementById(id); if (el && !el.value) el.value = t;
  });
  const now = new Date();
  const fd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const rf = document.getElementById('rp-from'), rt = document.getElementById('rp-to');
  if (rf && !rf.value) rf.value = fd;
  if (rt && !rt.value) rt.value = t;
}

function gv(id) { return document.getElementById(id)?.value?.trim() || ''; }
function sv(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function n(id) { return parseInt(document.getElementById(id)?.value) || 0; }
function clr(...ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function emr(c, m) { return `<tr><td colspan="${c}" class="empty">${m}</td></tr>`; }
function ftm(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function CM(t) { document.getElementById('modal-' + t).style.display = 'none'; }
function cDel(m) { return confirm('삭제하시겠습니까?\n\n' + m + '\n\n⚠ 삭제된 데이터는 복구할 수 없습니다.'); }

// ── 문자
function buildMsg(d) {
  const f = gf(d.farm);
  const ft = f.tel ? `📞 농가주 연락처: ${f.tel}\n` : '';
  const ht = d.harvest ? `🗓 수확예정일: ${d.harvest}\n` : '';
  const it = d.item ? `🍊 품목: ${d.item}\n` : '';
  return `[감귤 콘테이너 배출 안내]\n\n안녕하세요, ${esc(d.driver)} 기사님.\n배출 업무 안내드립니다.\n\n📅 배출일: ${d.date}\n🏡 농가명: ${esc(d.farm)}\n📍 주소: ${esc(f.addr || '농가에 직접 확인')}\n${ft}📦 콘테이너: ${esc(d.ctype)} ${d.qty}개\n${ht}${it}${d.note && d.note !== '[자동]' ? '📝 특이사항: ' + esc(d.note) + '\n' : ''}\n배출 완료 후 앱에서 완료 등록 부탁드립니다.\n감사합니다.`;
}
function buildBkMsg(d) {
  const f = gf(d.farm);
  const ft = f.tel ? `📞 농가주 연락처: ${f.tel}\n` : '';
  const qtyStr = d.qty > 0 ? `${d.qty}개` : '현장 확인';
  return `[빈 콘테이너 회수 안내]\n\n안녕하세요, ${esc(d.driver)} 기사님.\n빈 콘테이너 회수 업무 안내드립니다.\n\n📅 회수일: ${d.date}\n🏡 농가명: ${esc(d.farm)}\n📍 주소: ${esc(f.addr || '농가에 직접 확인')}\n${ft}📦 회수 수량: ${qtyStr}\n${d.note ? '📝 비고: ' + esc(d.note) + '\n' : ''}\n감사합니다.`;
}
function previewBkMsg() {
  const farm = gv('bk-farm'), drv = gv('bk-drv'), date = gv('bk-date');
  if (!farm || !drv || !date) { alert('날짜, 농가명, 기사를 먼저 입력하세요'); return; }
  const d = gd(drv);
  openBkMsg({ date, farm, driver: drv, dtel: d.tel || '', qty: n('bk-qty'), note: gv('bk-note') });
}
function openBkMsg(d) {
  const drv = drivers.find(x => x.name === d.driver);
  _msgTxt = buildBkMsg(d); _msgDrvTel = d.dtel || drv?.tel || '';
  document.getElementById('msg-text').textContent = _msgTxt;
  sv('sms-to', _msgDrvTel); sv('sms-body', _msgTxt);
  const ss = document.getElementById('sms-stat'); if (ss) ss.style.display = 'none';
  switchMsgTab('c');
  document.getElementById('modal-msg').style.display = 'flex';
}

function openMsg(d) {
  _msgTxt = buildMsg(d); _msgDrvTel = d.dtel || '';
  document.getElementById('msg-text').textContent = _msgTxt;
  sv('sms-to', _msgDrvTel); sv('sms-body', _msgTxt);
  const ss = document.getElementById('sms-stat'); if (ss) ss.style.display = 'none';
  switchMsgTab('c');
  document.getElementById('modal-msg').style.display = 'flex';
}

function previewMsg() {
  const farm = gv('dp-farm'), drv = gv('dp-drv'), qty = n('dp-qty'), date = gv('dp-date'), ctype = gv('dp-ctype');
  if (!farm || !drv || !qty || !date) { alert('날짜, 농가명, 기사명, 수량을 먼저 입력하세요'); return; }
  const d = gd(drv);
  openMsg({ date, farm, driver: drv, dtel: d.tel || '', ctype, qty, harvest: gv('dp-harvest'), item: gv('dp-item'), note: gv('dp-note') });
}

function showMsgById(id) {
  const d = dispatches.find(x => x.id === id); if (!d) return; openMsg(d);
}

function copyMsg() {
  if (!_msgTxt) return;
  navigator.clipboard.writeText(_msgTxt)
    .then(() => alert('📋 복사 완료! 카카오톡 또는 문자에 붙여넣기 하세요.'))
    .catch(() => prompt('아래 내용을 복사하세요:', _msgTxt));
}

// ── 모달: 농가 수정
function openFarmEdit(id) {
  const f = farms.find(x => x.id === id); if (!f) return;
  _editFarmId = id;
  ['name', 'tel', 'addr', 'variety', 'contract', 'staff', 'memo'].forEach(k => {
    const el = document.getElementById('mf-' + k); if (el) el.value = f[k] || '';
  });
  document.getElementById('modal-farm').style.display = 'flex';
}
async function saveFarmEdit() {
  const name = document.getElementById('mf-name').value.trim();
  if (!name) { alert('농가명을 입력하세요'); return; }
  const oldName = farms.find(f => f.id === _editFarmId)?.name;
  const data = {
    name, tel: document.getElementById('mf-tel').value, addr: document.getElementById('mf-addr').value,
    variety: document.getElementById('mf-variety').value, contract: parseInt(document.getElementById('mf-contract').value) || 0,
    staff: document.getElementById('mf-staff').value, memo: document.getElementById('mf-memo').value
  };
  try {
    await dbUpdateFarm(_editFarmId, data);
    farms = farms.map(f => f.id === _editFarmId ? { ...f, ...data } : f);
    if (oldName && oldName !== name) {
      const cascadeTables = ['dispatches', 'picks', 'own_ins', 'own_outs', 'reports', 'harvests'];
      await Promise.all(cascadeTables.map(tbl =>
        fetch(`${SUPABASE_URL}/rest/v1/${tbl}?farm=eq.${encodeURIComponent(oldName)}`, {
          method: 'PATCH',
          headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ farm: name })
        })
      ));
      dispatches = dispatches.map(d => d.farm === oldName ? { ...d, farm: name } : d);
      picks     = picks.map(p => p.farm === oldName ? { ...p, farm: name } : p);
      ownIns    = ownIns.map(o => o.farm === oldName ? { ...o, farm: name } : o);
      ownOuts   = ownOuts.map(o => o.farm === oldName ? { ...o, farm: name } : o);
      reports   = reports.map(r => r.farm === oldName ? { ...r, farm: name } : r);
      harvests  = harvests.map(h => h.farm === oldName ? { ...h, farm: name } : h);
    }
    CM('farm'); popSels(); renderFarm(); renderDash(); renderCal();
  } catch (e) { alert('오류: ' + e.message); }
}

// ── 모달: 기사 수정
function openDrvEdit(id) {
  const d = drivers.find(x => x.id === id); if (!d) return;
  _editDrvId = id;
  sv('md-name', d.name || ''); sv('md-tel', d.tel || ''); sv('md-car', d.car || '');
  document.getElementById('md-type').value = d.type || '내부';
  sv('md-note', d.note || '');
  document.getElementById('modal-drv').style.display = 'flex';
}
async function saveDrvEdit() {
  const name = document.getElementById('md-name').value.trim(), tel = document.getElementById('md-tel').value.trim();
  if (!name || !tel) { alert('기사명과 연락처를 입력하세요'); return; }
  const data = { name, tel, car: document.getElementById('md-car').value, type: document.getElementById('md-type').value, note: document.getElementById('md-note').value };
  try {
    await dbUpdateDriver(_editDrvId, data);
    drivers = drivers.map(d => d.id === _editDrvId ? { ...d, ...data } : d);
    CM('drv'); popSels(); renderDrivers();
  } catch (e) { alert('오류: ' + e.message); }
}

// ── 모달: 수거 수정
function openPickEdit(id) {
  const p = picks.find(x => x.id === id); if (!p) return;
  _editPickId = id;
  sv('mp-date', p.date || ''); sv('mp-farm', p.farm || '');
  document.getElementById('mp-type').value = p.type || '원물수거';
  sv('mp-qty', p.qty || ''); sv('mp-drv', p.driver || ''); sv('mp-car', p.car || ''); sv('mp-note', p.note || '');
  document.getElementById('modal-pick').style.display = 'flex';
}
async function savePickEdit() {
  const date = gv('mp-date'), farm = gv('mp-farm'), type = gv('mp-type'), qty = parseInt(document.getElementById('mp-qty').value) || 0;
  if (!date || !farm || !type || !qty) { alert('필수 항목을 입력하세요'); return; }
  const data = { date, farm, type, qty, driver: gv('mp-drv'), car: gv('mp-car'), note: gv('mp-note'), updated_at: new Date().toISOString() };
  try {
    await dbUpdatePick(_editPickId, data);
    picks = picks.map(p => p.id === _editPickId ? { ...p, ...data } : p);
    CM('pick'); renderPick(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

// ── 모달: 외부용기 수정
function openExtEdit(tp, id) {
  _XT = tp; _XI = id;
  const body = document.getElementById('ext-modal-body');
  const title = document.getElementById('ext-modal-title');
  if (tp === 'ownIn') {
    const o = ownIns.find(x => x.id === id); if (!o) return;
    title.textContent = '✏️ 자가 콘테이너 반입 수정';
    body.innerHTML = `<div class="fg"><label>반입일자</label><input id="em-date" type="date" value="${esc(o.date||'')}"></div><div class="fg"><label>농가명</label><input id="em-farm" value="${esc(o.farm||'')}"></div><div class="fg"><label>수량</label><input id="em-qty" type="number" value="${o.qty||0}"></div><div class="fg"><label>특징</label><input id="em-feature" value="${esc(o.feature||'')}"></div><div class="fg"><label>담당직원</label><input id="em-staff" value="${esc(o.staff||'')}"></div>`;
  } else if (tp === 'ownOut') {
    const o = ownOuts.find(x => x.id === id); if (!o) return;
    title.textContent = '✏️ 자가 콘테이너 반납 수정';
    body.innerHTML = `<div class="fg"><label>반납일자</label><input id="em-date" type="date" value="${esc(o.date||'')}"></div><div class="fg"><label>농가명</label><input id="em-farm" value="${esc(o.farm||'')}"></div><div class="fg"><label>수량</label><input id="em-qty" type="number" value="${o.qty||0}"></div><div class="fg"><label>방법</label><input id="em-method" value="${esc(o.method||'')}"></div><div class="fg"><label>특징</label><input id="em-feature" value="${esc(o.feature||'')}"></div><div class="fg"><label>담당직원</label><input id="em-staff" value="${esc(o.staff||'')}"></div>`;
  } else if (tp === 'nhfIn') {
    const o = nhfIns.find(x => x.id === id); if (!o) return;
    title.textContent = '✏️ 농협 용기 반입 수정';
    body.innerHTML = `<div class="fg"><label>반입일자</label><input id="em-date" type="date" value="${esc(o.date||'')}"></div><div class="fg"><label>농협명</label><input id="em-nhf" value="${esc(o.nhf||'')}"></div><div class="fg"><label>종류</label><input id="em-type" value="${esc(o.type||'')}"></div><div class="fg"><label>수량</label><input id="em-qty" type="number" value="${o.qty||0}"></div><div class="fg"><label>특징</label><input id="em-feature" value="${esc(o.feature||'')}"></div><div class="fg"><label>구매 내용</label><input id="em-goods" value="${esc(o.goods||'')}"></div><div class="fg"><label>담당직원</label><input id="em-staff" value="${esc(o.staff||'')}"></div>`;
  } else if (tp === 'nhfOut') {
    const o = nhfOuts.find(x => x.id === id); if (!o) return;
    title.textContent = '✏️ 농협 용기 반납 수정';
    body.innerHTML = `<div class="fg"><label>반납일자</label><input id="em-date" type="date" value="${esc(o.date||'')}"></div><div class="fg"><label>농협명</label><input id="em-nhf" value="${esc(o.nhf||'')}"></div><div class="fg"><label>종류</label><input id="em-type" value="${esc(o.type||'')}"></div><div class="fg"><label>수량</label><input id="em-qty" type="number" value="${o.qty||0}"></div><div class="fg"><label>방법</label><input id="em-method" value="${esc(o.method||'')}"></div><div class="fg"><label>특징</label><input id="em-feature" value="${esc(o.feature||'')}"></div><div class="fg"><label>담당직원</label><input id="em-staff" value="${esc(o.staff||'')}"></div>`;
  }
  document.getElementById('modal-ext').style.display = 'flex';
}
async function saveExtEdit() {
  const g = i => document.getElementById(i)?.value?.trim() || '';
  const qty = parseInt(document.getElementById('em-qty')?.value) || 0;
  try {
    if (_XT === 'ownIn') { await dbUpdateOwnIn(_XI, { date: g('em-date'), farm: g('em-farm'), qty, feature: g('em-feature'), staff: g('em-staff') }); ownIns = await dbGetOwnIns(); }
    else if (_XT === 'ownOut') { await dbUpdateOwnOut(_XI, { date: g('em-date'), farm: g('em-farm'), qty, method: g('em-method'), feature: g('em-feature'), staff: g('em-staff') }); ownOuts = await dbGetOwnOuts(); }
    else if (_XT === 'nhfIn') { await dbUpdateNhfIn(_XI, { date: g('em-date'), nhf: g('em-nhf'), type: g('em-type'), qty, feature: g('em-feature'), goods: g('em-goods'), staff: g('em-staff') }); nhfIns = await dbGetNhfIns(); }
    else if (_XT === 'nhfOut') { await dbUpdateNhfOut(_XI, { date: g('em-date'), nhf: g('em-nhf'), type: g('em-type'), qty, method: g('em-method'), feature: g('em-feature'), staff: g('em-staff') }); nhfOuts = await dbGetNhfOuts(); }
    CM('ext'); renderOwn(); renderNhf(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

// ── 농가
async function addFarm() {
  const name = gv('f-name');
  if (!name) { alert('농가명을 입력하세요'); return; }
  if (farms.find(f => f.name === name)) { alert('이미 등록된 농가입니다'); return; }
  try {
    const row = await dbInsertFarm({ name, tel: gv('f-tel'), addr: gv('f-addr'), variety: gv('f-variety'), contract: n('f-contract'), staff: gv('f-staff'), memo: gv('f-memo') });
    farms.push(row);
    clr('f-name', 'f-tel', 'f-addr', 'f-variety', 'f-contract', 'f-staff', 'f-memo');
    popSels(); renderFarm();
  } catch (e) { alert('오류: ' + e.message); }
}
async function delFarm(id) {
  if (!cDel('농가 삭제')) return;
  try { await dbDeleteFarm(id); farms = farms.filter(f => f.id !== id); popSels(); renderFarm(); }
  catch (e) { alert('오류: ' + e.message); }
}
function renderFarm() {
  document.getElementById('farm-cnt').textContent = farms.length;
  const el = document.getElementById('farm-cards');
  if (!farms.length) { el.innerHTML = '<div class="note">등록된 농가가 없습니다</div>'; return; }
  el.innerHTML = farms.map((f, i) => `<div class="farm-card">
    <div class="fc-info">
      <div class="fc-name"><span class="badge b-neu">F-${String(i + 1).padStart(3, '0')}</span>${esc(f.name)}${f.variety ? `<span class="badge b-teal">${esc(f.variety)}</span>` : ''}</div>
      <div class="fc-details">
        ${f.tel ? `<span>📞 ${esc(f.tel)}</span>` : ''}
        ${f.addr ? `<span>📍 ${esc(f.addr)}</span>` : ''}
        ${f.contract ? `<span>📦 계약 ${f.contract}개</span>` : ''}
        ${f.staff ? `<span>👤 ${esc(f.staff)}</span>` : ''}
        ${f.memo ? `<span>💬 ${esc(f.memo)}</span>` : ''}
      </div>
    </div>
    <div class="fc-actions"><button class="btn" onclick="openFarmHistory('${esc(f.name)}')">📋 이력</button><button class="btn edt" onclick="openFarmEdit(${f.id})">✏️</button><button class="btn del" onclick="delFarm(${f.id})">삭제</button></div>
  </div>`).join('');
}

// ── 기사·PIN
async function addDriver() {
  const name = gv('dv-name'), tel = gv('dv-tel'), type = gv('dv-type');
  if (!name || !tel) { alert('기사명과 연락처를 입력하세요'); return; }
  if (drivers.find(d => d.name === name)) { alert('이미 등록된 기사입니다'); return; }
  const car = type === '내부' ? (document.getElementById('dv-car-sel')?.value || '') : (gv('dv-car') || '');
  const pin = genPin();
  try {
    const row = await dbInsertDriver({ name, tel, car, type, note: gv('dv-note'), pin, pin_active: true });
    drivers.push(row);
    clr('dv-name', 'dv-tel', 'dv-car', 'dv-note');
    if (document.getElementById('dv-car-sel')) document.getElementById('dv-car-sel').value = '';
    popSels(); renderDrivers(); renderVehicles();
    alert(`✅ ${name} 기사 등록!\n\n📌 발급 PIN: ${pin}\n\n기사에게 전달해 주세요.`);
  } catch (e) { alert('오류: ' + e.message); }
}
async function delDriver(id) {
  if (!cDel('기사 삭제')) return;
  try { await dbDeleteDriver(id); drivers = drivers.filter(d => d.id !== id); popSels(); renderDrivers(); }
  catch (e) { alert('오류: ' + e.message); }
}

// ── 모달: 배차 수정
let _editDispId = null;
function openDispEdit(id) {
  const d = dispatches.find(x => x.id === id); if (!d) return;
  _editDispId = id;
  document.getElementById('ed-date').value = d.date || '';
  const ef = document.getElementById('ed-farm');
  ef.innerHTML = '<option value="">선택</option>';
  farms.forEach(f => ef.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`);
  ef.value = d.farm || '';
  const edrv = document.getElementById('ed-drv');
  edrv.innerHTML = '<option value="">선택</option>';
  drivers.forEach(dr => edrv.innerHTML += `<option value="${esc(dr.name)}">${esc(dr.name)}</option>`);
  edrv.value = d.driver || '';
  document.getElementById('ed-qty').value = d.qty || '';
  document.getElementById('ed-ctype').value = d.ctype || '노랑';
  document.getElementById('ed-harvest').value = d.harvest || '';
  document.getElementById('ed-item').value = d.item || '';
  document.getElementById('ed-note').value = d.note || '';
  document.getElementById('ed-trip').value = d.trip || '';
  document.getElementById('ed-timeslot').value = d.timeslot || '';
  document.getElementById('modal-disp').style.display = 'flex';
}

async function saveDispEdit() {
  const date = document.getElementById('ed-date').value;
  const farm = document.getElementById('ed-farm').value;
  const driver = document.getElementById('ed-drv').value;
  const qtyRaw = document.getElementById('ed-qty').value.trim();
  const qty = qtyRaw === '' ? 0 : parseInt(qtyRaw) || 0;
  if (!date || !farm || !driver) { alert('필수 항목을 입력하세요'); return; }
  const d = gd(driver);
  const data = {
    date, farm, driver,
    dtel: d.tel || '', car: d.car || '', qty,
    ctype: document.getElementById('ed-ctype').value,
    harvest: document.getElementById('ed-harvest').value || null,
    item: document.getElementById('ed-item').value || null,
    note: document.getElementById('ed-note').value || null,
    trip: document.getElementById('ed-trip').value || null,
    timeslot: document.getElementById('ed-timeslot').value || null
  };
  try {
    await dbUpdateDispatch(_editDispId, data);
    dispatches = dispatches.map(x => x.id === _editDispId ? { ...x, ...data } : x);
    CM('disp'); renderDisp(); renderDDash(); renderSC(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

function renderAdmPinChange() {
  const el = document.getElementById('adm-pin-change');
  if (!el) return;
  el.innerHTML = `
    <div class="form-card" style="border-left:3px solid #C05800">
      <div class="form-title">🔐 관리자 PIN 변경</div>
      <div class="form-grid">
        <div class="fg"><label>현재 PIN</label><input id="apc-cur" type="password" maxlength="4" placeholder="현재 PIN" oninput="this.value=this.value.replace(/\\D/g,'')"></div>
        <div class="fg"><label>새 PIN</label><input id="apc-new" type="password" maxlength="4" placeholder="새 PIN (4자리)" oninput="this.value=this.value.replace(/\\D/g,'')"></div>
        <div class="fg"><label>새 PIN 확인</label><input id="apc-confirm" type="password" maxlength="4" placeholder="새 PIN 재입력" oninput="this.value=this.value.replace(/\\D/g,'')"></div>
      </div>
      <div id="apc-msg" style="font-size:12px;margin-bottom:8px;display:none"></div>
      <div class="form-actions"><button class="btn pri" onclick="changeAdmPin()">PIN 변경</button></div>
    </div>
  `;
}

function changeAdmPin() {
  const curEl = document.getElementById('apc-cur');
  const nwEl = document.getElementById('apc-new');
  const cfEl = document.getElementById('apc-confirm');
  const msg = document.getElementById('apc-msg');
  
  if (!curEl || !nwEl || !cfEl || !msg) { alert('PIN 변경 폼을 찾을 수 없습니다'); return; }
  
  const cur = curEl.value;
  const nw = nwEl.value;
  const cf = cfEl.value;
  const currentPin = localStorage.getItem('citrus_adm_pin') || ADM_PIN;
  
  msg.style.display = 'block';
  
  if (!cur) { msg.style.color = '#C62828'; msg.textContent = '❌ 현재 PIN을 입력하세요'; return; }
  if (cur !== currentPin) { msg.style.color = '#C62828'; msg.textContent = '❌ 현재 PIN이 맞지 않습니다 (입력: ' + cur + ')'; return; }
  if (!nw || nw.length < 4) { msg.style.color = '#C62828'; msg.textContent = '❌ 새 PIN은 4자리여야 합니다'; return; }
  if (nw !== cf) { msg.style.color = '#C62828'; msg.textContent = '❌ 새 PIN이 일치하지 않습니다'; return; }
  if (nw === cur) { msg.style.color = '#C62828'; msg.textContent = '❌ 현재 PIN과 동일합니다'; return; }
  
  localStorage.setItem('citrus_adm_pin', nw);
  msg.style.color = '#2E7D32';
  msg.textContent = '✅ PIN 변경 완료! 새 PIN: ' + nw;
  curEl.value = ''; nwEl.value = ''; cfEl.value = '';
}

function renderDrivers() {
  document.getElementById('drv-cnt').textContent = drivers.length;
  const el = document.getElementById('drv-list');
  if (!drivers.length) { el.innerHTML = '<div class="note">등록된 기사가 없습니다</div>'; return; }
  el.innerHTML = drivers.map(d => {
    const hidden = _pinHidden[d.id] === true;
    const pinDisp = hidden ? '••••' : (d.pin || '----');
    const pinColor = hidden ? '#999' : '#C05800';
    return `<div class="pin-mgmt">
      <div class="pm-top">
        <div class="pm-info">
          <div class="pm-name">${esc(d.name)} <span class="badge ${d.type === '내부' ? 'b-ok' : 'b-pur'}">${d.type}</span> <span class="badge ${d.pin_active !== false ? 'b-ok' : 'b-red'}">${d.pin_active !== false ? '활성' : '차단'}</span></div>
          <div class="pm-sub">📞 ${esc(d.tel)} · 🚛 ${esc(d.car || '차량미등록')}</div>
        </div>
        <div class="pm-acts">
          <button class="btn edt" onclick="openDrvEdit(${d.id})">✏️ 수정</button>
          <button class="btn del" onclick="delDriver(${d.id})">삭제</button>
        </div>
      </div>
      <div class="pm-pin-area">
        <span class="pm-pin-label">PIN</span>
        <span style="font-family:monospace;font-size:20px;font-weight:700;letter-spacing:6px;color:${pinColor};min-width:70px">${pinDisp}</span>
        <div class="pm-acts">
          <button class="btn-p hide" onclick="togglePinVis(${d.id})">${hidden ? '👁 보기' : '🙈 숨기기'}</button>
          <button class="btn-p regen" onclick="regenPin(${d.id})">🔄 재발급</button>
          <button class="btn-p ${d.pin_active !== false ? 'block' : 'unblock'}" onclick="togglePinActive(${d.id})">${d.pin_active !== false ? '🚫 차단' : '✅ 해제'}</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── 차량 관리
let _editVehicleId = null;

function renderVehicles() {
  const el = document.getElementById('vehicle-list'); if (!el) return;
  const assignedCars = new Set(drivers.map(d => d.car).filter(Boolean));
  if (!vehicles.length) {
    el.innerHTML = '<div class="note">등록된 차량이 없습니다</div>';
    document.getElementById('vehicle-avail').innerHTML = '';
    return;
  }
  const free = vehicles.filter(v => !assignedCars.has(v.number));
  document.getElementById('vehicle-avail').innerHTML = free.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        <span style="font-size:11px;color:#888;font-weight:600;align-self:center">미배정 차량 ${free.length}대:</span>
        ${free.map(v => `<span style="padding:4px 10px;background:#E8F5E9;color:#2E7D32;border-radius:20px;font-size:12px;font-weight:500">${esc(v.number)} <span style="font-size:10px;color:#888">${v.capacity_default||'-'}개</span></span>`).join('')}
      </div>`
    : '';
  el.innerHTML = vehicles.map(v => {
    const assigned = drivers.find(d => d.car === v.number);
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border:1px solid #e0e0e0;border-radius:10px;margin-bottom:6px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px">
        <div style="font-size:13px;font-weight:600">${esc(v.number)}</div>
        <div style="font-size:11px;color:#888;margin-top:2px">기본 ${v.capacity_default||'-'}개 · 최대 ${v.capacity_max||'-'}개${v.note ? ' · '+esc(v.note) : ''}</div>
      </div>
      <div>
        ${assigned
          ? `<span class="badge b-info" style="font-size:11px">${esc(assigned.name)} 배정</span>`
          : `<span class="badge b-ok" style="font-size:11px">미배정</span>`}
      </div>
      <div style="display:flex;gap:4px">
        <button class="btn edt" onclick="openVehicleEdit(${v.id})">✏️</button>
        <button class="btn del" onclick="delVehicle(${v.id})">삭제</button>
      </div>
    </div>`;
  }).join('');

  // 기사 등록 차량 셀렉트 갱신
  const sel = document.getElementById('dv-car-sel');
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">미배정</option>' + vehicles.map(v => `<option value="${esc(v.number)}">${esc(v.number)} (기본${v.capacity_default||'-'}개)</option>`).join('');
    sel.value = cur;
  }
}

async function addVehicle() {
  const number = document.getElementById('vc-number')?.value?.trim();
  const capacity_default = parseInt(document.getElementById('vc-cap-def')?.value) || null;
  const capacity_max = parseInt(document.getElementById('vc-cap-max')?.value) || null;
  const note = document.getElementById('vc-note')?.value?.trim() || null;
  if (!number) { alert('차량번호를 입력하세요'); return; }
  try {
    const row = await dbInsertVehicle({ number, capacity_default, capacity_max, note });
    vehicles.push(row);
    document.getElementById('vc-number').value = '';
    document.getElementById('vc-cap-def').value = '';
    document.getElementById('vc-cap-max').value = '';
    document.getElementById('vc-note').value = '';
    renderVehicles();
  } catch(e) { alert('오류: ' + e.message); }
}

function openVehicleEdit(id) {
  const v = vehicles.find(x => x.id === id); if (!v) return;
  _editVehicleId = id;
  document.getElementById('mvc-number').value = v.number || '';
  document.getElementById('mvc-cap-def').value = v.capacity_default || '';
  document.getElementById('mvc-cap-max').value = v.capacity_max || '';
  document.getElementById('mvc-note').value = v.note || '';
  document.getElementById('modal-vehicle').style.display = 'flex';
}

async function saveVehicleEdit() {
  const number = document.getElementById('mvc-number').value.trim();
  if (!number) { alert('차량번호를 입력하세요'); return; }
  const data = {
    number,
    capacity_default: parseInt(document.getElementById('mvc-cap-def').value) || null,
    capacity_max: parseInt(document.getElementById('mvc-cap-max').value) || null,
    note: document.getElementById('mvc-note').value.trim() || null
  };
  try {
    await dbUpdateVehicle(_editVehicleId, data);
    vehicles = vehicles.map(v => v.id === _editVehicleId ? { ...v, ...data } : v);
    CM('vehicle'); renderVehicles();
  } catch(e) { alert('오류: ' + e.message); }
}

async function delVehicle(id) {
  if (!cDel('차량 삭제')) return;
  try { await dbDeleteVehicle(id); vehicles = vehicles.filter(v => v.id !== id); renderVehicles(); }
  catch(e) { alert('오류: ' + e.message); }
}

function onDrvTypeChange() {
  const type = document.getElementById('dv-type')?.value;
  const carSel = document.getElementById('dv-car-sel-wrap');
  const carTxt = document.getElementById('dv-car-txt-wrap');
  if (carSel) carSel.style.display = type === '내부' ? '' : 'none';
  if (carTxt) carTxt.style.display = type === '외부' ? '' : 'none';
}

// ── 배차
function ctB(v) { const m = { 노랑: '🟡', 초록: '🟢', 헌콘: '⬜', 사각: '🔲' }; return `${m[v] || '📦'} ${esc(v || '-')}`; }

async function addDisp() {
  const date = gv('dp-date'), farm = gv('dp-farm'), drv = gv('dp-drv'), qty = n('dp-qty'), ctype = gv('dp-ctype');
  if (!date || !farm || !drv) { alert('날짜, 농가명, 기사명을 입력하세요'); return; }
  if (!ctype) { alert('콘테이너 종류를 선택하세요'); return; }
  const d = gd(drv);
  try {
    const row = await dbInsertDispatch({ date, farm, driver: drv, dtel: d.tel || '', car: d.car || '', qty, ctype, harvest: gv('dp-harvest') || null, item: gv('dp-item') || null, note: gv('dp-note') || null, trip: gv('dp-trip') || null, timeslot: gv('dp-timeslot') || null, status: '배차완료' });
    dispatches.unshift(row);
    // 수량이 있을 때만 배출 자동 pick 생성
    if (qty > 0) {
      await dbInsertPick({ date, farm, type: '배출', qty, driver: drv, car: d.car || '', note: '[자동]', dispatch_id: row.id, auto: true });
      picks = await dbGetPicks();
    }
    clr('dp-qty', 'dp-note', 'dp-harvest'); sv('dp-ctype', ''); sv('dp-trip', '');
    document.querySelectorAll('.ctype-btn').forEach(b => b.classList.remove('sel'));
    document.getElementById('dp-stw').style.display = 'none';
    openMsg(row);
    renderSC(); renderDisp(); renderDDash(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

async function updDisp(id, s) {
  try {
    await dbUpdateDispatch(id, { status: s });
    dispatches = dispatches.map(d => d.id === id ? { ...d, status: s } : d);
    if (s === '배출완료') {
      const d = dispatches.find(x => x.id === id);
      if (d && !reports.find(r => r.driver === d.driver && r.farm === d.farm && r.date === d.date)) {
        const rpt = await dbInsertReport({ driver: d.driver, date: d.date, farm: d.farm, qty: d.qty, note: '완료처리' });
        reports.unshift(rpt);
      }
    }
    renderDisp(); renderDDash(); renderMyAssign(); renderMyPending();
    const c = document.getElementById('rep-cnt'); if (c) c.textContent = (_loggedDrv ? reports.filter(r=>r.driver===_loggedDrv.name).length : reports.length) + '건';
    if (_repOpen) renderRep(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

async function delDisp(id) {
  if (!cDel('배차 기록 삭제')) return;
  try {
    await dbDeleteDispatch(id);
    dispatches = dispatches.filter(d => d.id !== id);
    picks = picks.filter(p => p.dispatch_id !== id);
    renderSC(); renderDisp(); renderDDash(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

function tsBadge(ts) {
  if (!ts) return '';
  const style = ts === '오전' ? 'background:#E3F2FD;color:#1565C0' : 'background:#FFF3E0;color:#E65100';
  return `<span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;${style}">${ts === '오전' ? '🌅 오전' : '🌇 오후'}</span>`;
}
function tripBadge(trip) {
  if (!trip) return '';
  return `<span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;background:#F3E5F5;color:#6A1B9A">${esc(trip)}</span>`;
}
function renderDDash() {
  const list = dispatches.filter(d => _dt === 'w' ? d.status === '배차완료' : d.status === '배출완료')
    .sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);
  const el = document.getElementById('d-disp-tb');
  const w = dispatches.filter(d => d.status === '배차완료').length;
  const dn = dispatches.filter(d => d.status === '배출완료').length;
  document.getElementById('disp-dash-badges').innerHTML = `<span class="badge b-info">배출 대기 ${w}건</span><span class="badge b-ok">배출 완료 ${dn}건</span>`;

  if (!list.length) { el.innerHTML = `<div style="padding:16px;text-align:center;color:#aaa;font-size:13px">${_dt === 'w' ? '배출 대기 없음 🎉' : '배출 완료 없음'}</div>`; mkPg('disp-pg', 0, 1, 'goDP'); return; }

  const today = new Date().toISOString().slice(0, 10);

  // 날짜별 → 오전/오후/미지정 → 농가별 그룹
  const dates = [...new Set(list.map(d => d.date))];

  function dispRow(d) {
    const drv = gd(d.driver);
    const farm = gf(d.farm);
    return `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#fff;border-radius:8px;border:0.5px solid #ebebeb;flex-wrap:wrap">
      ${tripBadge(d.trip)}
      <div style="display:flex;flex-direction:column;gap:1px">
        <span style="font-size:12px;font-weight:600">${esc(d.farm)}</span>
        ${farm.addr ? `<span style="font-size:10px;color:#aaa">${esc(farm.addr)}</span>` : ''}
      </div>
      <span style="font-size:11px;color:#888">·</span>
      <span style="font-size:12px">${esc(d.driver)}</span>
      <span class="badge ${drv.type==='외부'?'b-pur':'b-ok'}" style="font-size:9px">${drv.type||'내부'}</span>
      <span style="font-size:12px;color:#555;margin-left:2px">${d.qty > 0 ? d.qty+'개' : '<span style="color:#E65100;font-size:11px">수량미정</span>'} ${ctB(d.ctype)}</span>
      <div style="display:flex;gap:4px;margin-left:auto">
        <button class="btn edt" style="padding:3px 8px;font-size:11px" onclick="openDispEdit(${d.id})">✏️</button>
        ${_dt === 'w' ? `<button class="btn grn" style="padding:3px 8px;font-size:11px" onclick="updDisp(${d.id},'배출완료')">✅ 완료</button>` : ''}
      </div>
    </div>`;
  }

  el.innerHTML = dates.map(date => {
    const dayItems = list.filter(d => d.date === date);
    const isToday = date === today, isLate = date < today;
    const dateLabel = isToday ? `오늘 <span style="color:#C05800">${date}</span>` : isLate ? `<span style="color:#C62828">⚠ ${date} 지연</span>` : date;

    const tripOrder = t => ({ '1차': 1, '2차': 2, '3차': 3 }[t] || 99);
    const sortTrip = arr => [...arr].sort((a, b) => tripOrder(a.trip) - tripOrder(b.trip));
    const am = sortTrip(dayItems.filter(d => d.timeslot === '오전'));
    const pm = sortTrip(dayItems.filter(d => d.timeslot === '오후'));
    const none = sortTrip(dayItems.filter(d => !d.timeslot));

    function slot(label, icon, items, bg, border) {
      if (!items.length) return '';
      return `<div style="margin-bottom:8px">
        <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:5px;padding:3px 8px;background:${bg};border-radius:6px;display:inline-block;border:1px solid ${border}">${icon} ${label} ${items.length}건</div>
        <div style="display:flex;flex-direction:column;gap:4px">${items.map(dispRow).join('')}</div>
      </div>`;
    }

    return `<div style="background:#fff;border-radius:10px;border:1px solid ${isLate?'#FFCDD2':'#e0e0e0'};overflow:hidden;margin-bottom:10px">
      <div style="padding:9px 14px;background:${isLate?'#FFF8F8':isToday?'#FFFDE7':'#fafafa'};font-size:12px;font-weight:600;border-bottom:0.5px solid #f0f0f0">${dateLabel} <span style="font-weight:400;color:#aaa;font-size:11px">${dayItems.length}건</span></div>
      <div style="padding:10px 14px">
        ${slot('오전','🌅',am,'#E3F2FD','#BBDEFB')}
        ${slot('오후','🌇',pm,'#FFF3E0','#FFE0B2')}
        ${none.length ? `<div style="display:flex;flex-direction:column;gap:4px">${none.map(dispRow).join('')}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  mkPg('disp-pg', dates.length, _dp, 'goDP');
}

function renderDisp() {
  const f = dispatches.filter(d => _dt2 === 'w' ? d.status === '배차완료' : d.status === '배출완료');
  const page = f.slice((_d2p - 1) * PER, _d2p * PER);
  const sc = { '배차완료': 'b-info', '배출완료': 'b-ok' };
  document.getElementById('disp-tb').innerHTML = page.length ? page.map(d => `<tr>
    <td>${d.date}</td><td class="nm">${esc(d.farm)}${gf(d.farm).addr ? `<div style="font-size:10px;color:#aaa;font-weight:400;margin-top:2px">${esc(gf(d.farm).addr)}</div>` : ''}</td><td>${esc(d.driver)}</td>
    <td>${d.timeslot ? tsBadge(d.timeslot) : '-'}</td>
    <td>${d.trip ? `<span class="badge b-neu">${esc(d.trip)}</span>` : '-'}</td>
    <td><span class="badge ${gd(d.driver).type === '외부' ? 'b-pur' : 'b-ok'}">${esc(gd(d.driver).type || '-')}</span></td>
    <td>${d.qty > 0 ? d.qty+'개' : '<span class="badge b-warn">미정</span>'}</td><td>${ctB(d.ctype)}</td><td>${d.harvest || '-'}</td><td>${esc(d.item || '-')}</td><td>${esc(d.car || '-')}</td>
    <td><span class="badge ${sc[d.status] || 'b-neu'}">${esc(d.status)}</span></td>
    <td><button class="btn copy" style="padding:4px 8px" onclick="showMsgById(${d.id})">📱</button></td>
    <td><div style="display:flex;gap:4px;align-items:center">
      ${d.status !== '배출완료' ? `<button class="btn grn" onclick="updDisp(${d.id},'배출완료')">완료</button>` : ''}
      <button class="btn edt" onclick="openDispEdit(${d.id})">✏️</button>
      <button class="btn del" onclick="delDisp(${d.id})">삭제</button>
    </div></td>
  </tr>`).join('') : emr(14, _dt2 === 'w' ? '배출 대기 없음' : '배출 완료 없음');
  mkPg('disp2-pg', f.length, _d2p, 'goD2P');
}

// ── 수거
async function addPick() {
  const date = gv('pk-date'), farm = gv('pk-farm'), type = gv('pk-type'), qty = n('pk-qty');
  if (!date || !farm || !type || !qty) { alert('필수 항목을 입력하세요'); return; }
  const d = gd(gv('pk-drv'));
  try {
    const row = await dbInsertPick({ date, farm, type, qty, driver: gv('pk-drv'), car: d.car || gv('pk-car'), note: gv('pk-note'), auto: false });
    picks.unshift(row);
    clr('pk-qty', 'pk-note'); renderPick(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}
async function delPick(id) {
  if (!cDel('수거 기록 삭제')) return;
  try { await dbDeletePick(id); picks = picks.filter(p => p.id !== id); renderPick(); renderDash(); }
  catch (e) { alert('오류: ' + e.message); }
}
function renderPick() {
  const tb = document.getElementById('pick-tb');
  const list = picks.filter(p => !p.auto);
  if (!list.length) { tb.innerHTML = emr(9, '수거·회수 기록이 없습니다'); return; }
  const cls = { 원물수거: 'b-ok', 잉여회수: 'b-neu', 빈콘회수: 'b-teal' };
  tb.innerHTML = list.map(p => `<tr>
    <td>${p.date}</td><td class="nm">${esc(p.farm)}</td>
    <td><span class="badge ${cls[p.type] || 'b-neu'}">${esc(p.type)}</span></td>
    <td>${p.qty}개</td><td>${esc(p.driver || '-')}</td><td>${esc(p.car || '-')}</td>
    <td>${esc(p.note || '-')}</td>
    <td class="mtime">${p.updated_at ? '✏️ ' + ftm(p.updated_at) : '-'}</td>
    <td><div style="display:flex;gap:4px"><button class="btn edt" onclick="openPickEdit(${p.id})">✏️</button><button class="btn del" onclick="delPick(${p.id})">삭제</button></div></td>
  </tr>`).join('');
}

function onPickTypeChange() {
  const type = document.getElementById('pk-type')?.value;
  const smsBtn = document.getElementById('pk-sms-btn');
  if (smsBtn) smsBtn.style.display = type === '빈콘회수' ? '' : 'none';
}

// ── 자가 콘테이너
async function addOwnIn() {
  const date = gv('oi-date'), farm = gv('oi-farm'), qty = n('oi-qty');
  if (!date || !farm || !qty || !gv('oi-staff')) { alert('담당 기사를 선택하세요'); return; }
  if (!date || !farm || !qty) { alert('반입일자, 농가명, 수량을 입력하세요'); return; }
  try {
    const row = await dbInsertOwnIn({ date, farm, qty, feature: gv('oi-feature'), staff: gv('oi-staff') });
    ownIns.unshift(row); clr('oi-qty', 'oi-feature', 'oi-staff'); renderOwn(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}
async function addOwnOut() {
  const date = gv('oo-date');
  const farm = gv('oo-farm');
  const qty = n('oo-qty');

  if (!date || !farm || !qty) {
    alert('반납일자, 농가명, 수량을 입력하세요');
    return;
  }

  if (!gv('oo-staff')) {
    alert('담당 기사를 선택하세요');
    return;
  }

  try {
    const row = await dbInsertOwnOut({
      date,
      farm,
      qty,
      method: gv('oo-method'),
      feature: gv('oo-feature'),
      staff: gv('oo-staff')
    });

    ownOuts.unshift(row);
    clr('oo-qty', 'oo-staff', 'oo-feature');
    renderOwn();
    renderDash();
  } catch (e) {
    alert('오류: ' + e.message);
  }
}
async function delOwn(id, t) {
  if (!cDel(t === 'i' ? '반입 기록 삭제' : '반납 기록 삭제')) return;

  try {
    if (t === 'i') {
      await dbDeleteOwnIn(id);
      ownIns = ownIns.filter(o => o.id !== id);
    } else {
      await dbDeleteOwnOut(id);
      ownOuts = ownOuts.filter(o => o.id !== id);
    }

    renderOwn();
    renderDash();
  } catch (e) {
    alert('오류: ' + e.message);
  }
}

function gOwnSt(n) {
  const i = ownIns.filter(o => o.farm === n).reduce((s, o) => s + o.qty, 0);
  const o = ownOuts.filter(o => o.farm === n).reduce((s, o) => s + o.qty, 0);
  return { inQ: i, outQ: o, left: i - o, feature: ownIns.filter(o => o.farm === n).map(o => o.feature).filter(Boolean).join(', ') };
}
function renderOwn() {
  const names = [...new Set([...ownIns.map(o => o.farm), ...ownOuts.map(o => o.farm)])];
  const pend = names.filter(n => gOwnSt(n).left > 0), done = names.filter(n => gOwnSt(n).left <= 0);
  const bg = document.getElementById('own-sum-badge');
  if (bg) { bg.textContent = pend.length > 0 ? `반납필요 ${pend.length}건` : '모두 정산완료'; bg.className = 'badge ' + (pend.length > 0 ? 'b-warn' : 'b-ok'); bg.style.textTransform = 'none'; bg.style.fontSize = '11px'; }
  let rows = '';
  if (pend.length) rows += pend.map(n => { const st = gOwnSt(n); return `<tr><td class="nm">${esc(n)}</td><td>${st.inQ}개</td><td>${st.outQ}개</td><td><span class="badge b-warn">${st.left}개</span></td><td>${esc(st.feature || '-')}</td><td><span class="badge b-warn">반납필요</span></td></tr>`; }).join('');
  if (done.length) { rows += `<tr class="ddiv"><td colspan="6">── 정산 완료 ──</td></tr>`; rows += done.map(n => { const st = gOwnSt(n); return `<tr class="dr"><td class="nm">${esc(n)}</td><td>${st.inQ}개</td><td>${st.outQ}개</td><td><span class="badge b-ok">${st.left}개</span></td><td>${esc(st.feature || '-')}</td><td><span class="badge b-ok">정산완료</span></td></tr>`; }).join(''); }
  document.getElementById('own-sum').innerHTML = rows || emr(6, '기록 없음');
  const all = [...ownIns.map(o => ({ ...o, dir: '반입', xt: 'ownIn', meth: '-' })), ...ownOuts.map(o => ({ ...o, dir: '반납', xt: 'ownOut', meth: o.method || '-' }))].sort((a, b) => b.date > a.date ? 1 : -1);
  const tb = document.getElementById('own-tb-badge'); if (tb) tb.textContent = all.length + '건';
  document.getElementById('own-tb').innerHTML = all.length ? all.map(o => `<tr><td>${o.date}</td><td class="nm">${esc(o.farm)}</td><td><span class="badge ${o.dir === '반입' ? 'b-pur' : 'b-ok'}">${o.dir}</span></td><td>${o.qty}개</td><td>${esc(o.meth)}</td><td>${esc(o.feature || '-')}</td><td>${esc(o.staff || '-')}</td><td style="display:flex;gap:4px"><button class="btn edt" onclick="openExtEdit('${o.xt}',${o.id})">✏️</button><button class="btn del" onclick="delOwn(${o.id},'${o.dir === '반입' ? 'i' : 'o'}')">삭제</button></td></tr>`).join('') : emr(8, '기록 없음');
}

// ── 빈콘 회수
async function addBkCol() {
  const date = gv('bk-date'), farm = gv('bk-farm'), qty = n('bk-qty');
  if (!date || !farm || !qty) { alert('날짜, 농가명, 수량을 입력하세요'); return; }
  try {
    const drvName = gv('bk-drv');
    const drv = drivers.find(d => d.name === drvName);
    const row = await dbInsertPick({ date, farm, type: '빈콘회수', qty, driver: drvName || null, car: drv?.car || null, note: gv('bk-note') || null });
    picks.unshift(row);
    clr('bk-qty', 'bk-note');
    renderBkCol(); renderDash();
    openBkMsg({ date, farm, driver: drvName, qty, note: gv('bk-note') });
  } catch (e) { alert('오류: ' + e.message); }
}
async function delBkCol(id) {
  if (!cDel('빈콘 회수 삭제')) return;
  try { await dbDeletePick(id); picks = picks.filter(p => p.id !== id); renderBkCol(); renderDash(); }
  catch (e) { alert('오류: ' + e.message); }
}
function renderBkCol() {
  const list = picks.filter(p => p.type === '빈콘회수');
  const tb = document.getElementById('bk-tb'); if (!tb) return;
  tb.innerHTML = list.length ? list.map(p => `<tr>
    <td>${p.date}</td><td class="nm">${esc(p.farm)}</td>
    <td>${p.qty > 0 ? p.qty+'개' : '-'}</td><td>${esc(p.driver || '-')}</td>
    <td>${esc(p.note || '-')}</td>
    <td style="display:flex;gap:4px">
      ${p.driver ? `<button class="btn copy" style="padding:4px 8px" onclick="openBkMsg({date:'${p.date}',farm:'${p.farm.replace(/'/g,"\\'")}',driver:'${(p.driver||'').replace(/'/g,"\\'")}',qty:${p.qty},note:'${(p.note||'').replace(/'/g,"\\'")}',dtel:''})">📱</button>` : ''}
      <button class="btn del" onclick="delBkCol(${p.id})">삭제</button>
    </td>
  </tr>`).join('') : emr(6, '빈콘 회수 기록 없음');
}
function showToast(msg) {
  let el = document.getElementById('toast-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-msg';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;z-index:9999;opacity:0;transition:opacity .3s';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

// ── 농협
async function addNhfIn() {
  const date = gv('ni-date'), nhf = gv('ni-nhf'), type = gv('ni-type'), qty = n('ni-qty');
  if (!date || !nhf || !qty) { alert('반입일자, 농협명, 수량을 입력하세요'); return; }
  try {
    const row = await dbInsertNhfIn({ date, nhf, type, feature: gv('ni-feature'), qty, goods: gv('ni-goods'), staff: gv('ni-staff') });
    nhfIns.unshift(row); clr('ni-qty', 'ni-goods', 'ni-staff', 'ni-feature'); renderNhf(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}
async function addNhfOut() {
  const date = gv('no-date'), nhf = gv('no-nhf'), type = gv('no-type'), qty = n('no-qty');
  if (!date || !nhf || !qty) { alert('반납일자, 농협명, 수량을 입력하세요'); return; }
  try {
    const row = await dbInsertNhfOut({ date, nhf, type, method: gv('no-method'), feature: gv('no-feature'), qty, staff: gv('no-staff') });
    nhfOuts.unshift(row); clr('no-qty', 'no-staff', 'no-feature'); renderNhf(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}
async function delNhf(id, t) {
  if (!cDel(t === 'i' ? '반입 기록 삭제' : '반납 기록 삭제')) return;
  try {
    if (t === 'i') { await dbDeleteNhfIn(id); nhfIns = nhfIns.filter(o => o.id !== id); }
    else { await dbDeleteNhfOut(id); nhfOuts = nhfOuts.filter(o => o.id !== id); }
    renderNhf(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}
function gNhfSt(nhf, type) {
  const i = nhfIns.filter(o => o.nhf === nhf && o.type === type).reduce((s, o) => s + o.qty, 0);
  const o = nhfOuts.filter(o => o.nhf === nhf && o.type === type).reduce((s, o) => s + o.qty, 0);
  return { inQ: i, outQ: o, left: i - o };
}
function renderNhf() {
  const keys = [...new Set([...nhfIns.map(o => o.nhf + '||' + o.type), ...nhfOuts.map(o => o.nhf + '||' + o.type)])];
  const pend = keys.filter(k => { const [n, t] = k.split('||'); return gNhfSt(n, t).left > 0; });
  const done = keys.filter(k => { const [n, t] = k.split('||'); return gNhfSt(n, t).left <= 0; });
  const bg = document.getElementById('nhf-sum-badge');
  if (bg) { bg.textContent = pend.length > 0 ? `반납필요 ${pend.length}건` : '모두 정산완료'; bg.className = 'badge ' + (pend.length > 0 ? 'b-warn' : 'b-ok'); bg.style.textTransform = 'none'; bg.style.fontSize = '11px'; }
  let rows = '';
  if (pend.length) rows += pend.map(k => { const [nhf, type] = k.split('||'); const st = gNhfSt(nhf, type); return `<tr><td class="nm">${esc(nhf)}</td><td><span class="badge b-teal">${esc(type)}</span></td><td>${st.inQ}개</td><td>${st.outQ}개</td><td><span class="badge b-warn">${st.left}개</span></td><td><span class="badge b-warn">반납필요</span></td></tr>`; }).join('');
  if (done.length) { rows += `<tr class="ddiv"><td colspan="6">── 정산 완료 ──</td></tr>`; rows += done.map(k => { const [nhf, type] = k.split('||'); const st = gNhfSt(nhf, type); return `<tr class="dr"><td class="nm">${esc(nhf)}</td><td><span class="badge b-teal">${esc(type)}</span></td><td>${st.inQ}개</td><td>${st.outQ}개</td><td><span class="badge b-ok">${st.left}개</span></td><td><span class="badge b-ok">정산완료</span></td></tr>`; }).join(''); }
  document.getElementById('nhf-sum').innerHTML = rows || emr(6, '기록 없음');
  const all = [...nhfIns.map(o => ({ ...o, dir: '반입', xt: 'nhfIn', dm: o.goods ? '반입(' + o.goods + ')' : '-' })), ...nhfOuts.map(o => ({ ...o, dir: '반납', xt: 'nhfOut', dm: o.method || '-' }))].sort((a, b) => b.date > a.date ? 1 : -1);
  const tb = document.getElementById('nhf-tb-badge'); if (tb) tb.textContent = all.length + '건';
  document.getElementById('nhf-tb').innerHTML = all.length ? all.map(o => `<tr><td>${o.date}</td><td class="nm">${esc(o.nhf)}</td><td><span class="badge b-teal">${esc(o.type)}</span></td><td><span class="badge ${o.dir === '반입' ? 'b-teal' : 'b-ok'}">${o.dir}</span></td><td>${o.qty}개</td><td>${esc(o.dm)}</td><td>${esc(o.feature || '-')}</td><td>${esc(o.staff || '-')}</td><td style="display:flex;gap:4px"><button class="btn edt" onclick="openExtEdit('${o.xt}',${o.id})">✏️</button><button class="btn del" onclick="delNhf(${o.id},'${o.dir === '반입' ? 'i' : 'o'}')">삭제</button></td></tr>`).join('') : emr(9, '기록 없음');
}

// ── 기사 화면
function renderMyAssign() {
  if (!_loggedDrv) return;
  const el = document.getElementById('my-list');
  const mine = dispatches.filter(d => d.driver === _loggedDrv.name).sort((a, b) => b.date > a.date ? 1 : -1);
  if (!mine.length) { el.innerHTML = '<div class="note">배차된 업무가 없습니다</div>'; return; }
  el.innerHTML = mine.map(d => {
    const done = d.status === '배출완료';
    return `<div class="assign-card">
      <div class="assign-top"><div class="assign-title">📅 ${d.date} · ${esc(d.farm)}</div><span class="badge ${done ? 'b-ok' : 'b-info'}">${done ? '✅ 배출완료' : '대기중'}</span></div>
      <div class="assign-body">${ctB(d.ctype)} <strong>${d.qty}개</strong><br>🚛 차량: ${esc(d.car || '-')}<br>📍 주소: ${esc(gf(d.farm).addr || '농가에 직접 확인')}<br>📞 농가주: ${esc(gf(d.farm).tel || '-')}${d.harvest ? '<br>🗓 수확예정: ' + d.harvest : ''}${d.item ? '<br>🍊 품목: ' + esc(d.item) : ''}${d.note && d.note !== '[자동]' ? '<br>📝 ' + esc(d.note) : ''}</div>
      ${!done ? `<div style="display:flex;justify-content:flex-end"><button class="btn grn" onclick="drvDone(${d.id})">✅ 배출 완료 처리</button></div>` : ''}
    </div>`;
  }).join('');
}

function renderMyPending() {
  if (!_loggedDrv) return;
  const el = document.getElementById('my-pending-list');
  const pend = dispatches.filter(d => d.driver === _loggedDrv.name && d.status === '배차완료');
  if (!pend.length) { el.innerHTML = '<div class="note" style="margin-bottom:0">배출 대기 건이 없습니다 🎉</div>'; return; }
  el.innerHTML = `<div style="font-size:12px;font-weight:500;color:#888;margin-bottom:8px">📦 배출 대기 — 완료 처리 즉시 내역에 반영됩니다</div>` +
    pend.map(d => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#fff;border:0.5px solid #e0e0e0;border-radius:8px;margin-bottom:6px;gap:8px">
      <div><div style="font-weight:500">${esc(d.farm)}</div><div style="font-size:12px;color:#888">${d.date} · ${ctB(d.ctype)} ${d.qty}개${d.harvest ? ' · ' + d.harvest : ''}${d.item ? ' · ' + esc(d.item) : ''}</div></div>
      <button class="btn grn" onclick="drvDone(${d.id})">✅ 완료</button>
    </div>`).join('');
}

async function drvDone(id) {
  const d = dispatches.find(x => x.id === id); if (!d) return;
  try {
    await dbUpdateDispatch(id, { status: '배출완료' });
    dispatches = dispatches.map(x => x.id === id ? { ...x, status: '배출완료' } : x);
    if (!reports.find(r => r.driver === d.driver && r.farm === d.farm && r.date === d.date)) {
      const rpt = await dbInsertReport({ driver: d.driver, date: d.date, farm: d.farm, qty: d.qty, note: '앱에서 완료처리' });
      reports.unshift(rpt);
    }
    const c = document.getElementById('rep-cnt'); if (c) c.textContent = (_loggedDrv ? reports.filter(r=>r.driver===_loggedDrv.name).length : reports.length) + '건';
    if (!_repOpen) { _repOpen = true; document.getElementById('rep-history').style.display = ''; document.getElementById('rep-h-icon').textContent = '▲ 접기'; }
    renderRep(); renderMyPending(); renderMyAssign(); renderDisp(); renderDDash(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

function clearRepF() {
  const now = new Date();
  sv('rp-from', new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  sv('rp-to', now.toISOString().slice(0, 10));
  _rp = 1; renderRep();
}

async function addReport() {
  if (!_loggedDrv) return;
  const date = gv('rp-date'), farm = gv('rp-farm'), qty = n('rp-qty');
  if (!date || !farm || !qty) { alert('날짜, 농가명, 수량을 입력하세요'); return; }
  try {
    const rpt = await dbInsertReport({ driver: _loggedDrv.name, date, farm, qty, note: gv('rp-note') });
    reports.unshift(rpt);
    dispatches = dispatches.map(d => (d.driver === _loggedDrv.name && d.farm === farm && d.date === date) ? { ...d, status: '배출완료' } : d);
    await Promise.all(dispatches.filter(d => d.driver === _loggedDrv.name && d.farm === farm && d.date === date).map(d => dbUpdateDispatch(d.id, { status: '배출완료' })));
    clr('rp-qty', 'rp-note'); _rp = 1;
    if (!_repOpen) { _repOpen = true; document.getElementById('rep-history').style.display = ''; document.getElementById('rep-h-icon').textContent = '▲ 접기'; }
    renderRep(); renderMyPending(); renderDisp(); renderDDash(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

function renderRep() {
  const from = gv('rp-from'), to = gv('rp-to');
  let list = _loggedDrv ? reports.filter(r => r.driver === _loggedDrv.name) : reports;
  if (from) list = list.filter(r => r.date >= from);
  if (to) list = list.filter(r => r.date <= to);
  const page = list.slice((_rp - 1) * PER, _rp * PER);
  document.getElementById('rep-tb').innerHTML = page.length ? page.map(r => `<tr><td>${r.date}</td><td>${esc(r.driver)}</td><td class="nm">${esc(r.farm)}</td><td>${r.qty}개</td><td>${esc(r.note || '-')}</td></tr>`).join('') : emr(5, '내역 없음');
  mkPg('rep-pg', list.length, _rp, 'goRP');
  const c = document.getElementById('rep-cnt');
  if (c) c.textContent = (_loggedDrv ? reports.filter(r => r.driver === _loggedDrv.name).length : reports.length) + '건';
}

// ── 현황판
function getFCS(name) {
  const out = picks.filter(p => p.farm === name && p.type === '배출').reduce((s, p) => s + p.qty, 0);
  const pk = picks.filter(p => p.farm === name && p.type === '원물수거').reduce((s, p) => s + p.qty, 0);
  const ret = picks.filter(p => p.farm === name && p.type === '잉여회수').reduce((s, p) => s + p.qty, 0);
  return { out, pk, ret, hold: out - pk - ret };
}
function getFCtypes(fn) {
  const ob = {}; dispatches.filter(d => d.farm === fn).forEach(d => { ob[d.ctype] = (ob[d.ctype] || 0) + d.qty; });
  const rec = picks.filter(p => p.farm === fn && (p.type === '원물수거' || p.type === '잉여회수')).reduce((s, p) => s + p.qty, 0);
  const tot = Object.values(ob).reduce((s, v) => s + v, 0); if (tot <= 0) return '';
  const ratio = tot > 0 ? (tot - rec) / tot : 0;
  return Object.entries(ob).map(([t, q]) => { const r = Math.round(q * ratio); if (r <= 0) return ''; const cl = { 노랑: 'cty', 초록: 'ctg', 헌콘: 'cto' }[t] || ''; return `<span class="ct ${cl}">${t === '노랑' ? '🟡' : t === '초록' ? '🟢' : '⬜'} ${r}개</span>`; }).filter(Boolean).join('');
}
function renderFarmTbl() {
  const list = farms.filter(f => { const st = getFCS(f.name); return _ft === 'n' ? st.hold !== 0 : st.hold === 0; });
  document.getElementById('d-farm-tb').innerHTML = list.length ? list.map(f => { const st = getFCS(f.name); return `<tr><td class="nm">${esc(f.name)}${f.addr ? `<div style="font-size:10px;color:#aaa;font-weight:400;margin-top:1px">${esc(f.addr)}</div>` : ''}</td><td>${st.out}</td><td>${st.pk}</td><td>${st.ret}</td><td><span class="badge ${st.hold !== 0 ? (st.hold < 0 ? 'b-red' : 'b-warn') : 'b-ok'}">${st.hold}개</span></td><td>${st.hold > 0 ? '<span class="badge b-red">처리필요</span>' : st.hold < 0 ? '<span class="badge b-red">음수(확인필요)</span>' : '<span class="badge b-ok">정상</span>'}</td></tr>`; }).join('') : emr(6, _ft === 'n' ? '처리 필요 농가 없음 🎉' : '없음');
  const need = farms.filter(f => getFCS(f.name).hold !== 0).length;
  document.getElementById('farm-dash-badges').innerHTML = `<span class="badge b-red">처리필요 ${need}개 농가</span><span class="badge b-ok">정상 ${farms.length - need}개 농가</span>`;
}

function renderDash() {
  const dw = dispatches.filter(d => d.status === '배차완료').length, dd = dispatches.filter(d => d.status === '배출완료').length;
  const th = farms.reduce((s, f) => s + getFCS(f.name).hold, 0);
  const on = [...new Set(ownIns.map(o => o.farm))]; const to = on.reduce((s, n) => s + gOwnSt(n).left, 0);
  const nk = [...new Set([...nhfIns.map(o => o.nhf + '||' + o.type), ...nhfOuts.map(o => o.nhf + '||' + o.type)])];
  const nc = nk.filter(k => k.includes('콘테이너')).reduce((s, k) => { const [n, t] = k.split('||'); return s + gNhfSt(n, t).left; }, 0);
  const np = nk.filter(k => k.includes('파렛트')).reduce((s, k) => { const [n, t] = k.split('||'); return s + gNhfSt(n, t).left; }, 0);
  document.getElementById('kpi').innerHTML = `<div class="kpi"><div class="kpi-label">배출 대기</div><div class="kpi-val kv-pu">${dw}</div></div><div class="kpi"><div class="kpi-label">배출 완료</div><div class="kpi-val kv-gr">${dd}</div></div><div class="kpi"><div class="kpi-label">농가보유</div><div class="kpi-val kv-bl">${th}개</div></div><div class="kpi"><div class="kpi-label">자가 공장보유</div><div class="kpi-val kv-pu">${to}개</div></div><div class="kpi"><div class="kpi-label">농협 콘테이너</div><div class="kpi-val kv-teal">${nc}개</div></div><div class="kpi"><div class="kpi-label">농협 파렛트</div><div class="kpi-val kv-teal">${np}개</div></div>`;
  renderSC();
  const fhi = farms.map(f => { const st = getFCS(f.name); const ow = gOwnSt(f.name); const total = st.hold + ow.left; if (total <= 0) return null; return { name: f.name, ctypes: getFCtypes(f.name), ownLeft: ow.left, total }; }).filter(Boolean);
  const ri = nk.map(k => { const [nhf, type] = k.split('||'); const st = gNhfSt(nhf, type); return st.left > 0 ? { name: nhf, detail: `${type} ${st.left}개 반납필요`, total: st.left } : null; }).filter(Boolean);
  const tfTotal = fhi.reduce((s, i) => s + i.total, 0);
  const trTotal = ri.reduce((s, i) => s + i.total, 0);
  document.getElementById('afc').textContent = fhi.length + '곳 · ' + tfTotal + '개';
  document.getElementById('arc').textContent = ri.length + '건 · ' + trTotal + '개';
  document.getElementById('afb').innerHTML = fhi.length ? fhi.map(i => {
    const st = getFCS(i.name);
    return `<div class="alert-item"><div class="alert-item-top"><div class="alert-item-name">${esc(i.name)}</div><span class="alert-cnt w">${i.total}개</span></div>
    <div style="font-size:10px;color:#aaa;margin:2px 0">배출 ${st.out}개 − 원물수거 ${st.pk}개 − 잉여회수 ${st.ret}개 = <strong style="color:#C05800">${st.hold}개</strong> 보유</div>
    <div class="alert-item-ctypes">${i.ctypes || '<span style="font-size:11px;color:#aaa">데이터 없음</span>'}${i.ownLeft > 0 ? `<span class="ct" style="background:#F3E5F5;color:#6A1B9A">자가 ${i.ownLeft}개</span>` : ''}</div></div>`;
  }).join('') : '<div class="alert-none">처리 필요 없음 🎉</div>';
  document.getElementById('arb').innerHTML = ri.length ? ri.map(i => `<div class="alert-item"><div class="alert-item-top"><div class="alert-item-name">${esc(i.name)}</div><span class="alert-cnt g">${i.total}개</span></div><div style="font-size:12px;color:#888">${esc(i.detail)}</div></div>`).join('') : '<div class="alert-none">반납 필요 없음</div>';
  document.getElementById('alert-badges').innerHTML = `<span class="badge b-warn">🟡 농가보유 ${fhi.length}곳 · ${tfTotal}개</span><span class="badge b-ok">🟢 반납필요 ${ri.length}건 · ${trTotal}개</span>`;
  renderDDash(); renderFarmTbl();
  const or = on.map(n => { const st = gOwnSt(n); return st.left > 0 ? `<div class="ext-row"><span>${esc(n)}</span><span class="ext-warn">${st.left}개</span></div>` : ''; }).filter(Boolean).join('');
  const nr = nk.map(k => { const [n, t] = k.split('||'); const st = gNhfSt(n, t); return st.left > 0 ? `<div class="ext-row"><span>${esc(n)} (${esc(t)})</span><span class="ext-warn">${st.left}개</span></div>` : ''; }).filter(Boolean).join('');
  document.getElementById('ext-cards').innerHTML = `<div class="ext-card"><div class="ext-card-title"><span class="badge b-pur">농가 자가 콘테이너</span></div>${or || '<div style="font-size:13px;color:#aaa">없음</div>'}</div><div class="ext-card"><div class="ext-card-title"><span class="badge b-teal">농협 용기 반납 필요</span></div>${nr || '<div style="font-size:13px;color:#aaa">없음</div>'}</div>`;
  const oc = on.filter(n => gOwnSt(n).left > 0).length, nc2 = nk.filter(k => { const [n, t] = k.split('||'); return gNhfSt(n, t).left > 0; }).length;
  document.getElementById('ext-dash-badges').innerHTML = `<span class="badge b-pur">자가 ${oc}개 농가</span><span class="badge b-teal">농협 ${nc2}건 반납필요</span>`;
  // 빈콘 회수 현황
  const bkList = picks.filter(p => p.type === '빈콘회수').slice(0, 10);
  const bkTotal = picks.filter(p => p.type === '빈콘회수').reduce((s, p) => s + p.qty, 0);
  const bkDl = document.getElementById('bk-dash-list');
  if (bkDl) {
    bkDl.innerHTML = bkList.length ? `<div class="tbl-wrap"><table><thead><tr><th>날짜</th><th>농가명</th><th>수량</th><th>기사</th><th>비고</th></tr></thead><tbody>${bkList.map(p => `<tr><td>${p.date}</td><td class="nm">${esc(p.farm)}</td><td>${p.qty}개</td><td>${esc(p.driver || '-')}</td><td>${esc(p.note || '-')}</td></tr>`).join('')}</tbody></table></div>` : '<div style="padding:12px;font-size:13px;color:#aaa">빈콘 회수 기록 없음</div>';
  }
  const bkBadge = document.getElementById('bk-dash-badges');
  if (bkBadge) bkBadge.innerHTML = `<span class="badge b-neu">총 ${picks.filter(p => p.type === '빈콘회수').length}건</span><span class="badge b-ok">누적 ${bkTotal}개 회수</span>`;
}

function renderAll() { renderDash(); renderFarm(); renderDrivers(); renderVehicles(); renderDisp(); renderPick(); renderOwn(); renderNhf(); renderBkCol(); renderAdmPinChange(); }

let _dbView = 'sched';
function switchDBView(v) {
  _dbView = v;
  document.getElementById('dbv-sched').className = 'dtab' + (v === 'sched' ? ' active' : '');
  document.getElementById('dbv-card').className  = 'dtab' + (v === 'card'  ? ' active' : '');
  document.getElementById('dboard-sched').style.display = v === 'sched' ? '' : 'none';
  document.getElementById('dboard-body').style.display  = v === 'card'  ? '' : 'none';
  if (v === 'sched') renderDSchedule();
  else renderDBoard();
}

function renderDSchedule() {
  const el = document.getElementById('dboard-sched'); if (!el) return;
  const today = new Date().toISOString().slice(0, 10);

  // 오늘 → D-1 → D-2 → D-3 → D-4 순
  const dates = [];
  for (let i = 0; i <= 4; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const active = drivers.filter(d => d.pin_active !== false);
  if (!active.length) { el.innerHTML = '<div style="padding:20px;color:#aaa;text-align:center">등록된 기사가 없습니다</div>'; return; }

  const dayLabel = (date) => {
    if (date === today) return `<div style="font-size:11px;font-weight:700;color:#C05800">오늘</div><div style="font-size:10px;color:#C05800">${date.slice(5).replace('-','/')}</div>`;
    const diff = Math.round((new Date(today) - new Date(date)) / 86400000);
    const names = ['', '어제', '그제'];
    const label = names[diff] || `D-${diff}`;
    return `<div style="font-size:10px;color:#888;font-weight:600">${label}</div><div style="font-size:10px;color:#aaa">${date.slice(5).replace('-','/')}</div>`;
  };

  function cell(drv, date) {
    const items = dispatches.filter(d => d.driver === drv.name && d.date === date);
    if (!items.length) return `<td style="background:${date===today?'#FFFDE7':'#fafafa'};text-align:center;color:#ddd;font-size:18px">—</td>`;
    const cards = items.map(d => {
      const done = d.status === '배출완료';
      const bg = done ? '#F1F8E9' : '#FFF8F0';
      const border = done ? '#C8E6C9' : '#FFE0B2';
      return `<div style="background:${bg};border:1px solid ${border};border-radius:6px;padding:4px 7px;margin-bottom:3px;font-size:11px;line-height:1.5">
        <div style="font-weight:600;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px">${esc(d.farm)}</div>
        <div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:2px">
          ${d.timeslot ? tsBadge(d.timeslot) : ''}
          ${d.trip ? tripBadge(d.trip) : ''}
          ${done ? '<span style="font-size:9px;color:#2E7D32;font-weight:600">✅완료</span>' : ''}
        </div>
        <div style="color:#666;font-size:10px;margin-top:1px">${d.qty > 0 ? d.qty+'개 ' : '미정 '}${ctB(d.ctype)}</div>
      </div>`;
    }).join('');
    return `<td style="background:${date===today?'#FFFDE7':'#fff'};vertical-align:top;padding:6px;min-width:120px">${cards}</td>`;
  }

  // 기간 내 배차 있는 기사 / 없는 기사 분리
  const withWork = active.filter(drv => dates.some(date => dispatches.some(d => d.driver === drv.name && d.date === date)));
  const noWork   = active.filter(drv => !dates.some(date => dispatches.some(d => d.driver === drv.name && d.date === date)));

  const headerCells = dates.map(date =>
    `<th style="text-align:center;background:${date===today?'#FFF3E0':'#f8f8f8'};padding:8px 10px;min-width:120px">${dayLabel(date)}</th>`
  ).join('');

  const rows = withWork.map(drv => `<tr>
    <td style="background:#fafafa;padding:8px 12px;white-space:nowrap;position:sticky;left:0;z-index:1;border-right:1px solid #e0e0e0">
      <div style="font-size:13px;font-weight:600">${esc(drv.name)}</div>
      <div style="display:flex;gap:4px;margin-top:2px">
        <span class="badge ${drv.type==='외부'?'b-pur':'b-ok'}" style="font-size:9px">${drv.type||'내부'}</span>
        ${drv.car ? `<span style="font-size:10px;color:#aaa">${esc(drv.car)}</span>` : ''}
      </div>
    </td>
    ${dates.map(date => cell(drv, date)).join('')}
  </tr>`).join('');

  const noWorkList = noWork.length ? `
    <div style="margin-top:14px;background:#fff;border-radius:10px;border:1px solid #e0e0e0;padding:12px 16px">
      <div style="font-size:11px;color:#aaa;font-weight:600;margin-bottom:8px">이 기간 배차 없음 (${noWork.length}명)</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${noWork.map(drv => `<span style="font-size:12px;padding:4px 10px;background:#f5f5f5;border-radius:20px;color:#888">
          ${esc(drv.name)} <span style="font-size:10px;color:#bbb">${drv.type||'내부'}</span>
        </span>`).join('')}
      </div>
    </div>` : '';

  el.innerHTML = `
    <div class="tbl-wrap"><table style="min-width:0">
      <thead><tr>
        <th style="background:#f8f8f8;padding:8px 12px;position:sticky;left:0;z-index:2;min-width:90px">기사</th>
        ${headerCells}
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="${dates.length+1}" style="text-align:center;padding:20px;color:#aaa;font-size:13px">이 기간 배차 없음</td></tr>`}</tbody>
    </table></div>
    ${noWorkList}`;
}

function renderDBoard() {
  const el = document.getElementById('dboard-body'); if (!el) return;
  const today = new Date().toISOString().slice(0, 10);

  // 기사별로 배출 대기 배차 묶기
  const active = drivers.filter(d => d.pin_active !== false);
  if (!active.length) { el.innerHTML = '<div style="padding:20px;color:#aaa;text-align:center">등록된 기사가 없습니다</div>'; return; }

  const pending = dispatches.filter(d => d.status === '배차완료');
  const done    = dispatches.filter(d => d.status === '배출완료');

  // 배출 대기 있는 기사 먼저, 없는 기사 뒤에
  const withWork = active.filter(drv => pending.some(d => d.driver === drv.name));
  const noWork   = active.filter(drv => !pending.some(d => d.driver === drv.name));

  function driverCard(drv) {
    const myPending = pending.filter(d => d.driver === drv.name).sort((a, b) => a.date > b.date ? 1 : -1);
    const myDone    = done.filter(d => d.driver === drv.name).length;
    const typeBadge = `<span class="badge ${drv.type === '외부' ? 'b-pur' : 'b-ok'}" style="font-size:10px">${drv.type || '내부'}</span>`;
    const hasPending = myPending.length > 0;

    const rows = hasPending ? myPending.map(d => {
      const farm = gf(d.farm);
      const isToday = d.date === today;
      const isBefore = d.date < today;
      const dateStyle = isBefore ? 'color:#C62828;font-weight:600' : isToday ? 'color:#C05800;font-weight:600' : 'color:#555';
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border-bottom:0.5px solid #f5f5f5;flex-wrap:wrap">
        <div style="min-width:60px;text-align:center">
          <div style="font-size:11px;${dateStyle}">${d.date.slice(5).replace('-','/')}</div>
          ${isToday ? '<div style="font-size:9px;color:#C05800;font-weight:600">오늘</div>' : isBefore ? '<div style="font-size:9px;color:#C62828">지연</div>' : ''}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:#222">${esc(d.farm)}${d.trip ? ` ${tripBadge(d.trip)}` : ''}</div>
          ${farm.addr ? `<div style="font-size:10px;color:#aaa;margin-top:1px">${esc(farm.addr)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;min-width:70px">
          <div style="font-size:12px;font-weight:500">${d.qty > 0 ? d.qty+'개' : '<span style="color:#E65100">수량 미정</span>'}</div>
          <div style="font-size:11px">${ctB(d.ctype)}</div>
        </div>
      </div>`;
    }).join('') : `<div style="padding:12px;font-size:12px;color:#aaa;text-align:center">배출 대기 없음</div>`;

    const borderColor = hasPending ? (myPending.some(d => d.date < today) ? '#C62828' : '#C05800') : '#e0e0e0';
    return `<div style="background:#fff;border-radius:12px;border:1px solid ${borderColor};overflow:hidden;margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:${hasPending ? '#FFF8F0' : '#fafafa'};flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-size:15px;font-weight:700;color:#222">${esc(drv.name)}</div>
          ${typeBadge}
          ${drv.car ? `<span style="font-size:11px;color:#888">${esc(drv.car)}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${drv.tel ? `<span style="font-size:11px;color:#888">${esc(drv.tel)}</span>` : ''}
          ${hasPending ? `<span class="badge b-warn" style="font-size:11px">대기 ${myPending.length}건</span>` : '<span class="badge b-ok" style="font-size:11px">대기 없음</span>'}
          <span style="font-size:11px;color:#aaa">완료 ${myDone}건</span>
        </div>
      </div>
      ${rows}
    </div>`;
  }

  let html = '';
  if (withWork.length) {
    html += `<div style="font-size:11px;color:#888;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">배출 대기 ${withWork.length}명</div>`;
    html += withWork.map(driverCard).join('');
  }
  if (noWork.length) {
    html += `<div style="font-size:11px;color:#bbb;font-weight:600;margin:16px 0 8px;text-transform:uppercase;letter-spacing:.5px">대기 없음 ${noWork.length}명</div>`;
    html += noWork.map(driverCard).join('');
  }
  el.innerHTML = html;
}
// ── 수확 캘린더
const CAL_PER = 5;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelectedDate = null;
let calUpPage = 1;

function calSortOrder(s) { return s === '배차없음' ? 0 : s === '배차완료' ? 1 : 2; }
function calGoDisp(farm, harvestDate, item) {
  T('disp'); switchPT('disp');
  const fd = document.getElementById('dp-farm');
  if (fd) { fd.value = farm; afF('dp'); }
  const hd = document.getElementById('dp-harvest');
  if (hd) hd.value = harvestDate || '';
  const it = document.getElementById('dp-item');
  if (it && item) it.value = item;
  document.getElementById('p-disp')?.querySelector('.form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function calSortItems(arr) {
  return [...arr].sort((a, b) => {
    const od = calSortOrder(a.status) - calSortOrder(b.status);
    if (od !== 0) return od;
    return (a.harvest || '') > (b.harvest || '') ? 1 : -1;
  });
}
function calFmtShort(s) {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function calGetEvents(dStr) {
  const fromDisp = dispatches.filter(d => d.harvest === dStr);
  const fromHarvest = harvests.filter(h => h.date === dStr).map(h => ({
    ...h, harvest: h.date, driver: null, qty: null, ctype: null, status: '배차없음'
  }));
  const dispFarms = fromDisp.map(d => d.farm);
  const extra = fromHarvest.filter(h => !dispFarms.includes(h.farm));
  return [...fromDisp, ...extra];
}
function calGetAllItems() {
  const mStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const fromDisp = dispatches.filter(d => d.harvest && d.harvest.startsWith(mStr));
  const fromHarvest = harvests.filter(h => h.date && h.date.startsWith(mStr)).map(h => ({
    ...h, harvest: h.date, driver: null, qty: null, ctype: null, status: '배차없음'
  }));
  const dispFarms = fromDisp.map(d => d.farm + d.harvest);
  const extra = fromHarvest.filter(h => !dispFarms.includes(h.farm + h.date));
  return calSortItems([...fromDisp, ...extra]);
}
function renderCal() {
  if (!document.getElementById('p-cal')?.classList.contains('active')) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  document.getElementById('cal-month-title').textContent = `${calYear}년 ${months[calMonth]}`;

  // 통계
  const done = dispatches.filter(d => d.status === '배출완료').length;
  const pend = dispatches.filter(d => d.status === '배차완료').length;
  const none = dispatches.filter(d => !d.harvest || !d.status).length;
  const mStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const thisM = dispatches.filter(d => d.harvest && d.harvest.startsWith(mStr)).length;
  document.getElementById('cal-stats-row').innerHTML = `
    <div class="kpi"><div class="kpi-label">배출 완료</div><div class="kpi-val kv-gr">${done}</div></div>
    <div class="kpi"><div class="kpi-label">배출 대기</div><div class="kpi-val kv-pu">${pend}</div></div>
    <div class="kpi"><div class="kpi-label">배차 없음</div><div class="kpi-val" style="color:#C62828">${dispatches.filter(d=>d.status==='배차없음').length}</div></div>
    <div class="kpi"><div class="kpi-label">이번 달 수확</div><div class="kpi-val kv-bl">${thisM}</div></div>
  `;

  // 공통 헬퍼
  const stBadge = { 수확전: 'b-warn', 수확중: 'b-info', 수확완료: 'b-ok' };
  const stBg    = { 수확전: '#FFF3E0', 수확중: '#EFF8FF', 수확완료: '#F1F8E9' };
  function harvestRow(h, showDate) {
    const st = h.status || '수확전';
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:${stBg[st]||'#FFF3E0'};border-radius:8px;border:0.5px solid #e0e0e0;flex-wrap:wrap">
      ${showDate ? `<span style="font-size:11px;font-weight:600;color:#888;min-width:38px">${h.date.slice(5).replace('-','/')}</span>` : ''}
      ${h.end_date ? `<span style="font-size:10px;color:#bbb">~ ${h.end_date.slice(5).replace('-','/')}</span>` : ''}
      <span style="font-size:13px;font-weight:700">${esc(h.farm)}</span>
      ${h.item ? `<span style="font-size:11px;color:#888">${esc(h.item)}</span>` : ''}
      <span class="badge ${stBadge[st]||'b-warn'}" style="font-size:10px">${st}</span>
      <div style="margin-left:auto;display:flex;gap:4px;flex-wrap:wrap">
        ${st !== '수확중'  ? `<button class="btn" style="font-size:11px;padding:3px 10px;background:#1565C0;color:#fff;border:none;border-radius:6px" onclick="setHarvestStatus(${h.id},'수확중')">▶ 시작</button>` : ''}
        ${st !== '수확완료' ? `<button class="btn grn" style="font-size:11px;padding:3px 10px" onclick="setHarvestStatus(${h.id},'수확완료')">✅ 완료</button>` : ''}
        <button class="btn edt" style="font-size:11px;padding:3px 8px" onclick="openHarvestEdit(${h.id})">✏️</button>
        <button class="btn del" style="font-size:11px;padding:3px 8px" onclick="delHarvest(${h.id})">삭제</button>
      </div>
    </div>`;
  }

  // 금일 수확일정
  // 금일 수확일정: 캘린더와 동일하게 dispatches.harvest + harvests 테이블 통합
  const calTodayEvents = calGetEvents(todayStr);
  // 수확중이지만 오늘 날짜가 아닌 항목도 추가 (진행 중 carry-forward)
  const ongoingHarvests = harvests.filter(h =>
    h.status === '수확중' && h.date < todayStr &&
    !calTodayEvents.find(e => e.farm === h.farm)
  );
  const allTodayItems = [...calTodayEvents, ...ongoingHarvests];

  const todayEl = document.getElementById('cal-today-strip');
  if (todayEl) {
    if (allTodayItems.length) {
      todayEl.style.display = '';
      const rows = allTodayItems.map(e => {
        const hEntry = harvests.find(h => h.farm === e.farm && (h.date === todayStr || h.status === '수확중'));
        if (hEntry) return harvestRow(hEntry, false);
        // 배차에서만 온 항목 — auto-create 버튼 포함
        const st = e.status || '수확전';
        const item = e.item || '';
        const farmEsc = e.farm.replace(/'/g, "\\'");
        const itemEsc = item.replace(/'/g, "\\'");
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#FFF8F0;border-radius:8px;border:0.5px solid #FFE0B2;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:700">${esc(e.farm)}</span>
          ${item ? `<span style="font-size:11px;color:#888">${esc(item)}</span>` : ''}
          <span class="badge b-warn" style="font-size:10px">수확전</span>
          <div style="margin-left:auto;display:flex;gap:4px">
            <button class="btn" style="font-size:11px;padding:3px 10px;background:#1565C0;color:#fff;border:none;border-radius:6px" onclick="autoSetHarvestStatus('${farmEsc}','${todayStr}','${itemEsc}','수확중')">▶ 시작</button>
            <button class="btn grn" style="font-size:11px;padding:3px 10px" onclick="autoSetHarvestStatus('${farmEsc}','${todayStr}','${itemEsc}','수확완료')">✅ 완료</button>
            <button class="btn edt" style="font-size:11px;padding:3px 8px" onclick="autoOpenHarvestEdit('${farmEsc}','${todayStr}','${itemEsc}')">✏️</button>
            <button class="btn del" style="font-size:11px;padding:3px 8px" onclick="autoDelHarvest('${farmEsc}','${todayStr}')">삭제</button>
          </div>
        </div>`;
      }).join('');
      todayEl.innerHTML =
        `<div style="font-size:12px;font-weight:700;color:#C05800;margin-bottom:8px">📅 금일 수확 일정 (${allTodayItems.length}건)</div>` +
        `<div style="display:flex;flex-direction:column;gap:5px">${rows}</div>`;
    } else {
      todayEl.style.display = 'none';
    }
  }

  // 이번달 수확일정 목록
  const monthEl = document.getElementById('cal-month-list');
  if (monthEl) {
    const monthHarvests = harvests.filter(h => h.date && h.date.startsWith(mStr)).sort((a, b) => a.date > b.date ? 1 : -1);
    monthEl.innerHTML = monthHarvests.length
      ? `<div style="font-size:12px;font-weight:700;color:#555;margin-bottom:8px">📋 이번달 수확 일정 (${monthHarvests.length}건)</div>
         <div style="display:flex;flex-direction:column;gap:5px">${monthHarvests.map(h => harvestRow(h, true)).join('')}</div>`
      : `<div style="font-size:12px;color:#aaa;padding:4px 0">이번달 수확 일정 없음</div>`;
  }

  // 경고
  const noD = dispatches.filter(d => d.status === '배차없음').length;
  const strip = document.getElementById('cal-alert-strip');
  if (noD > 0) { strip.style.display = 'flex'; strip.innerHTML = `⚠ 배차 없는 수확 예정 <strong style="margin:0 3px">${noD}곳</strong> — 빨간 일정을 확인하세요.`; }
  else strip.style.display = 'none';

  // 달력 헤더
  document.getElementById('cal-head-grid').innerHTML = ['일','월','화','수','목','금','토'].map(d =>
    `<div style="text-align:center;font-size:11px;font-weight:500;color:#888;padding:4px 0">${d}</div>`
  ).join('');

  // 달력 셀
  const first = new Date(calYear, calMonth, 1);
  const last = new Date(calYear, calMonth + 1, 0);
  const startDay = first.getDay();
  let cells = '';
  const cellStyle = 'min-height:72px;border-radius:8px;border:0.5px solid #e0e0e0;background:#fff;padding:4px;cursor:pointer';
  const otherStyle = 'min-height:72px;border-radius:8px;border:0.5px solid #e0e0e0;background:#f5f5f5;padding:4px;opacity:.4';

  for (let i = 0; i < startDay; i++) {
    const d = new Date(calYear, calMonth, -startDay + i + 1);
    cells += `<div style="${otherStyle}"><div style="font-size:11px;color:#aaa">${d.getDate()}</div></div>`;
  }
  for (let i = 1; i <= last.getDate(); i++) {
    const dStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const evs = calSortItems(calGetEvents(dStr));
    const isToday = dStr === todayStr;
    const isSel = dStr === calSelectedDate;
    let pills = evs.slice(0, 2).map(e => {
      const bg = e.status === '배출완료' ? '#E8F5E9;color:#2E7D32' : e.status === '배차없음' ? '#FFEBEE;color:#C62828' : '#FFF3E0;color:#C05800';
      return `<div style="font-size:10px;padding:2px 5px;border-radius:4px;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:${bg}">${esc(e.farm)}</div>`;
    }).join('');
    if (evs.length > 2) pills += `<div style="font-size:10px;padding:2px 5px;border-radius:4px;background:#f0f0f0;color:#888">+${evs.length - 2}</div>`;
    const border = isToday ? '1.5px solid #C05800' : isSel ? '1.5px solid #C05800' : '0.5px solid #e0e0e0';
    const bg = isSel ? '#f8f8f8' : '#fff';
    cells += `<div style="min-height:72px;border-radius:8px;border:${border};background:${bg};padding:4px;cursor:pointer" onclick="calSelectDay('${dStr}')">
      <div style="font-size:11px;font-weight:500;color:${isToday ? '#C05800' : '#888'};margin-bottom:2px">${i}</div>${pills}
    </div>`;
  }
  const rem = 7 - ((startDay + last.getDate()) % 7);
  if (rem < 7) for (let i = 1; i <= rem; i++) cells += `<div style="${otherStyle}"><div style="font-size:11px;color:#aaa">${i}</div></div>`;
  document.getElementById('cal-body-grid').innerHTML = cells;

  // 수확 일정 등록 폼
  const formEl = document.getElementById('cal-add-form');
  if (formEl) {
    const sf = document.getElementById('cal-add-farm');
    if (sf) {
      sf.innerHTML = '<option value="">농가 선택</option>';
      farms.forEach(f => sf.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`);
    }
  }
  renderCalUpcoming();
}

function calSelectDay(dStr) {
  calSelectedDate = calSelectedDate === dStr ? null : dStr;
  const panel = document.getElementById('cal-detail-panel');
  const evs = calSortItems(calGetEvents(dStr));
  if (!calSelectedDate || evs.length === 0) { panel.style.display = 'none'; renderCal(); return; }
  const d = new Date(dStr + 'T00:00:00');
  document.getElementById('cal-detail-title').textContent = `${d.getMonth()+1}월 ${d.getDate()}일 수확 예정 (${evs.length}건)`;
  const ctIcon = {노랑:'🟡',초록:'🟢',헌콘:'⬜'};
  document.getElementById('cal-detail-list').innerHTML = evs.map(e => {
    const bg = e.status === '배출완료' ? '#F1F8E9' : e.status === '배차없음' ? '#FFEBEE' : '#FFF3E0';
    const bdg = e.status === '배출완료' ? 'b-ok' : e.status === '배차없음' ? 'b-danger' : 'b-warn';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:${bg};margin-bottom:5px;gap:8px;flex-wrap:wrap">
      <div>
        <div style="font-weight:500;font-size:13px">${esc(e.farm)} <span style="font-weight:400;font-size:12px;color:#888">· ${esc(e.item||'-')}</span></div>
        <div style="font-size:11px;color:#888;margin-top:2px">${e.driver?'기사: '+esc(e.driver)+' · ':''} ${e.ctype?ctIcon[e.ctype]+' '+esc(e.ctype)+' '+e.qty+'개 · ':''} ${e.date?'배출일: '+calFmtShort(e.date):'배출일 미정'}</div>
      </div>
      <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
        ${e.status === '배차없음' ? `<button class="btn pri" style="font-size:11px;padding:4px 10px;white-space:nowrap" onclick="calGoDisp('${e.farm.replace(/'/g,"&#39;")}','${e.harvest||''}','${(e.item||'').replace(/'/g,"&#39;")}')">+ 배차 등록</button><button class="btn edt" style="font-size:11px;padding:4px 8px" onclick="openHarvestEdit(${e.id})">✏️</button><button class="btn del" style="font-size:11px;padding:4px 8px" onclick="delHarvest(${e.id})">삭제</button>` : `<span class="badge ${bdg}">${e.status}</span>`}
      </div>
    </div>`;
  }).join('');
  panel.style.display = 'block';
  renderCal();
}
function itemColor(item) {
  const map = {
    '노지감귤': 'background:#FFF3E0;color:#E65100',
    '하우스감귤': 'background:#E8F5E9;color:#1B5E20',
    '한라봉': 'background:#F3E5F5;color:#6A1B9A',
    '천혜향': 'background:#E3F2FD;color:#0D47A1',
    '레드향': 'background:#FCE4EC;color:#880E4F',
    '황금향': 'background:#FFFDE7;color:#F57F17',
    '청견': 'background:#E0F2F1;color:#004D40',
    '세토카': 'background:#FBE9E7;color:#BF360C',
  };
  return map[item] || 'background:#F5F5F5;color:#555';
}

function renderCalUpcoming() {
  const all = calGetAllItems();
  const total = all.length;
  document.getElementById('cal-up-count').textContent = `총 ${total}건`;
  const el = document.getElementById('cal-upcoming-list');
  if (!total) { el.innerHTML = `<div style="text-align:center;color:#aaa;font-size:13px;padding:16px">이번 달 수확 일정이 없습니다</div>`; document.getElementById('cal-pg-bar').style.display = 'none'; return; }
  const pages = Math.ceil(total / CAL_PER);
  if (calUpPage > pages) calUpPage = 1;
  const page = all.slice((calUpPage - 1) * CAL_PER, calUpPage * CAL_PER);
  const ctIcon = {노랑:'🟡',초록:'🟢',헌콘:'⬜'};
  el.innerHTML = page.map(e => {
    const lColor = e.status === '배출완료' ? '#43A047' : e.status === '배차없음' ? '#EF5350' : '#F28C28';
    const bdg = e.status === '배출완료' ? 'b-ok' : e.status === '배차없음' ? 'b-danger' : 'b-warn';
    const dispBox = e.date
      ? `<div style="font-size:10px;font-weight:500;text-align:center;border-radius:5px;padding:3px 4px;background:#E8F5E9;color:#2E7D32;white-space:nowrap">${calFmtShort(e.date)}</div><div style="font-size:9px;text-align:center;color:#aaa">배출일</div>`
      : `<div style="font-size:10px;font-weight:500;text-align:center;border-radius:5px;padding:3px 4px;background:#FFEBEE;color:#C62828;white-space:nowrap">미정</div><div style="font-size:9px;text-align:center;color:#aaa">배출일</div>`;
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 14px;border-bottom:0.5px solid #f0f0f0;border-left:3px solid ${lColor}">
      <div style="display:flex;flex-direction:column;gap:3px;min-width:46px">
        <div style="font-size:10px;font-weight:500;text-align:center;border-radius:5px;padding:3px 4px;background:#E3F2FD;color:#1565C0;white-space:nowrap">${calFmtShort(e.harvest)}</div>
        <div style="font-size:9px;text-align:center;color:#aaa">수확일</div>
        ${dispBox}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:14px;color:#222">${esc(e.farm)} ${e.item ? `<span style="font-weight:500;font-size:11px;padding:2px 7px;border-radius:4px;margin-left:4px;${itemColor(e.item)}">${esc(e.item)}</span>` : ''}</div>
        <div style="font-size:11px;color:#888;margin-top:3px">${e.driver?'👤 '+esc(e.driver)+' &nbsp;':''} ${e.ctype?ctB(e.ctype)+' <strong>'+e.qty+'개</strong>':''}</div>
      </div>
     <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
       ${e.status === '배차없음' ? `<button class="btn pri" style="font-size:11px;padding:4px 10px;white-space:nowrap" onclick="calGoDisp('${e.farm.replace(/'/g,"&#39;")}','${e.harvest||''}','${(e.item||'').replace(/'/g,"&#39;")}')">+ 배차 등록</button><button class="btn edt" style="font-size:11px;padding:4px 8px" onclick="openHarvestEdit(${e.id})">✏️</button><button class="btn del" style="font-size:11px;padding:4px 8px" onclick="delHarvest(${e.id})">삭제</button>` : `<span class="badge ${bdg}" style="white-space:nowrap;font-size:12px">${e.status}</span>`}
     </div>
    </div>`;
  }).join('');

  const pgBar = document.getElementById('cal-pg-bar');
  if (pages <= 1) { pgBar.style.display = 'none'; return; }
  pgBar.style.display = 'flex';
  document.getElementById('cal-pg-info').textContent = `${total}건 · ${(calUpPage-1)*CAL_PER+1}~${Math.min(calUpPage*CAL_PER,total)}`;
  let btns = `<button class="pg-btn" onclick="calGoPage(${calUpPage-1})" ${calUpPage===1?'disabled':''}>◀</button>`;
  for (let i = 1; i <= pages; i++) btns += `<button class="pg-btn${i===calUpPage?' cur':''}" onclick="calGoPage(${i})">${i}</button>`;
  btns += `<button class="pg-btn" onclick="calGoPage(${calUpPage+1})" ${calUpPage===pages?'disabled':''}>▶</button>`;
  document.getElementById('cal-pg-btns').innerHTML = btns;
}

// ── 농가 이력
let _fhFarm = '', _fhTab = 'disp';

function openFarmHistory(name) {
  _fhFarm = name; _fhTab = 'disp';
  document.getElementById('fh-title').textContent = `📋 ${name} 이력`;
  document.getElementById('fh-tab-disp').className = 'dtab active';
  document.getElementById('fh-tab-pick').className = 'dtab';
  document.getElementById('fh-tab-own').className = 'dtab';
  renderFarmHistory();
  document.getElementById('modal-farm-history').style.display = 'flex';
}

function fhTab(t) {
  _fhTab = t;
  document.getElementById('fh-tab-disp').className = 'dtab' + (t === 'disp' ? ' active' : '');
  document.getElementById('fh-tab-pick').className = 'dtab' + (t === 'pick' ? ' active' : '');
  document.getElementById('fh-tab-own').className = 'dtab' + (t === 'own' ? ' active' : '');
  renderFarmHistory();
}

function renderFarmHistory() {
  const el = document.getElementById('fh-body');
  if (_fhTab === 'disp') {
    const list = dispatches.filter(d => d.farm === _fhFarm).sort((a,b) => b.date > a.date ? 1 : -1);
    if (!list.length) { el.innerHTML = '<div class="note">배차 내역이 없습니다</div>'; return; }
    const sc = { '배차완료': 'b-info', '배출완료': 'b-ok' };
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f8f8f8"><th style="padding:8px;text-align:left">날짜</th><th>기사</th><th>수량</th><th>종류</th><th>수확예정일</th><th>상태</th></tr></thead>
      <tbody>${list.map(d => `<tr style="border-bottom:0.5px solid #f0f0f0">
        <td style="padding:8px">${d.date}</td>
        <td style="padding:8px">${esc(d.driver)}</td>
        <td style="padding:8px">${d.qty}개</td>
        <td style="padding:8px">${ctB(d.ctype)}</td>
        <td style="padding:8px">${d.harvest||'-'}</td>
        <td style="padding:8px"><span class="badge ${sc[d.status]||'b-neu'}">${d.status}</span></td>
      </tr>`).join('')}</tbody>
    </table>`;
  } else if (_fhTab === 'pick') {
    const list = picks.filter(p => p.farm === _fhFarm && !p.auto).sort((a,b) => b.date > a.date ? 1 : -1);
    if (!list.length) { el.innerHTML = '<div class="note">수거 내역이 없습니다</div>'; return; }
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f8f8f8"><th style="padding:8px;text-align:left">날짜</th><th>구분</th><th>수량</th><th>기사</th><th>비고</th></tr></thead>
      <tbody>${list.map(p => `<tr style="border-bottom:0.5px solid #f0f0f0">
        <td style="padding:8px">${p.date}</td>
        <td style="padding:8px"><span class="badge ${p.type==='원물수거'?'b-ok':'b-neu'}">${p.type}</span></td>
        <td style="padding:8px">${p.qty}개</td>
        <td style="padding:8px">${esc(p.driver||'-')}</td>
        <td style="padding:8px">${esc(p.note||'-')}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  } else if (_fhTab === 'own') {
    const ins = ownIns.filter(o => o.farm === _fhFarm);
    const outs = ownOuts.filter(o => o.farm === _fhFarm);
    const all = [...ins.map(o=>({...o,dir:'반입'})), ...outs.map(o=>({...o,dir:'반납'}))].sort((a,b)=>b.date>a.date?1:-1);
    if (!all.length) { el.innerHTML = '<div class="note">외부 용기 내역이 없습니다</div>'; return; }
    const st = gOwnSt(_fhFarm);
    el.innerHTML = `<div style="padding:8px 0;margin-bottom:8px;font-size:13px">반입 <strong>${st.inQ}개</strong> · 반납 <strong>${st.outQ}개</strong> · 공장보유 <strong style="color:${st.left>0?'#C05800':'#2E7D32'}">${st.left}개</strong></div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f8f8f8"><th style="padding:8px;text-align:left">날짜</th><th>구분</th><th>수량</th><th>방법</th><th>담당</th></tr></thead>
      <tbody>${all.map(o => `<tr style="border-bottom:0.5px solid #f0f0f0">
        <td style="padding:8px">${o.date}</td>
        <td style="padding:8px"><span class="badge ${o.dir==='반입'?'b-pur':'b-ok'}">${o.dir}</span></td>
        <td style="padding:8px">${o.qty}개</td>
        <td style="padding:8px">${esc(o.method||'-')}</td>
        <td style="padding:8px">${esc(o.staff||'-')}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }
}

  // ── 기사별 실적 현황
function renderStats() {
  const el = document.getElementById('stats-body');
  if (!el) return;

  const now = new Date();
  const fd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const td = now.toISOString().slice(0, 10);
  const sfEl = document.getElementById('st-from');
  const stEl = document.getElementById('st-to');
  if (sfEl && !sfEl.value) sfEl.value = fd;
  if (stEl && !stEl.value) stEl.value = td;
  const from = sfEl?.value || fd;
  const to = stEl?.value || td;

  const filtered = dispatches.filter(d => d.date >= from && d.date <= to && d.status === '배출완료');
  const pending = dispatches.filter(d => d.date >= from && d.date <= to && d.status === '배차완료');

  if (!drivers.length) { el.innerHTML = '<div class="note">등록된 기사가 없습니다</div>'; return; }

  const stats = drivers.map(d => {
    const done = filtered.filter(x => x.driver === d.name);
    const pend = pending.filter(x => x.driver === d.name);
    const totalQty = done.reduce((s, x) => s + x.qty, 0);
    const pendQty = pend.reduce((s, x) => s + x.qty, 0);
    return { ...d, doneCnt: done.length, doneQty: totalQty, pendCnt: pend.length, pendQty };
  }).sort((a, b) => b.doneQty - a.doneQty);

  const totalDone = stats.reduce((s, d) => s + d.doneCnt, 0);
  const totalQty = stats.reduce((s, d) => s + d.doneQty, 0);

  el.innerHTML = `
    <div class="kpi-grid" style="margin-bottom:16px">
      <div class="kpi"><div class="kpi-label">총 배출 완료</div><div class="kpi-val kv-gr">${totalDone}건</div></div>
      <div class="kpi"><div class="kpi-label">총 배출 수량</div><div class="kpi-val kv-bl">${totalQty.toLocaleString()}개</div></div>
      <div class="kpi"><div class="kpi-label">기간</div><div class="kpi-val" style="font-size:13px">${from} ~ ${to}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f8f8f8;border-bottom:1px solid #e0e0e0">
          <th style="padding:10px 12px;text-align:left">기사명</th>
          <th style="padding:10px 12px;text-align:left">소속</th>
          <th style="padding:10px 12px;text-align:center">배출완료</th>
          <th style="padding:10px 12px;text-align:center">완료수량</th>
          <th style="padding:10px 12px;text-align:center">배출대기</th>
          <th style="padding:10px 12px;text-align:center">대기수량</th>
          <th style="padding:10px 12px;text-align:left">실적 비율</th>
        </tr>
      </thead>
      <tbody>
        ${stats.map(d => {
          const ratio = totalQty > 0 ? Math.round(d.doneQty / totalQty * 100) : 0;
          return `<tr style="border-bottom:0.5px solid #f0f0f0">
            <td style="padding:10px 12px;font-weight:500">${esc(d.name)}</td>
            <td style="padding:10px 12px"><span class="badge ${d.type==='내부'?'b-ok':'b-pur'}">${d.type}</span></td>
            <td style="padding:10px 12px;text-align:center"><span class="badge b-ok">${d.doneCnt}건</span></td>
            <td style="padding:10px 12px;text-align:center;font-weight:500;color:#2E7D32">${d.doneQty.toLocaleString()}개</td>
            <td style="padding:10px 12px;text-align:center"><span class="badge b-info">${d.pendCnt}건</span></td>
            <td style="padding:10px 12px;text-align:center;color:#C05800">${d.pendQty.toLocaleString()}개</td>
            <td style="padding:10px 12px">
              <div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;background:#f0f0f0;border-radius:4px;height:8px">
                  <div style="width:${ratio}%;background:#2E7D32;border-radius:4px;height:8px;transition:.3s"></div>
                </div>
                <span style="font-size:12px;color:#888;min-width:32px">${ratio}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}
  
let _editHarvestId = null;
function openHarvestEdit(id) {
  const h = harvests.find(x => x.id === id); if (!h) return;
  _editHarvestId = id;
  document.getElementById('mh-date').value = h.date || '';
  document.getElementById('mh-end').value = h.end_date || '';
  const mhf = document.getElementById('mh-farm');
  mhf.innerHTML = '<option value="">선택</option>';
  farms.forEach(f => mhf.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`);
  mhf.value = h.farm || '';
  document.getElementById('mh-item').value = h.item || '';
  document.getElementById('mh-note').value = h.note || '';
  document.getElementById('modal-harvest').style.display = 'flex';
}
async function saveHarvestEdit() {
  const date = document.getElementById('mh-date').value;
  const farm = document.getElementById('mh-farm').value;
  if (!date || !farm) { alert('수확 시작일과 농가명을 입력하세요'); return; }
  const data = { date, end_date: document.getElementById('mh-end').value || null, farm, item: document.getElementById('mh-item').value || null, note: document.getElementById('mh-note').value || null };
  try {
    await dbUpdateHarvest(_editHarvestId, data);
    harvests = harvests.map(h => h.id === _editHarvestId ? { ...h, ...data } : h);
    CM('harvest'); renderCal();
  } catch (e) { alert('오류: ' + e.message); }
}
async function autoSetHarvestStatus(farm, date, item, status) {
  let h = harvests.find(x => x.farm === farm && x.date === date);
  if (!h) {
    try {
      const row = await dbInsertHarvest({ date, farm, item: item || null, status });
      harvests.push(row);
    } catch(e) {
      // status 컬럼 없으면 status 빼고 재시도
      try { const row = await dbInsertHarvest({ date, farm, item: item || null }); harvests.push(row); h = row; } catch(e2) {}
      harvests[harvests.length - 1].status = status;
      renderCal(); return;
    }
    harvests[harvests.length - 1].status = status;
    renderCal(); return;
  }
  setHarvestStatus(h.id, status);
}

async function autoOpenHarvestEdit(farm, date, item) {
  let h = harvests.find(x => x.farm === farm && x.date === date);
  if (!h) {
    try { const row = await dbInsertHarvest({ date, farm, item: item || null }); harvests.push(row); h = row; }
    catch(e) { alert('오류: ' + e.message); return; }
  }
  openHarvestEdit(h.id);
}

async function autoDelHarvest(farm, date) {
  const h = harvests.find(x => x.farm === farm && x.date === date);
  if (h) { delHarvest(h.id); } else { renderCal(); }
}

async function setHarvestStatus(id, status) {
  // 우선 로컬 상태 먼저 반영 (DB 성공 여부 무관하게 화면 즉시 업데이트)
  harvests = harvests.map(h => h.id === id ? { ...h, status } : h);
  renderCal();
  try {
    await dbUpdateHarvest(id, { status });
  } catch (e) {
    if (e.message.includes('status') || e.message.includes('column')) {
      // 컬럼 없어도 화면은 동작, 새로고침 시 초기화됨을 안내
      console.warn('status 컬럼 없음 — Supabase SQL 실행 필요');
    } else {
      alert('오류: ' + e.message);
    }
  }
}
async function delHarvest(id) {
  if (!cDel('수확일정 삭제')) return;
  try {
    await dbDeleteHarvest(id);
    harvests = harvests.filter(h => h.id !== id);
    renderCal();
  } catch (e) { alert('오류: ' + e.message); }
}

async function addHarvest() {
  const date = document.getElementById('cal-add-date')?.value;
  const farm = document.getElementById('cal-add-farm')?.value;
  const end_date = document.getElementById('cal-add-end')?.value || null;
  const item = document.getElementById('cal-add-item')?.value || null;
  const note = document.getElementById('cal-add-note')?.value || null;
  if (!date || !farm) { alert('수확 시작일과 농가명을 입력하세요'); return; }
  try {
    const row = await dbInsertHarvest({ date, end_date, farm, item, note, status: '수확전' });
    harvests.push(row);
    document.getElementById('cal-add-date').value = '';
    document.getElementById('cal-add-end').value = '';
    document.getElementById('cal-add-farm').value = '';
    document.getElementById('cal-add-item').value = '';
    document.getElementById('cal-add-note').value = '';
    renderCal();
  } catch (e) { alert('오류: ' + e.message); }
}

async function delHarvest(id) {
  if (!confirm('수확 일정을 삭제할까요?')) return;
  try {
    await dbDeleteHarvest(id);
    harvests = harvests.filter(h => h.id !== id);
    renderCal();
  } catch (e) { alert('오류: ' + e.message); }
}

function calGoPage(p) { calUpPage = p; renderCalUpcoming(); }
function calPrevMonth() { if (calMonth === 0) { calYear--; calMonth = 11; } else calMonth--; calSelectedDate = null; calUpPage = 1; document.getElementById('cal-detail-panel').style.display = 'none'; renderCal(); }
function calNextMonth() { if (calMonth === 11) { calYear++; calMonth = 0; } else calMonth++; calSelectedDate = null; calUpPage = 1; document.getElementById('cal-detail-panel').style.display = 'none'; renderCal(); }

// ── 엑셀 내보내기
function exportExcel(type) {
  const from = document.getElementById('exp-from')?.value;
  const to = document.getElementById('exp-to')?.value;

  function filterByDate(arr) {
    return arr.filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
  }

  function toCSV(headers, rows) {
    const h = headers.join(',');
    const r = rows.map(row => row.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(','));
    return [h, ...r].join('\n');
  }

  function download(filename, csv) {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const today = new Date().toISOString().slice(0,10);

  if (type === 'dispatch' || type === 'all') {
    const data = filterByDate(dispatches);
    const csv = toCSV(
      ['날짜','농가명','기사','소속','차량','수량','콘테이너','수확예정일','품목','특이사항','상태'],
      data.map(d => [d.date, d.farm, d.driver, gd(d.driver).type||'', d.car, d.qty, d.ctype, d.harvest||'', d.item||'', d.note||'', d.status])
    );
    download(`배차내역_${today}.csv`, csv);
  }

  if (type === 'pick' || type === 'all') {
    const data = filterByDate(picks.filter(p => !p.auto));
    const csv = toCSV(
      ['날짜','농가명','구분','수량','기사','차량','비고'],
      data.map(p => [p.date, p.farm, p.type, p.qty, p.driver||'', p.car||'', p.note||''])
    );
    download(`수거내역_${today}.csv`, csv);
  }

  if (type === 'farm' || type === 'all') {
    const csv = toCSV(
      ['농가명','연락처','주소','품종','계약수량','담당직원','비고'],
      farms.map(f => [f.name, f.tel||'', f.addr||'', f.variety||'', f.contract||0, f.staff||'', f.memo||''])
    );
    download(`농가목록_${today}.csv`, csv);
  }

  if (type === 'driver' || type === 'all') {
    const csv = toCSV(
      ['기사명','연락처','차량번호','소속','비고'],
      drivers.map(d => [d.name, d.tel||'', d.car||'', d.type||'', d.note||''])
    );
    download(`기사목록_${today}.csv`, csv);
  }

  if (type === 'all') {
    alert('✅ 전체 파일 다운로드 완료!\n배차내역, 수거내역, 농가목록, 기사목록 4개 파일이 저장됩니다.');
  }
}

// ── 시작
document.addEventListener('DOMContentLoaded', initApp);
